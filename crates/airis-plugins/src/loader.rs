//! Plugin loading, unloading, lifecycle management, and hot-reload.
//!
//! Provides [`PluginLoaderImpl`] — the concrete [`PluginLoader`](airis_core::traits::PluginLoader)
//! that composes manifest parsing, directory scanning, capability security,
//! and WASM instantiation into a cohesive lifecycle.

use crate::instance::PluginInstance;
use crate::scanner::{self, PluginCandidate};
use crate::security::CapabilityAllowlist;
use airis_core::prelude::{AirisError, AirisResult, PluginManifest, PluginsConfig};
use async_trait::async_trait;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::PathBuf;
use wasmtime::Engine;

/// Concrete implementation of [`PluginLoader`](airis_core::traits::PluginLoader).
///
/// Manages the full plugin lifecycle: scanning, loading, initializing,
/// capability checking, hot-reload, and cleanup.
///
/// # Architecture
///
/// ```text
///                     ┌─────────────┐
///                     │  File System │
///                     └──────┬──────┘
///                            │ scan
///                     ┌──────▼──────┐
///                     │   Scanner   │
///                     └──────┬──────┘
///                            │ candidates (manifest + entry point)
///                     ┌──────▼──────┐
///                     │  Allowlist   │ ─── capability check
///                     └──────┬──────┘
///                            │
///                     ┌──────▼──────┐
///                     │  WASM Load  │ ─── compile + instantiate
///                     └──────┬──────┘
///                            │
///                     ┌──────▼──────┐
///                     │   Plugins   │
///                     │   (loaded)  │
///                     └─────────────┘
/// ```
pub struct PluginLoaderImpl {
    /// Shared wasmtime engine for all plugins.
    engine: Engine,
    /// Loaded plugins, keyed by name.
    plugins: Mutex<HashMap<String, Box<PluginInstance>>>,
    /// Capability-based security allowlist.
    allowlist: CapabilityAllowlist,
    /// Configured plugin directories.
    plugin_dirs: Vec<PathBuf>,
    /// Whether to scan directories recursively.
    recursive_scan: bool,
}

impl PluginLoaderImpl {
    /// Create a new plugin loader with the given configuration.
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// let loader = PluginLoaderImpl::new(
    ///     &PluginsConfig { enabled: vec!["my-plugin".into()], paths: vec!["/path/to/plugins".into()], allowed: vec!["plugin:tool".into()] },
    /// )?;
    /// ```
    pub fn new(config: &PluginsConfig) -> AirisResult<Self> {
        let mut wasm_config = wasmtime::Config::new();
        wasm_config.cache_store(false);
        let engine = Engine::new(&wasm_config)
            .map_err(|e| AirisError::Plugin(format!("Failed to create WASM engine: {e}")))?;

        let allowlist = CapabilityAllowlist::new(&config.allowed);

        Ok(Self {
            engine,
            plugins: Mutex::new(HashMap::new()),
            allowlist,
            plugin_dirs: config.paths.clone(),
            recursive_scan: false,
        })
    }

    /// Create a new plugin loader with a pre-configured wasmtime engine.
    ///
    /// Useful when sharing an engine across multiple subsystems.
    #[must_use]
    pub fn with_engine(
        engine: Engine,
        config: &PluginsConfig,
    ) -> Self {
        let allowlist = CapabilityAllowlist::new(&config.allowed);
        Self {
            engine,
            plugins: Mutex::new(HashMap::new()),
            allowlist,
            plugin_dirs: config.paths.clone(),
            recursive_scan: false,
        }
    }

    /// Set whether directory scanning should be recursive.
    pub fn set_recursive(&mut self, recursive: bool) {
        self.recursive_scan = recursive;
    }

    /// Add a plugin directory to scan.
    pub fn add_plugin_dir(&mut self, dir: PathBuf) {
        if !self.plugin_dirs.contains(&dir) {
            self.plugin_dirs.push(dir);
        }
    }

