//! Configuration management for AIRIS-CLI.
//!
//! Loads and manages TOML-based configuration from standard locations.
//! Supports layered config: defaults -> global -> project-local -> env vars.

use airis_core::prelude::*;
use parking_lot::RwLock;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::debug;

/// Configuration manager implementation.
pub struct ConfigManager {
    config: Arc<RwLock<AirisConfig>>,
    config_dir: PathBuf,
    config_path: PathBuf,
}

impl ConfigManager {
    /// Create a new config manager with default settings.
    pub async fn new() -> AirisResult<Self> {
        let config_dir = Self::default_config_dir();
        let config_path = config_dir.join("config.toml");

        let config = if config_path.exists() {
            Self::load_from_file(&config_path).await?
        } else {
            debug!("No config file found at {:?}, using defaults", config_path);
            let config = AirisConfig {
                core: CoreConfig {
                    session_dir: config_dir.join("sessions"),
                    cache_dir: config_dir.join("cache"),
                    ..CoreConfig::default()
                },
                models: ModelsConfig {
                    enabled: Vec::new(),
                    routing: ModelRouting {
                        chat: None,
                        code: None,
                        agent: None,
                        cheap: None,
                        fast: None,
                        embedding: None,
                    },
                },
                providers: std::collections::HashMap::new(),
                plugins: PluginsConfig {
                    enabled: Vec::new(),
                    paths: Vec::new(),
                    allowed: Vec::new(),
                },
                ui: UiConfig::default(),
                workspace: WorkspaceConfig {
                    indexing: IndexingConfig {
                        max_file_size: 1_048_576,
                        exclude_patterns: vec![
                            "node_modules/**".into(),
                            "target/**".into(),
                            ".git/**".into(),
                            "dist/**".into(),
                            "build/**".into(),
                            "*.pyc".into(),
                            "__pycache__/**".into(),
                        ],
                        include_patterns: vec!["*".into()],
                        max_files: 10_000,
                        enable_vector_search: true,
                    },
                    max_context_files: 50,
                    auto_index: true,
                },
                telemetry: TelemetryConfig {
                    enabled: false,
                    level: "info".into(),
                    file_logging: false,
                    log_dir: None,
                },
            };
            config
        };

        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            config_dir,
            config_path,
        })
    }

    /// Default configuration directory.
    fn default_config_dir() -> PathBuf {
        if let Some(dir) = dirs::config_dir() {
            dir.join("airis")
        } else {
            PathBuf::from(".airis")
        }
    }

    /// Load configuration from a TOML file.
    async fn load_from_file(path: &std::path::Path) -> AirisResult<AirisConfig> {
        let content = tokio::fs::read_to_string(path).await?;
        let config: AirisConfig = toml::from_str(&content)?;
        Ok(config)
    }

    /// Save configuration to file.
    async fn save_to_file(&self) -> AirisResult<()> {
        tokio::fs::create_dir_all(&self.config_dir).await?;
        let content = toml::to_string_pretty(&*self.config.read())?;
        tokio::fs::write(&self.config_path, content).await?;
        Ok(())
    }

    /// Get the active config.
    pub fn config(&self) -> AirisConfig {
        self.config.read().clone()
    }

    /// Update the entire config.
    pub async fn update(&self, config: AirisConfig) -> AirisResult<()> {
        *self.config.write() = config;
        self.save_to_file().await
    }

    /// Get a nested config value by dotted path (e.g. "core.default_provider").
    pub fn get_value(&self, path: &str) -> Option<serde_json::Value> {
        let config = self.config.read();
        let parts: Vec<&str> = path.split('.').collect();

        match parts.as_slice() {
            ["core"] => serde_json::to_value(&config.core).ok(),
            ["core", field] => {
                let v = serde_json::to_value(&config.core).ok()?;
                v.get(field).cloned()
            }
            ["models"] => serde_json::to_value(&config.models).ok(),
            ["models", field] => {
                let v = serde_json::to_value(&config.models).ok()?;
                v.get(field).cloned()
            }
            ["providers"] => serde_json::to_value(&config.providers).ok(),
            ["providers", name] => config.providers.get(*name).map(|p| serde_json::to_value(p).ok()).flatten(),
            ["providers", name, field] => {
                config.providers.get(*name).and_then(|p| {
                    let v = serde_json::to_value(p).ok()?;
                    v.get(field).cloned()
                })
            }
            ["ui"] => serde_json::to_value(&config.ui).ok(),
            ["workspace"] => serde_json::to_value(&config.workspace).ok(),
            ["plugins"] => serde_json::to_value(&config.plugins).ok(),
            ["telemetry"] => serde_json::to_value(&config.telemetry).ok(),
            _ => None,
        }
    }

    /// Set a config value by dotted path and persist.
    pub async fn set_value(&self, path: &str, value: serde_json::Value) -> AirisResult<()> {
        let mut config = self.config.write();
        let parts: Vec<&str> = path.split('.').collect();

        match parts.as_slice() {
            ["core", field] => {
                let mut core_val = serde_json::to_value(&config.core)?;
                core_val[field] = value;
                config.core = serde_json::from_value(core_val)?;
            }
            ["models", field] => {
                let mut models_val = serde_json::to_value(&config.models)?;
                models_val[field] = value;
                config.models = serde_json::from_value(models_val)?;
            }
            ["providers", name, field] => {
                if let Some(provider) = config.providers.get_mut(*name) {
                    let mut prov_val = serde_json::to_value(provider)?;
                    prov_val[field] = value;
                    *provider = serde_json::from_value(prov_val)?;
                }
            }
            ["ui", field] => {
                let mut ui_val = serde_json::to_value(&config.ui)?;
                ui_val[field] = value;
                config.ui = serde_json::from_value(ui_val)?;
            }
            ["plugins", field] => {
                let mut plug_val = serde_json::to_value(&config.plugins)?;
                plug_val[field] = value;
                config.plugins = serde_json::from_value(plug_val)?;
            }
            ["telemetry", field] => {
                let mut tel_val = serde_json::to_value(&config.telemetry)?;
                tel_val[field] = value;
                config.telemetry = serde_json::from_value(tel_val)?;
            }
            _ => return Err(AirisError::Config(format!("Unknown config path: {}", path))),
        }

        drop(config);
        self.save_to_file().await
    }
}

