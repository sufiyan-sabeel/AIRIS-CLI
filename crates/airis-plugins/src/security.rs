//! Capability-based security for plugins.
//!
//! Defines an allowlist-based capability model that gates which plugin types
//! and specific operations are permitted at runtime.

use airis_core::prelude::{AirisError, AirisResult, PluginManifest, PluginType};
use std::collections::HashSet;

/// Capability-based security allowlist for plugin operations.
///
/// Each plugin declares its required capabilities; the runtime checks them
/// against this allowlist before loading or enabling functionality.
///
/// # Capability Strings
///
/// - `plugin:<type>` — allow a specific plugin type (e.g. `plugin:tool`, `plugin:model`)
/// - `plugin:*` — allow all plugin types
///
/// # Example
///
/// ```rust,ignore
/// let allowlist = CapabilityAllowlist::new(&["plugin:tool", "plugin:command"]);
/// assert!(allowlist.check_type(&PluginType::Tool).is_ok());
/// ```
#[derive(Debug, Clone)]
pub struct CapabilityAllowlist {
    allowlist: HashSet<String>,
}

impl CapabilityAllowlist {
    /// Create a new allowlist from the given capability strings.
    ///
    /// The empty list denies everything.
    #[must_use]
    pub fn new(capabilities: &[String]) -> Self {
        Self {
            allowlist: capabilities.iter().cloned().collect(),
        }
    }

    /// Create a permissive allowlist that allows all capabilities.
    #[must_use]
    pub fn permissive() -> Self {
        let mut set = HashSet::new();
        set.insert("plugin:*".to_string());
        Self { allowlist: set }
    }

    /// Create a restrictive allowlist that denies everything.
    #[must_use]
    pub fn restrictive() -> Self {
        Self {
            allowlist: HashSet::new(),
        }
    }

    /// Check whether a plugin type is allowed.
    ///
    /// Returns `Ok(())` if `plugin:*` or `plugin:<type>` is in the allowlist.
    pub fn check_type(&self, plugin_type: &PluginType) -> AirisResult<()> {
        let type_str = format!("plugin:{}", Self::type_name(plugin_type));
        if self.allowlist.contains("plugin:*") || self.allowlist.contains(&type_str) {
            Ok(())
        } else {
            Err(AirisError::Plugin(format!(
                "Plugin type '{}' is not in the capability allowlist",
                Self::type_name(plugin_type),
            )))
        }
    }

    /// Check whether a specific capability string is allowed.
    pub fn check(&self, capability: &str) -> AirisResult<()> {
        if self.allowlist.contains(capability) || self.allowlist.contains("*") {
            Ok(())
        } else {
            Err(AirisError::Plugin(format!(
                "Capability '{}' is not in the allowlist",
                capability,
            )))
        }
    }

    /// Validate a manifest against the allowlist.
    ///
    /// Returns `Err` if the plugin type is not allowed.
    pub fn check_manifest(&self, manifest: &PluginManifest) -> AirisResult<()> {
        self.check_type(&manifest.plugin_type)
    }

    /// Return the list of allowed capability strings.
    #[must_use]
    pub fn allowed_capabilities(&self) -> Vec<String> {
        let mut caps: Vec<String> = self.allowlist.iter().cloned().collect();
        caps.sort();
        caps
    }

    fn type_name(plugin_type: &PluginType) -> &'static str {
        match plugin_type {
            PluginType::Command => "command",
            PluginType::Model => "model",
            PluginType::Tool => "tool",
            PluginType::Theme => "theme",
            PluginType::McpServer => "mcp_server",
            PluginType::Agent => "agent",
        }
    }
}

impl Default for CapabilityAllowlist {
    fn default() -> Self {
        Self::restrictive()
    }
}

impl From<Vec<String>> for CapabilityAllowlist {
    fn from(capabilities: Vec<String>) -> Self {
        Self::new(&capabilities)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use airis_core::types::{PluginManifest, PluginType};

    fn test_manifest(plugin_type: PluginType) -> PluginManifest {
        PluginManifest {
            name: "test".into(),
            version: "1.0.0".into(),
            description: "".into(),
            author: "".into(),
            plugin_type,
            api_version: "1.0".into(),
            entry_point: "test.wasm".into(),
        }
    }

    #[test]
    fn test_permissive_allows_all() {
        let allowlist = CapabilityAllowlist::permissive();
        assert!(allowlist.check_type(&PluginType::Tool).is_ok());
        assert!(allowlist.check_type(&PluginType::Model).is_ok());
        assert!(allowlist.check_type(&PluginType::Command).is_ok());
    }

    #[test]
    fn test_restrictive_denies_all() {
        let allowlist = CapabilityAllowlist::restrictive();
        assert!(allowlist.check_type(&PluginType::Tool).is_err());
    }

    #[test]
    fn test_selective_allow() {
        let allowlist =
            CapabilityAllowlist::new(&["plugin:tool".to_string(), "plugin:command".to_string()]);
        assert!(allowlist.check_type(&PluginType::Tool).is_ok());
        assert!(allowlist.check_type(&PluginType::Command).is_ok());
        assert!(allowlist.check_type(&PluginType::Model).is_err());
    }

    #[test]
    fn test_check_manifest() {
        let allowlist = CapabilityAllowlist::new(&["plugin:model".to_string()]);
        let manifest = test_manifest(PluginType::Model);
        assert!(allowlist.check_manifest(&manifest).is_ok());

        let tool_manifest = test_manifest(PluginType::Tool);
        assert!(allowlist.check_manifest(&tool_manifest).is_err());
    }

    #[test]
    fn test_wildcard_allows_all() {
        let allowlist = CapabilityAllowlist::new(&["plugin:*".to_string()]);
        assert!(allowlist.check_type(&PluginType::Theme).is_ok());
        assert!(allowlist.check_type(&PluginType::McpServer).is_ok());
    }
}
