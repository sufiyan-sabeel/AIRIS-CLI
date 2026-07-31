//! WASM plugin instance.
//!
//! Provides [`PluginInstance`] — a [`Plugin`](airis_core::traits::Plugin) implementation
//! that wraps a wasmtime-compiled WebAssembly module with isolated execution,
//! memory management, and file-change tracking for hot-reload.

use airis_core::prelude::{AirisError, AirisResult, PluginManifest};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use parking_lot::Mutex;
use std::time::SystemTime;
use wasmtime::{Engine, Instance, Linker, Memory, Module, Store, TypedFunc};

/// Host data accessible to WASM imported functions.
struct HostData {
    /// JSON config string passed to `init()`.
    config_json: String,
    /// Plugin name for diagnostic messages.
    plugin_name: String,
}

/// Instantiated WASM runtime for a single plugin.
///
/// Held inside a [`Mutex`] to make the enclosing type `Sync`.
struct PluginRuntime {
    store: Store<HostData>,
    instance: Instance,
}

/// A loaded WASM plugin.
///
/// Compiles a wasmtime [`Module`] at construction time. Actual instantiation
/// (creating a [`Store`] and [`Instance`]) is deferred to [`init()`](Self::init).
///
/// # WASM ABI
///
/// Plugins **must** export:
///
/// | Export | Type | Description |
/// |--------|------|-------------|
/// | `memory` | memory | Linear memory (at least 1 page) |
/// | `alloc` | `(i32) -> i32` | Allocate `n` bytes, return pointer |
/// | `dealloc` | `(i32, i32) -> ()` | Free memory at pointer with byte count |
/// | `plugin_init` | `(i32, i32) -> i32` | Init with JSON config (ptr, len). Return 0 = success |
/// | `plugin_capabilities` | `() -> i64` | Return packed `(ptr << 32) \| len` pointing to a JSON `Vec<String>` |
///
/// Plugins **may** import:
///
/// | Import | Module | Type | Description |
/// |--------|--------|------|-------------|
/// | `airis_log` | `airis` | `(i32,i32,i32,i32) -> ()` | Log at level (ptr,len), message (ptr,len) |
/// | `airis_get_config` | `airis` | `() -> i64` | Get the JSON config as packed `(ptr,len)` |
pub struct PluginInstance {
    manifest: PluginManifest,
    engine: Engine,
    module: Module,
    /// Instantiated runtime; `None` until [`init()`](Self::init) is called.
    runtime: Mutex<Option<PluginRuntime>>,
    /// Cached capability strings, populated during init.
    capabilities: Mutex<Vec<String>>,
    /// Absolute path to the WASM binary file.
    entry_point: PathBuf,
    /// Absolute path to the `plugin.toml` manifest.
    manifest_path: PathBuf,
    /// System time when the WASM file was loaded.
    loaded_at: SystemTime,
}

impl PluginInstance {
    /// Create a new plugin instance from compiled WASM bytes.
    ///
    /// The WASM module is compiled immediately, but instantiation happens
    /// later when [`init()`](Self::init) is called. This keeps the constructor
    /// infallible modulo compilation errors.
    ///
    /// # Errors
    ///
    /// Returns [`AirisError::PluginLoadFailed`] if the WASM module fails to compile.
    pub fn new(
        manifest: PluginManifest,
        wasm_bytes: &[u8],
        engine: &Engine,
        entry_point: &Path,
        manifest_path: &Path,
    ) -> AirisResult<Self> {
        let module = Module::new(engine, wasm_bytes).map_err(|e| {
            AirisError::PluginLoadFailed(format!(
                "Failed to compile WASM module for '{}': {}",
                manifest.name, e
            ))
        })?;

        Ok(Self {
            manifest,
            engine: engine.clone(),
            module,
            runtime: Mutex::new(None),
            capabilities: Mutex::new(Vec::new()),
            entry_point: entry_point.to_path_buf(),
            manifest_path: manifest_path.to_path_buf(),
            loaded_at: SystemTime::now(),
        })
    }

