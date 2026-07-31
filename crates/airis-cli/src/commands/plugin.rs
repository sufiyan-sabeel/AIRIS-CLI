//! `airis plugin` — Manage plugins.

use airis_core::prelude::*;
use crate::AirisCommands;
use crate::PluginActions;

pub async fn execute(
    action: &Option<PluginActions>,
    loader: &airis_plugins::PluginLoaderImpl,
) -> AirisResult<()> {
    match action {
        Some(PluginActions::List) | None => {
            let plugins = loader.list();
            if plugins.is_empty() {
                println!("No plugins installed.");
                return Ok(());
            }
            println!("Installed plugins:");
            for manifest in &plugins {
                println!(
                    "  {} v{} — {} ({:?})",
                    manifest.name, manifest.version, manifest.description, manifest.plugin_type
                );
            }
        }
        Some(PluginActions::Install { source }) => {
            println!("Installing plugin from: {}", source);
            println!("Plugin installation coming soon.");
        }
        Some(PluginActions::Remove { name }) => {
            println!("Removing plugin: {}", name);
            loader.unload(name).await?;
            println!("Plugin {} removed.", name);
        }
        Some(PluginActions::Enable { name }) => {
            println!("Enabling plugin: {}", name);
        }
        Some(PluginActions::Disable { name }) => {
            println!("Disabling plugin: {}", name);
        }
    }

    Ok(())
}
