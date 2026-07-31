//! Plugin directory scanning.
//!
//! Discovers plugins by scanning configured filesystem paths for
//! `plugin.toml` manifest files and their associated WASM entry points.

use crate::manifest::{self, MANIFEST_FILENAME};
use airis_core::prelude::{AirisError, AirisResult, PluginManifest};
use std::path::{Path, PathBuf};

/// Result of scanning a single plugin directory.
#[derive(Debug, Clone)]
pub struct PluginCandidate {
    /// Path to the directory containing the plugin.
    pub dir: PathBuf,
    /// Path to the manifest file (`plugin.toml`).
    pub manifest_path: PathBuf,
    /// Parsed manifest.
    pub manifest: PluginManifest,
    /// Resolved absolute path to the WASM entry point.
    pub entry_point: PathBuf,
}

/// Scan configured plugin directories for plugin candidates.
///
/// Each plugin is expected to live in its own subdirectory containing
/// a `plugin.toml` manifest and a compiled WASM binary.
///
/// Scanning is **non-recursive by default** — only immediate subdirectories
/// of each root are inspected. Set `recursive = true` for deeper discovery.
///
/// # Errors
///
/// Returns [`AirisError::Io`] if a root directory cannot be read.
/// Returns [`AirisError::Plugin`] if a manifest is malformed.
///
/// # Example
///
/// ```rust,ignore
/// let candidates = scan_plugin_dirs(&["/home/user/.airis/plugins".into()], false)?;
/// ```
pub fn scan_plugin_dirs(dirs: &[PathBuf], recursive: bool) -> AirisResult<Vec<PluginCandidate>> {
    let mut candidates = Vec::new();

    for dir in dirs {
        if !dir.exists() {
            tracing::debug!("Plugin directory does not exist, skipping: {}", dir.display());
            continue;
        }

        if !dir.is_dir() {
            tracing::warn!("Plugin path is not a directory: {}", dir.display());
            continue;
        }

        if recursive {
            scan_dir_recursive(dir, dir, &mut candidates)?;
        } else {
            scan_dir_flat(dir, &mut candidates)?;
        }
    }

    Ok(candidates)
}