    // ── Linker / Host functions ──────────────────────────────────────────

    /// Build a [`Linker`] pre-configured with host functions.
    fn build_linker(engine: &Engine) -> AirisResult<Linker<HostData>> {
        let mut linker = Linker::new(engine);

        // `airis.airis_log(level_ptr:i32, level_len:i32, msg_ptr:i32, msg_len:i32)`
        linker
            .func_wrap(
                "airis",
                "airis_log",
                |caller: wasmtime::Caller<'_, HostData>,
                 level_ptr: i32,
                 level_len: i32,
                 msg_ptr: i32,
                 msg_len: i32| {
                    let memory = match caller.get_export("memory").and_then(|e| e.into_memory()) {
                        Some(m) => m,
                        None => return,
                    };
                    let data = memory.data(&caller);
                    let level = String::from_utf8_lossy(
                        &data[level_ptr as usize..][..level_len as usize],
                    );
                    let msg = String::from_utf8_lossy(
                        &data[msg_ptr as usize..][..msg_len as usize],
                    );
                    let name = &caller.data().plugin_name;
                    match level.as_ref() {
                        "error" => tracing::error!(target: "airis::plugin", "[{name}] {msg}"),
                        "warn" => tracing::warn!(target: "airis::plugin", "[{name}] {msg}"),
                        "debug" => tracing::debug!(target: "airis::plugin", "[{name}] {msg}"),
                        _ => tracing::info!(target: "airis::plugin", "[{name}] {msg}"),
                    }
                },
            )
            .map_err(|e| AirisError::Plugin(format!("Failed to register airis_log: {e}")))?;

        // `airis.airis_get_config() -> i64`  (packed ptr<<32 | len)
        //
        // Allocates memory in the plugin via `alloc`, copies the config JSON,
        // and returns a packed pointer+length.
        linker
            .func_wrap(
                "airis",
                "airis_get_config",
                |mut caller: wasmtime::Caller<'_, HostData>| -> i64 {
                    let config_bytes = caller.data().config_json.as_bytes().to_vec();

                    // Get plugin memory
                    let memory = match caller
                        .get_export("memory")
                        .and_then(|e| e.into_memory())
                    {
                        Some(m) => m,
                        None => return 0,
                    };

                    // Allocate via plugin's allocator
                    let alloc_export = match caller
                        .get_export("alloc")
                        .and_then(|e| e.into_func())
                    {
                        Some(f) => f,
                        None => return 0,
                    };

                    let alloc_fn: wasmtime::TypedFunc<i32, i32> = match alloc_export
                        .typed::<i32, i32>(&caller)
                    {
                        Ok(f) => f,
                        Err(_) => return 0,
                    };

                    let len = config_bytes.len() as i32;
                    let ptr = match alloc_fn.call(&mut caller, len) {
                        Ok(p) => p,
                        Err(_) => return 0,
                    };

                    // Write config into plugin memory
                    memory.data_mut(&mut caller)[ptr as usize..][..config_bytes.len()]
                        .copy_from_slice(&config_bytes);

                    (i64::from(ptr) << 32) | i64::from(len) & 0xFFFF_FFFF
                },
            )
            .map_err(|e| {
                AirisError::Plugin(format!("Failed to register airis_get_config: {e}"))
            })?;

