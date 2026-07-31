//! `airis build` — Build and compile code with AI assistance.

use airis_core::prelude::*;

pub async fn execute(
    command: &Option<String>,
    watch: bool,
    config: &airis_config::ConfigManager,
    terminal: &airis_terminal::TerminalImpl,
) -> AirisResult<()> {
    let cmd = command.as_deref().unwrap_or("cargo build");

    if watch {
        println!("Watching and rebuilding...");
        println!("(Watch mode coming soon)");
    }

    println!("Building: {}", cmd);

    let result = terminal.execute(cmd, None, Some(300)).await?;

    if !result.stdout.is_empty() {
        println!("{}", result.stdout);
    }
    if !result.stderr.is_empty() {
        eprintln!("{}", result.stderr);
    }

    if result.exit_code == 0 {
        println!("\nBuild succeeded.");
    } else {
        eprintln!("\nBuild failed with code {}", result.exit_code);
    }

    Ok(())
}