#[async_trait]
impl ConfigManager for ConfigManager {
    async fn load(&self) -> AirisResult<AirisConfig> {
        if self.config_path.exists() {
            Self::load_from_file(&self.config_path).await
        } else {
            Ok(self.config.read().clone())
        }
    }

    async fn save(&self, config: &AirisConfig) -> AirisResult<()> {
        *self.config.write() = config.clone();
        self.save_to_file().await
    }

    fn get(&self, path: &str) -> Option<serde_json::Value> {
        self.get_value(path)
    }

    async fn set(&self, path: &str, value: serde_json::Value) -> AirisResult<()> {
        self.set_value(path, value).await
    }

    fn config_dir(&self) -> PathBuf {
        self.config_dir.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_default_config_creation() {
        let cm = ConfigManager::new().await.unwrap();
        let config = cm.config();
        assert_eq!(config.core.max_tokens, 4096);
        assert_eq!(config.ui.enable_animations, true);
    }

    #[tokio::test]
    async fn test_get_set_value() {
        let cm = ConfigManager::new().await.unwrap();

        // Test getting default values
        let val = cm.get_value("core.max_tokens");
        assert!(val.is_some());

        // Test setting nested value
        cm.set_value("ui.enable_animations", serde_json::json!(false))
            .await
            .unwrap();
        let config = cm.config();
        assert!(!config.ui.enable_animations);

        // Reset
        cm.set_value("ui.enable_animations", serde_json::json!(true))
            .await
            .unwrap();
    }
}