        Ok(linker)
    }

    // ── WASM memory helpers ──────────────────────────────────────────────

    /// Allocate bytes in WASM linear memory and copy them.
    ///
    /// Returns `(ptr, len)`.
    fn alloc_and_write(
        instance: &Instance,
        store: &mut Store<HostData>,
        bytes: &[u8],
    ) -> AirisResult<(i32, i32)> {
        let alloc_fn: TypedFunc<i32, i32> = instance
            .get_typed_func(store, "alloc")
            .map_err(|e| {
                AirisError::Plugin(format!("Missing 'alloc' export: {e}"))
            })?;

        let len = bytes.len() as i32;
        let ptr = alloc_fn.call(store, len).map_err(|e| {
            AirisError::Plugin(format!("'alloc' call failed: {e}"))
        })?;

        let memory = instance.get_memory(store, "memory").ok_or_else(|| {
            AirisError::Plugin("Plugin does not export 'memory'".to_string())
        })?;

        memory.data_mut(store)[ptr as usize..][..bytes.len()].copy_from_slice(bytes);

        Ok((ptr, len))
    }

    /// Read a string from WASM linear memory.
    fn read_string(instance: &Instance, store: &Store<HostData>, ptr: i32, len: i32) -> String {
        let memory = match instance.get_memory(store, "memory") {
            Some(m) => m,
            None => return String::new(),
        };
        let data = memory.data(store);
        let bytes = &data[ptr as usize..][..len as usize];
        String::from_utf8_lossy(bytes).to_string()
    }

    /// Call `dealloc` to free previously allocated WASM memory.
    fn dealloc(
        instance: &Instance,
        store: &mut Store<HostData>,
        ptr: i32,
        len: i32,
    ) {
        if let Ok(func) = instance.get_typed_func::<(i32, i32), ()>(store, "dealloc") {
            let _ = func.call(store, (ptr, len));
        }
    }

    // ── Hot-reload support ───────────────────────────────────────────────

    /// Absolute path to the WASM binary.
    pub fn entry_point_path(&self) -> &Path {
        &self.entry_point
    }

    /// Absolute path to the manifest file.
    pub fn manifest_path(&self) -> &Path {
        &self.manifest_path
    }

    /// Check whether the WASM binary has been modified on disk since
    /// the module was compiled.
    /// Check whether the WASM binary has been modified on disk since
    /// the module was compiled.
    ///
    /// Returns `true` if the file's modification time is newer than when
    /// we loaded it. Used by the hot-reload mechanism to detect updates.
    pub fn check_modified(&self) -> bool {
        self.entry_point
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|modified| modified > self.loaded_at)
            .unwrap_or(false)
    }

    /// Get the module reference for recompilation checks.
    pub fn module(&self) -> &Module {
        &self.module
    }
}

// ─── Plugin trait implementation ──────────────────────────────────────────

#[async_trait]
impl airis_core::traits::Plugin for PluginInstance {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn init(&self, config: &serde_json::Value) -> AirisResult<()> {
        // Fast path: already initialized
        {
            let guard = self.runtime.lock();
            if guard.is_some() {
                tracing::debug!("Plugin '{}' already initialized", self.manifest.name);
                return Ok(());
            }
        }

        let config_json = serde_json::to_string(config)
            .map_err(|e| AirisError::Internal(e.to_string()))?;

        // Prepare host data and store
        let host_data = HostData {
            config_json: config_json.clone(),
            plugin_name: self.manifest.name.clone(),
        };
        let mut store = Store::new(&self.engine, host_data);

        // Build linker and instantiate
        let linker = Self::build_linker(&self.engine)?;
        let instance = linker.instantiate(&mut store, &self.module).map_err(|e| {
            AirisError::PluginLoadFailed(format!(
                "Failed to instantiate '{}': {}",
                self.manifest.name, e
            ))
        })?;

        // Call plugin_init(config_ptr, config_len) -> i32
        let (config_ptr, config_len) =
            Self::alloc_and_write(&instance, &mut store, config_json.as_bytes())?;

        let init_fn: TypedFunc<(i32, i32), i32> = instance
            .get_typed_func(&mut store, "plugin_init")
            .map_err(|e| {
                AirisError::Plugin(format!("Missing 'plugin_init' export: {e}"))
            })?;

        let init_result = init_fn.call(&mut store, (config_ptr, config_len)).map_err(|e| {
            AirisError::Plugin(format!("'plugin_init' call failed: {e}"))
        })?;

        // Free config memory in the plugin
        Self::dealloc(&instance, &mut store, config_ptr, config_len);

        if init_result != 0 {
            return Err(AirisError::Plugin(format!(
                "Plugin '{}' init failed with code {init_result}",
                self.manifest.name
            )));
        }

