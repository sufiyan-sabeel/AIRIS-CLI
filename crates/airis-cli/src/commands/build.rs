//! `airis build` — Build and compile code with AI assistance.

use crate::CommandContext;
use airis_core::prelude::*;

pub async fn execute(
    command: &Option<String>,
    watch: bool,
    ctx: &CommandContext,
) -> AirisResult<()> {
    let cmd = command.as_deref().unwrap_or("cargo build");

    if watch {
        println!("Watching and rebuilding...");
        println!("(Watch mode coming soon)");
    }

    println!("Building: {}", cmd);

    let result = ctx.terminal.execute(cmd, None, Some(300)).await?;

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