    /// Get a reference to the configured allowlist.
    #[must_use]
    pub fn allowlist(&self) -> &CapabilityAllowlist {
        &self.allowlist
    }

    /// Load a single plugin from a candidate found by the scanner.
    ///
    /// Compiles the WASM binary and registers the plugin. Does **not**
    /// call [`init()`](PluginInstance::init) — callers must do that separately.
    fn load_candidate(&self, candidate: PluginCandidate) -> AirisResult<String> {
        // Check capability allowlist
        self.allowlist.check_manifest(&candidate.manifest)?;

        let name = candidate.manifest.name.clone();

        // Check if plugin is already loaded
        {
            let guard = self.plugins.lock();
            if guard.contains_key(&name) {
                tracing::debug!("Plugin '{name}' already loaded, skipping");
                return Ok(name);
            }
        }

        // Read WASM bytes
        let wasm_bytes = std::fs::read(&candidate.entry_point)
            .map_err(|e| {
                AirisError::PluginLoadFailed(format!(
                    "Failed to read WASM file '{}': {e}",
                    candidate.entry_point.display()
                ))
            })?;

        // Compile and create instance
        let instance = PluginInstance::new(
            candidate.manifest,
            &wasm_bytes,
            &self.engine,
            &candidate.entry_point,
            &candidate.manifest_path,
        )?;

        let mut guard = self.plugins.lock();
        guard.insert(name.clone(), Box::new(instance));

        tracing::info!("Loaded plugin '{name}'");
        Ok(name)
    }

    /// Reload a plugin by name.
    ///
    /// Recompiles its WASM module and replaces the in-memory instance.
    /// The plugin will need to be re-initialized after reload.
    fn reload_plugin(&self, name: &str) -> AirisResult<()> {
        // Find the candidate for this plugin
        let candidates = scanner::scan_plugin_dirs(&self.plugin_dirs, self.recursive_scan)?;
        let candidate = candidates
            .into_iter()
            .find(|c| c.manifest.name == name)
            .ok_or_else(|| {
                AirisError::Plugin(format!(
                    "Cannot reload '{name}': plugin directory not found"
                ))
            })?;

        self.allowlist.check_manifest(&candidate.manifest)?;

        let wasm_bytes = std::fs::read(&candidate.entry_point)
            .map_err(|e| {
                AirisError::PluginLoadFailed(format!(
                    "Failed to read WASM file for reload '{name}': {e}"
                ))
            })?;

        let instance = PluginInstance::new(
            candidate.manifest,
            &wasm_bytes,
            &self.engine,
            &candidate.entry_point,
            &candidate.manifest_path,
        )?;

        let mut guard = self.plugins.lock();
        guard.insert(name.to_string(), Box::new(instance));

        tracing::info!("Reloaded plugin '{name}'");
        Ok(())
    }
}

// ─── PluginLoader trait implementation ────────────────────────────────────

#[async_trait]
impl airis_core::traits::PluginLoader for PluginLoaderImpl {
    /// Load a plugin from a manifest.
    ///
    /// Returns a boxed plugin without internal lifecycle tracking.
    /// Use [`load_all()`](Self::load_all) for plugins that need lifecycle
    /// management (unload, list, hot-reload).
    async fn load(&self, manifest: PluginManifest) -> AirisResult<Box<dyn airis_core::traits::Plugin>> {
        self.allowlist.check_manifest(&manifest)?;

        let name = manifest.name.clone();

        // Try to find the entry point in configured directories
        let entry_point = self
            .resolve_entry_point(&manifest)
            .ok_or_else(|| {
                AirisError::PluginLoadFailed(format!(
                    "Cannot resolve entry point '{}' for plugin '{name}'",
                    manifest.entry_point
                ))
            })?;

        let manifest_path = entry_point
            .parent()
            .map(|p| p.join("plugin.toml"))
            .unwrap_or_else(|| PathBuf::from("plugin.toml"));

        let wasm_bytes = std::fs::read(&entry_point)
            .map_err(|e| {
                AirisError::PluginLoadFailed(format!(
                    "Failed to read WASM for '{name}': {e}"
                ))
            })?;

        let instance = PluginInstance::new(
            manifest,
            &wasm_bytes,
            &self.engine,
            &entry_point,
            &manifest_path,
        )?;

        Ok(Box::new(instance))
    }

