//! `airis config` — View or modify configuration.

use airis_core::prelude::*;

pub async fn execute(
    get: &Option<String>,
    set: &Option<String>,
    list_all: bool,
    edit: bool,
    config_manager: &airis_config::ConfigManager,
) -> AirisResult<()> {
    let config = config_manager.config();

    if edit {
        let config_path = config_manager.config_dir().join("config.toml");
        let editor = std::env::var("EDITOR").unwrap_or_else(|_| "nano".into());
        let status = std::process::Command::new(&editor)
            .arg(&config_path)
            .status()
            .map_err(AirisError::Io)?;
        if !status.success() {
            return Err(AirisError::Custom("Editor exited with error".into()));
        }
        return Ok(());
    }

    if let Some(key) = get {
        match config_manager.get_value(key) {
            Some(val) => {
                println!("{} = {}", key, serde_json::to_string_pretty(&val)?);
            }
            None => {
                println!("Config key '{}' not found", key);
            }
        }
        return Ok(());
    }

    if let Some(kv) = set {
        if let Some((key, value)) = kv.split_once('=') {
            let parsed: serde_json::Value = toml::from_str(&format!("val = {}", value.trim()))
                .map(|t: toml::Value| t["val"].clone())
                .unwrap_or(serde_json::Value::String(value.trim().to_string()));

            config_manager.set_value(key.trim(), parsed).await?;
            println!("Set {} = {}", key.trim(), value.trim());
        } else {
            return Err(AirisError::Config(
                "Usage: airis config --set key=value".into(),
            ));
        }
        return Ok(());
    }

    if list_all {
        println!("{}", toml::to_string_pretty(&config)?);
        return Ok(());
    }

    // Show summary by default
    println!("AIRIS-CLI Configuration");
    println!("Config dir: {:?}", config_manager.config_dir());
    println!();
    println!("[Core]");
    println!("  Default model:  {:?}", config.core.default_model);
    println!("  Max tokens:     {}", config.core.max_tokens);
    println!("  Temperature:    {}", config.core.temperature);
    println!("  Theme:          {}", config.core.theme);
    println!();
    println!("[Providers]");
    for (name, _provider) in &config.providers {
        println!("  - {}: configured", name);
    }
    if config.providers.is_empty() {
        println!("  (none configured)");
    }
    println!();
    println!("[UI]");
    println!("  Animations:     {}", config.ui.enable_animations);
    println!("  Syntax theme:   {}", config.ui.syntax_theme);

    Ok(())
}
