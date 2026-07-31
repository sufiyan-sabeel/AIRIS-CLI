//! # airis-plugins
//!
//! WASM-based plugin system for AIRIS-CLI.
//!
//! Provides plugin loading, isolation, capability-based security,
//! directory scanning, and hot-reload support.
//!
//! ## Architecture
//!
//! - [`PluginLoaderImpl`]: Implements [`PluginLoader`](airis_core::traits::PluginLoader)
//!   for loading, unloading, and listing WASM-based plugins.
//! - [`PluginInstance`]: Implements [`Plugin`](airis_core::traits::Plugin) wrapping a
//!   wasmtime-compiled module with capability-aware execution.
//! - [`CapabilityAllowlist`]: Enforces capability-based security boundaries.
//! - [`scanner`]: Discovers plugins from configured directories.

pub mod instance;
pub mod loader;
pub mod manifest;
pub mod scanner;
pub mod security;

pub use instance::PluginInstance;
pub use loader::PluginLoaderImpl;
pub use manifest::parse_manifest;
pub use scanner::scan_plugin_dirs;
pub use security::CapabilityAllowlist;