        // Query capabilities: plugin_capabilities() -> i64 (packed ptr<<32 | len)
        let caps_fn: TypedFunc<(), i64> = instance
            .get_typed_func(&mut store, "plugin_capabilities")
            .map_err(|e| {
                AirisError::Plugin(format!("Missing 'plugin_capabilities' export: {e}"))
            })?;

        let caps_packed = caps_fn.call(&mut store, ()).map_err(|e| {
            AirisError::Plugin(format!("'plugin_capabilities' call failed: {e}"))
        })?;

        let caps_ptr = (caps_packed >> 32) as i32;
        let caps_len = (caps_packed & 0xFFFF_FFFF) as i32;
        let caps_str = Self::read_string(&instance, &store, caps_ptr, caps_len);

        // Parse capabilities JSON and cache them
        let caps: Vec<String> = serde_json::from_str(&caps_str).unwrap_or_else(|_| {
            tracing::warn!(
                "Plugin '{}' returned unparseable capabilities: {caps_str}",
                self.manifest.name
            );
            Vec::new()
        });

        // Store the runtime state and capabilities
        {
            let mut guard = self.runtime.lock();
            *guard = Some(PluginRuntime { store, instance });
        }
        {
            let mut caps_guard = self.capabilities.lock();
            *caps_guard = caps;
        }

        tracing::info!(
            "Plugin '{}' (v{}) initialized successfully",
            self.manifest.name,
            self.manifest.version
        );
        Ok(())
    }

