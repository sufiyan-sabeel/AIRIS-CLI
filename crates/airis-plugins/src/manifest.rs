//! Plugin manifest parsing.
//!
//! Reads `plugin.toml` files from disk and validates their contents
//! against the [`PluginManifest`](airis_core::types::PluginManifest) schema.

use airis_core::prelude::{AirisError, AirisResult, PluginManifest, PluginType};
use serde::Deserialize;
use std::path::Path;

/// Intermediate deserialization target for `plugin.toml`.
///
/// Fields are validated and converted into [`PluginManifest`].
#[derive(Debug, Deserialize)]
struct ManifestFile {
    name: String,
    version: String,
    description: Option<String>,
    author: Option<String>,
    #[serde(rename = "type")]
    plugin_type: PluginType,
    #[serde(rename = "api_version")]
    api_version: Option<String>,
    #[serde(rename = "entry_point")]
    entry_point: Option<String>,
}

/// Parse a `plugin.toml` manifest file into a [`PluginManifest`].
///
/// # Errors
///
/// Returns [`AirisError::Plugin`] if:
/// - The file cannot be read as UTF-8 TOML.
/// - Required fields (`name`, `version`, `type`) are missing or invalid.
///
/// Returns [`AirisError::Io`] if the file cannot be opened.
///
/// # Example
///
/// ```rust,ignore
/// let manifest = parse_manifest("/path/to/plugin/plugin.toml")?;
/// ```
pub fn parse_manifest(path: &Path) -> AirisResult<PluginManifest> {
    let contents = std::fs::read_to_string(path)
        .map_err(|e| AirisError::Io(e))?;
    let mf: ManifestFile = toml::from_str(&contents)
        .map_err(|e| AirisError::Plugin(format!("Failed to parse manifest '{}': {}", path.display(), e)))?;

    Ok(PluginManifest {
        name: mf.name,
        version: mf.version,
        description: mf.description.unwrap_or_default(),
        author: mf.author.unwrap_or_default(),
        plugin_type: mf.plugin_type,
        api_version: mf.api_version.unwrap_or_else(|| "1.0".to_string()),
        entry_point: mf.entry_point.unwrap_or_else(|| "plugin.wasm".to_string()),
    })
}

/// Read and parse a plugin manifest from raw TOML bytes.
///
/// Useful for testing or when the manifest is embedded.
///
/// # Errors
///
/// Returns [`AirisError::Plugin`] if the bytes are not valid TOML or
/// required fields are missing.
pub fn parse_manifest_from_slice(bytes: &[u8]) -> AirisResult<PluginManifest> {
    let contents = std::str::from_utf8(bytes)
        .map_err(|e| AirisError::Plugin(format!("Manifest is not valid UTF-8: {}", e)))?;
    let mf: ManifestFile = toml::from_str(contents)
        .map_err(|e| AirisError::Plugin(format!("Failed to parse manifest: {}", e)))?;

    Ok(PluginManifest {
        name: mf.name,
        version: mf.version,
        description: mf.description.unwrap_or_default(),
        author: mf.author.unwrap_or_default(),
        plugin_type: mf.plugin_type,
        api_version: mf.api_version.unwrap_or_else(|| "1.0".to_string()),
        entry_point: mf.entry_point.unwrap_or_else(|| "plugin.wasm".to_string()),
    })
}

/// The expected filename for plugin manifests.
pub const MANIFEST_FILENAME: &str = "plugin.toml";

/// Locate the manifest file in a plugin directory.
///
/// Returns the path `<plugin_dir>/plugin.toml` if it exists.
///
/// # Errors
///
/// Returns [`AirisError::FileNotFound`] if the manifest file does not exist.
pub fn find_manifest_in_dir(plugin_dir: &Path) -> AirisResult<std::path::PathBuf> {
    let manifest_path = plugin_dir.join(MANIFEST_FILENAME);
    if manifest_path.exists() {
        Ok(manifest_path)
    } else {
        Err(AirisError::FileNotFound(format!(
            "No plugin.toml found in {}",
            plugin_dir.display()
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_manifest() {
        let toml = r#"
name = "test-plugin"
version = "1.0.0"
description = "A test plugin"
author = "Test Author"
type = "tool"
api_version = "1.0"
entry_point = "test.wasm"
"#;
        let manifest = parse_manifest_from_slice(toml.as_bytes()).unwrap();
        assert_eq!(manifest.name, "test-plugin");
        assert_eq!(manifest.version, "1.0.0");
        assert_eq!(manifest.description, "A test plugin");
        assert_eq!(manifest.author, "Test Author");
        assert_eq!(manifest.plugin_type, PluginType::Tool);
        assert_eq!(manifest.api_version, "1.0");
        assert_eq!(manifest.entry_point, "test.wasm");
    }

    #[test]
    fn test_parse_minimal_manifest() {
        let toml = r#"
name = "minimal"
version = "0.1.0"
type = "command"
"#;
        let manifest = parse_manifest_from_slice(toml.as_bytes()).unwrap();
        assert_eq!(manifest.name, "minimal");
        assert_eq!(manifest.description, "");
        assert_eq!(manifest.entry_point, "plugin.wasm");
        assert_eq!(manifest.api_version, "1.0");
    }

    #[test]
    fn test_parse_invalid_toml() {
        let toml = r#"not-toml-content"#;
        assert!(parse_manifest_from_slice(toml.as_bytes()).is_err());
    }

    #[test]
    fn test_parse_missing_required_field() {
        let toml = r#"
name = "missing-type"
version = "1.0"
"#;
        // Missing `type` field should fail
        assert!(parse_manifest_from_slice(toml.as_bytes()).is_err());
    }

    #[test]
    fn test_find_manifest_in_dir() {
        let dir = std::path::Path::new("/nonexistent/plugin");
        assert!(find_manifest_in_dir(dir).is_err());
    }
}