/// Scan immediate subdirectories of `root`.
fn scan_dir_flat(root: &Path, candidates: &mut Vec<PluginCandidate>) -> AirisResult<()> {
    let entries = std::fs::read_dir(root)
        .map_err(|e| AirisError::Io(e))?;

    for entry in entries {
        let entry = entry.map_err(|e| AirisError::Io(e))?;
        let path = entry.path();

        if path.is_dir() {
            if let Some(candidate) = inspect_plugin_dir(&path) {
                match candidate {
                    Ok(c) => candidates.push(c),
                    Err(e) => {
                        tracing::warn!(
                            "Skipping plugin in {}: {}",
                            path.display(),
                            e
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

/// Recursively scan for plugin directories.
fn scan_dir_recursive(root: &Path, current: &Path, candidates: &mut Vec<PluginCandidate>) -> AirisResult<()> {
    let entries = std::fs::read_dir(current)
        .map_err(|e| AirisError::Io(e))?;

    for entry in entries {
        let entry = entry.map_err(|e| AirisError::Io(e))?;
        let path = entry.path();

        if path.is_dir() {
            // Check if this directory has a plugin.toml file
            if path.join(MANIFEST_FILENAME).exists() {
                if let Some(candidate) = inspect_plugin_dir(&path) {
                    match candidate {
                        Ok(c) => candidates.push(c),
                        Err(e) => {
                            tracing::warn!(
                                "Skipping plugin in {}: {}",
                                path.display(),
                                e
                            );
                        }
                    }
                }
            } else {
                // Recurse into subdirectory
                scan_dir_recursive(root, &path, candidates)?;
            }
        }
    }

    Ok(())
}

/// Inspect a directory to see if it contains a valid plugin.
///
/// Returns `None` if there's no `plugin.toml` file.
fn inspect_plugin_dir(dir: &Path) -> Option<AirisResult<PluginCandidate>> {
    let manifest_path = dir.join(MANIFEST_FILENAME);
    if !manifest_path.exists() {
        return None;
    }

    Some(try_load_candidate(dir, &manifest_path))
}

/// Try to build a `PluginCandidate` from a directory and its manifest path.
fn try_load_candidate(dir: &Path, manifest_path: &Path) -> AirisResult<PluginCandidate> {
    let manifest = manifest::parse_manifest(manifest_path)?;

    let entry_point = resolve_entry_point(dir, &manifest.entry_point)?;

    Ok(PluginCandidate {
        dir: dir.to_path_buf(),
        manifest_path: manifest_path.to_path_buf(),
        manifest,
        entry_point,
    })
}

/// Resolve the WASM entry point path.
///
/// If `entry_point` is absolute, use it directly.
/// If relative, resolve it relative to the plugin directory.
fn resolve_entry_point(plugin_dir: &Path, entry_point: &str) -> AirisResult<PathBuf> {
    let path = PathBuf::from(entry_point);

    if path.is_absolute() {
        if path.exists() {
            Ok(path)
        } else {
            Err(AirisError::PluginLoadFailed(format!(
                "Plugin entry point not found: {}",
                path.display()
            )))
        }
    } else {
        let resolved = plugin_dir.join(&path);
        if resolved.exists() {
            Ok(resolved.canonicalize().unwrap_or(resolved))
        } else {
            Err(AirisError::PluginLoadFailed(format!(
                "Plugin entry point not found at {} (resolved from {})",
                resolved.display(),
                entry_point,
            )))
        }
    }
}

/// Scan a single plugin directory for plugin candidates.
///
/// Unlike `scan_plugin_dirs` which scans multiple roots, this scans just
/// one directory which may directly contain a `plugin.toml` (as opposed
/// to plugins in subdirectories).
///
/// # Errors
///
/// Returns [`AirisError::Plugin`] if the directory doesn't contain a valid manifest.
pub fn scan_single_directory(dir: &Path) -> AirisResult<Vec<PluginCandidate>> {
    let mut candidates = Vec::new();

    if !dir.is_dir() {
        return Err(AirisError::Plugin(format!(
            "Not a directory: {}",
            dir.display()
        )));
    }

    // Case 1: this directory itself contains plugin.toml
    if dir.join(MANIFEST_FILENAME).exists() {
        if let Some(result) = inspect_plugin_dir(dir) {
            match result {
                Ok(c) => candidates.push(c),
                Err(e) => {
                    tracing::warn!("Skipping plugin in {}: {}", dir.display(), e);
                }
            }
        }
    }

    // Case 2: scan subdirectories
    scan_dir_flat(dir, &mut candidates)?;

    Ok(candidates)
}

/// Check whether a plugin candidate has changed since the given modification time.
///
/// Returns `true` if either the manifest file or the WASM entry point has
/// been modified more recently than `last_modified`.
pub fn has_changed(candidate: &PluginCandidate, last_modified: std::time::SystemTime) -> bool {
    file_modified_after(&candidate.manifest_path, last_modified)
        || file_modified_after(&candidate.entry_point, last_modified)
}

fn file_modified_after(path: &Path, time: std::time::SystemTime) -> bool {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|m| m > time)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::SystemTime;
    use tempfile::TempDir;

    fn create_plugin_dir(temp_dir: &TempDir, name: &str) -> PathBuf {
        let dir = temp_dir.path().join(name);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn create_manifest(dir: &Path, name: &str, plugin_type: &str) {
        let content = format!(
            r#"name = "{}"
version = "1.0.0"
type = "{}"
"#,
            name, plugin_type
        );
        fs::write(dir.join("plugin.toml"), content).unwrap();
    }

    fn create_wasm_stub(dir: &Path) {
        // Create a minimal valid WASM binary (just enough to exist)
        let minimal_wasm = &[0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
        fs::write(dir.join("plugin.wasm"), minimal_wasm).unwrap();
    }

    #[test]
    fn test_scan_empty_directory() {
        let temp = TempDir::new().unwrap();
        let candidates = scan_plugin_dirs(&[temp.path().to_path_buf()], false).unwrap();
        assert!(candidates.is_empty());
    }

    #[test]
    fn test_scan_single_plugin() {
        let temp = TempDir::new().unwrap();
        let dir = create_plugin_dir(&temp, "my-plugin");
        create_manifest(&dir, "my-plugin", "tool");
        create_wasm_stub(&dir);

        let candidates = scan_plugin_dirs(&[temp.path().to_path_buf()], false).unwrap();
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].manifest.name, "my-plugin");
        assert_eq!(candidates[0].manifest.plugin_type, airis_core::types::PluginType::Tool);
        assert!(candidates[0].entry_point.exists());
    }

    #[test]
    fn test_scan_multiple_plugins() {
        let temp = TempDir::new().unwrap();
        let d1 = create_plugin_dir(&temp, "plugin-a");
        create_manifest(&d1, "plugin-a", "tool");
        create_wasm_stub(&d1);

        let d2 = create_plugin_dir(&temp, "plugin-b");
        create_manifest(&d2, "plugin-b", "model");
        create_wasm_stub(&d2);

        let candidates = scan_plugin_dirs(&[temp.path().to_path_buf()], false).unwrap();
        assert_eq!(candidates.len(), 2);
    }

    #[test]
    fn test_scan_skips_dir_without_manifest() {
        let temp = TempDir::new().unwrap();
        let dir = create_plugin_dir(&temp, "not-a-plugin");
        // No manifest created
        fs::write(dir.join("random.txt"), "hello").unwrap();

        let candidates = scan_plugin_dirs(&[temp.path().to_path_buf()], false).unwrap();
        assert!(candidates.is_empty());
    }

    #[test]
    fn test_resolve_entry_point_absolute() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("test.wasm");
        fs::write(&path, &[0x00, 0x61, 0x73, 0x6d]).unwrap();

        let resolved = resolve_entry_point(temp.path(), path.to_str().unwrap()).unwrap();
        assert!(resolved.exists());
    }

    #[test]
    fn test_resolve_entry_point_relative() {
        let temp = TempDir::new().unwrap();
        let dir = create_plugin_dir(&temp, "my-plugin");
        create_wasm_stub(&dir);

        let resolved = resolve_entry_point(&dir, "plugin.wasm").unwrap();
        assert_eq!(resolved.file_name().unwrap().to_str().unwrap(), "plugin.wasm");
    }

    #[test]
    fn test_resolve_entry_point_missing() {
        let temp = TempDir::new().unwrap();
        let result = resolve_entry_point(temp.path(), "nonexistent.wasm");
        assert!(result.is_err());
    }

    #[test]
    fn test_has_changed() {
        let temp = TempDir::new().unwrap();
        let dir = create_plugin_dir(&temp, "my-plugin");
        create_manifest(&dir, "my-plugin", "tool");
        create_wasm_stub(&dir);

        let old_time = SystemTime::now()
            .checked_sub(std::time::Duration::from_secs(3600))
            .unwrap();

        // Files were just created, so they're newer than old_time
        let candidates = scan_plugin_dirs(&[temp.path().to_path_buf()], false).unwrap();
        assert!(has_changed(&candidates[0], old_time));
    }
}