    fn capabilities(&self) -> Vec<String> {
        self.capabilities.lock().clone()
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use airis_core::types::PluginManifest;
    use airis_core::prelude::PluginType;
    use std::sync::Arc;

    /// A minimal WASM module that exports the required ABI.
    ///
    /// ```
    /// (module
    ///   (memory (export "memory") 1)
    ///   (func (export "alloc") (param i32) (result i32)
    ///     i32.const 0)
    ///   (func (export "dealloc") (param i32 i32))
    ///   (func (export "plugin_init") (param i32 i32) (result i32)
    ///     i32.const 0)
    ///   (func (export "plugin_capabilities") (result i64)
    ///     i64.const 0)
    /// )
    /// ```
    ///
    /// Hand-assembled WAT → WASM:
    /// 00 61 73 6d  = \0asm (magic)
    /// 01 00 00 00  = v1
    fn minimal_wasm() -> Vec<u8> {
        // Sections: type, function, memory, export, code
        //
        // type section: 3 types
        //   (i32) -> i32   (alloc)
        //   (i32 i32) -> () (dealloc)
        //   (i32 i32) -> i32 (plugin_init)
        //   () -> i64       (plugin_capabilities)
        //
        // We'll encode a minimal valid WASM binary:
        let wasm: Vec<u8> = vec![
            0x00, 0x61, 0x73, 0x6d, // magic: \0asm
            0x01, 0x00, 0x00, 0x00, // version: 1
            // Type section (id 1)
            0x01, // section id
            0x0c, // section size (12 bytes)
            0x04, // 4 types
            // type 0: (i32) -> i32
            0x60, 0x01, 0x7f, 0x01, 0x7f,
            // type 1: (i32, i32) -> ()
            0x60, 0x02, 0x7f, 0x7f, 0x00,
            // type 2: (i32, i32) -> i32
            0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
            // type 3: () -> i64
            0x60, 0x00, 0x01, 0x7e,
            // Function section (id 3)
            0x03, // section id
            0x05, // section size (5 bytes)
            0x04, // 4 functions
            0x00, 0x01, 0x02, 0x03, // each referencing a type
            // Memory section (id 5)
            0x05, // section id
            0x03, // section size (3)
            0x01, // 1 memory
            0x00, 0x01, // min 1 page
            // Export section (id 7)
            0x07, // section id
            0x3c, // section size (60)
            0x05, // 5 exports
            // memory "memory"
            0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00,
            // func "alloc" index 0
            0x05, 0x61, 0x6c, 0x6c, 0x6f, 0x63, 0x00, 0x00,
            // func "dealloc" index 1
            0x07, 0x64, 0x65, 0x61, 0x6c, 0x6c, 0x6f, 0x63, 0x00, 0x01,
            // func "plugin_init" index 2
            0x0b, 0x70, 0x6c, 0x75, 0x67, 0x69, 0x6e, 0x5f, 0x69, 0x6e, 0x69, 0x74, 0x00, 0x02,
            // func "plugin_capabilities" index 3
            0x12, 0x70, 0x6c, 0x75, 0x67, 0x69, 0x6e, 0x5f, 0x63, 0x61, 0x70, 0x61, 0x62, 0x69,
            0x6c, 0x69, 0x74, 0x69, 0x65, 0x73, 0x00, 0x03,
            // Code section (id 10)
            0x0a, // section id
            0x1c, // section size (28)
            0x04, // 4 function bodies
            // alloc: return 0
            0x04, 0x00, 0x41, 0x00, 0x0b,
            // dealloc: no-op
            0x02, 0x00, 0x0b,
            // plugin_init: return 0
            0x04, 0x00, 0x41, 0x00, 0x0b,
            // plugin_capabilities: return 0 (empty caps)
            0x05, 0x00, 0x42, 0x00, 0x0b,
        ];
        wasm
    }

    fn test_manifest() -> PluginManifest {
        PluginManifest {
            name: "test-plugin".into(),
            version: "1.0.0".into(),
            description: "A test plugin".into(),
            author: "Test".into(),
            plugin_type: PluginType::Tool,
            api_version: "1.0".into(),
            entry_point: "test.wasm".into(),
        }
    }

    #[test]
    fn test_compile_module() {
        let engine = Engine::default();
        let manifest = test_manifest();
        let wasm = minimal_wasm();
        let instance = PluginInstance::new(
            manifest,
            &wasm,
            &engine,
            Path::new("test.wasm"),
            Path::new("plugin.toml"),
        );
        assert!(instance.is_ok());
    }

    #[test]
    fn test_compile_invalid_module() {
        let engine = Engine::default();
        let manifest = test_manifest();
        let result = PluginInstance::new(
            manifest,
            b"not-a-wasm-binary",
            &engine,
            Path::new("test.wasm"),
            Path::new("plugin.toml"),
        );
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_init_and_capabilities() {
        let engine = Engine::default();
        let manifest = test_manifest();
        let wasm = minimal_wasm();
        let instance = PluginInstance::new(
            manifest,
            &wasm,
            &engine,
            Path::new("test.wasm"),
            Path::new("plugin.toml"),
        )
        .unwrap();

        let config = serde_json::json!({});
        instance.init(&config).await.unwrap();

        let caps = instance.capabilities();
        assert!(caps.is_empty()); // our stub returns empty capabilities
    }

    #[tokio::test]
    async fn test_double_init_is_idempotent() {
        let engine = Engine::default();
        let manifest = test_manifest();
        let wasm = minimal_wasm();
        let instance = PluginInstance::new(
            manifest,
            &wasm,
            &engine,
            Path::new("test.wasm"),
            Path::new("plugin.toml"),
        )
        .unwrap();

        let config = serde_json::json!({});
        instance.init(&config).await.unwrap();
        instance.init(&config).await.unwrap(); // should be no-op
    }

    #[tokio::test]
    async fn test_init_with_config() {
        let engine = Engine::default();
        let manifest = test_manifest();
        let wasm = minimal_wasm();
        let instance = PluginInstance::new(
            manifest,
            &wasm,
            &engine,
            Path::new("test.wasm"),
            Path::new("plugin.toml"),
        )
        .unwrap();

        let config = serde_json::json!({
            "api_key": "test-123",
            "model": "gpt-4"
        });
        instance.init(&config).await.unwrap();
    }

    #[test]
    fn test_into_inner_send_sync() {
        fn assert_send<T: Send>() {}
        fn assert_sync<T: Sync>() {}
        assert_send::<PluginInstance>();
        assert_sync::<PluginInstance>();
    }
}