    /// Load all plugins from configured paths.
    ///
    /// Scans configured directories for `plugin.toml` manifests, validates
    /// each against the capability allowlist, compiles the WASM modules,
    /// and returns the list of loaded plugins.
    async fn load_all(&self) -> AirisResult<Vec<Box<dyn airis_core::traits::Plugin>>> {
        let candidates = scanner::scan_plugin_dirs(&self.plugin_dirs, self.recursive_scan)?;
        let mut loaded = Vec::new();

        for candidate in candidates {
            let name = candidate.manifest.name.clone();

            // Check allowlist
            if let Err(e) = self.allowlist.check_manifest(&candidate.manifest) {
                tracing::warn!("Plugin '{name}' rejected by allowlist: {e}");
                continue;
            }

            // Check if already loaded
            {
                let guard = self.plugins.lock();
                if guard.contains_key(&name) {
                    tracing::debug!("Plugin '{name}' already loaded");
                    continue;
                }
            }

            // Read and compile
            let wasm_bytes = match std::fs::read(&candidate.entry_point) {
                Ok(b) => b,
                Err(e) => {
                    tracing::warn!("Failed to read WASM for '{name}': {e}");
                    continue;
                }
            };

            match PluginInstance::new(
                candidate.manifest,
                &wasm_bytes,
                &self.engine,
                &candidate.entry_point,
                &candidate.manifest_path,
            ) {
                Ok(instance) => {
                    let boxed: Box<dyn airis_core::traits::Plugin> = Box::new(instance);
                    loaded.push(boxed);
                }
                Err(e) => {
                    tracing::warn!("Failed to compile plugin '{name}': {e}");
                }
            }
        }

        Ok(loaded)
    }

    /// Unload a plugin by name.
    ///
    /// Removes it from the internal registry. If the plugin was previously
    /// initialized, its WASM runtime is dropped.
    async fn unload(&self, name: &str) -> AirisResult<()> {
        let mut guard = self.plugins.lock();
        guard
            .remove(name)
            .ok_or_else(|| AirisError::Plugin(format!("Plugin '{name}' is not loaded")))?;

        tracing::info!("Unloaded plugin '{name}'");
        Ok(())
    }

    /// List all loaded plugin manifests.
    fn list(&self) -> Vec<PluginManifest> {
        let guard = self.plugins.lock();
        guard.values().map(|p| p.manifest().clone()).collect()
    }
}

// ─── Hot-reload ───────────────────────────────────────────────────────────

impl PluginLoaderImpl {
    /// Check for changed plugin files and reload any that have been modified.
    ///
    /// Returns the names of plugins that were reloaded.
    ///
    /// This is a polling-based hot-reload mechanism. Call it periodically
    /// (e.g., every few seconds) to detect changes.
    ///
    /// # Errors
    ///
    /// Returns [`AirisError::Plugin`] if a plugin file cannot be read or
    /// its WASM module fails to recompile.
    pub async fn reload_changed(&self) -> AirisResult<Vec<String>> {
        let candidates = scanner::scan_plugin_dirs(&self.plugin_dirs, self.recursive_scan)?;
        let mut reloaded = Vec::new();

        for candidate in &candidates {
            let name = &candidate.manifest.name;

            // Only consider currently loaded plugins
            let should_reload = {
                let guard = self.plugins.lock();
                guard.get(name).map_or(false, |instance| instance.check_modified())
            };

            if should_reload {
                tracing::info!("Hot-reloading plugin '{name}'");
                if let Err(e) = self.reload_plugin(name) {
                    tracing::error!("Failed to reload plugin '{name}': {e}");
                    continue;
                }
                reloaded.push(name.clone());
            }
        }

        Ok(reloaded)
    }

