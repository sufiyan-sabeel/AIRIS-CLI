//! `airis init` — Initialize AIRIS-CLI in current directory.

use crate::CommandContext;
use airis_core::prelude::*;
use std::path::PathBuf;

pub async fn execute(
    force: bool,
    template: &str,
    ctx: &CommandContext,
) -> AirisResult<()> {
    let cwd = std::env::current_dir().map_err(AirisError::Io)?;
    let airis_dir = cwd.join(".airis");

    if airis_dir.exists() && !force {
        println!(".airis directory already exists. Use --force to reinitialize.");
        return Ok(());
    }

    tokio::fs::create_dir_all(&airis_dir).await?;
    tokio::fs::create_dir_all(airis_dir.join("sessions")).await?;
    tokio::fs::create_dir_all(airis_dir.join("cache")).await?;
    tokio::fs::create_dir_all(airis_dir.join("plugins")).await?;

    // Write default workspace config
    let config_content = r#"# AIRIS-CLI Workspace Configuration
[core]
max_tokens = 4096
temperature = 0.7
theme = "kageos-dark"

[workspace]
auto_index = true
max_context_files = 50

[workspace.indexing]
max_file_size = 1048576
exclude_patterns = ["node_modules/**", "target/**", ".git/**"]
"#;
    tokio::fs::write(airis_dir.join("config.toml"), config_content).await?;

    // Create .airisignore
    tokio::fs::write(
        airis_dir.join(".airisignore"),
        ".git/\ntarget/\nnode_modules/\n",
    )
    .await?;

    println!("[✓] Initialized AIRIS-CLI workspace in {:?}", cwd);
    println!("    Created: .airis/");
    println!("    Created: .airis/config.toml");
    println!("    Created: .airis/sessions/");
    println!("    Created: .airis/cache/");
    println!("    Created: .airis/plugins/");
    println!("    Created: .airis/.airisignore");

    Ok(())
}
