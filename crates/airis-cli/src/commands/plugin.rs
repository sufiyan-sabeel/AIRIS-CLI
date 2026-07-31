//! `airis plugin` — Manage plugins.

use crate::CommandContext;
use crate::PluginActions;
use airis_core::prelude::*;

pub async fn execute(
    action: &Option<PluginActions>,
    name: &Option<String>,
    ctx: &CommandContext,
) -> AirisResult<()> {
    match action {
        Some(PluginActions::List) | None => {
            let plugins = ctx.plugin_loader.list();
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
            ctx.plugin_loader.unload(name).await?;
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