    /// Remove plugins whose directories no longer exist.
    ///
    /// Returns the names of removed plugins.
    pub fn remove_stale(&self) -> Vec<String> {
        let candidates = match scanner::scan_plugin_dirs(&self.plugin_dirs, self.recursive_scan) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let active_names: std::collections::HashSet<String> =
            candidates.into_iter().map(|c| c.manifest.name).collect();

        let mut removed = Vec::new();
        let mut guard = self.plugins.lock();
        guard.retain(|name, _| {
            if active_names.contains(name) {
                true
            } else {
                removed.push(name.clone());
                false
            }
        });

        for name in &removed {
            tracing::info!("Removed stale plugin '{name}'");
        }

        removed
    }

    /// Get the number of currently loaded plugins.
    #[must_use]
    pub fn loaded_count(&self) -> usize {
        self.plugins.lock().len()
    }

    /// Check whether a specific plugin is loaded.
    #[must_use]
    pub fn is_loaded(&self, name: &str) -> bool {
        self.plugins.lock().contains_key(name)
    }

    /// Resolve a manifest's entry point to an absolute path.
    ///
    /// If `entry_point` is an absolute path that exists, use it directly.
    /// Otherwise scan configured plugin directories for a matching plugin.
    fn resolve_entry_point(&self, manifest: &PluginManifest) -> Option<PathBuf> {
        let entry = PathBuf::from(&manifest.entry_point);

        // Absolute path — use directly
        if entry.is_absolute() && entry.exists() {
            return Some(entry);
        }

        // Relative — scan directories for a matching plugin name
        let candidates = scanner::scan_plugin_dirs(&self.plugin_dirs, self.recursive_scan).ok()?;
        candidates
            .into_iter()
            .find(|c| c.manifest.name == manifest.name)
            .map(|c| c.entry_point)
    }
}

// ─── Error conversion ─────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> PluginsConfig {
        PluginsConfig {
            enabled: vec![],
            paths: vec![],
            allowed: vec!["plugin:*".into()],
        }
    }

    #[test]
    fn test_new_loader() {
        let loader = PluginLoaderImpl::new(&test_config());
        assert!(loader.is_ok());
        assert_eq!(loader.unwrap().loaded_count(), 0);
    }

    #[test]
    fn test_list_empty() {
        let loader = PluginLoaderImpl::new(&test_config()).unwrap();
        let list = loader.list();
        assert!(list.is_empty());
    }

    #[test]
    fn test_is_loaded() {
        let loader = PluginLoaderImpl::new(&test_config()).unwrap();
        assert!(!loader.is_loaded("nonexistent"));
    }

    #[tokio::test]
    async fn test_load_with_allowlist_rejection() {
        let mut config = test_config();
        config.allowed = vec!["plugin:model".into()]; // Only allow model plugins
        config.paths = vec![];

        let loader = PluginLoaderImpl::new(&config).unwrap();

        let manifest = PluginManifest {
            name: "tool-plugin".into(),
            version: "1.0.0".into(),
            description: "".into(),
            author: "".into(),
            plugin_type: airis_core::types::PluginType::Tool,
            api_version: "1.0".into(),
            entry_point: "plugin.wasm".into(),
        };

        let result = loader.load(manifest).await;
        assert!(result.is_err()); // Should be rejected by allowlist
    }

    #[tokio::test]
    async fn test_unload_nonexistent() {
        let loader = PluginLoaderImpl::new(&test_config()).unwrap();
        let result = loader.unload("nonexistent").await;
        assert!(result.is_err());
    }
}
