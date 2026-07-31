//! `airis run` — Run shell commands with AI assistance.

use airis_core::prelude::*;
use crate::CommandContext;

pub async fn execute(
    command: &Option<String>,
    describe: &Option<String>,
    ctx: &CommandContext,
) -> AirisResult<()> {
    let cmd = match command {
        Some(cmd) => cmd.clone(),
        None => {
            if let Some(desc) = describe {
                let result = ctx
                    .runner
                    .run(
                        &format!(
                            "Generate a shell command for: {}\nRespond with ONLY the command, no explanation.",
                            desc
                        ),
                        AgentContext::default(),
                    )
                    .await?;
                result.output.trim().to_string()
            } else {
                return Err(AirisError::Custom(
                    "Provide a command or use --describe to let AI generate one.".into(),
                ));
            }
        }
    };

    println!("$ {}", cmd);

    let result = ctx.terminal.execute(&cmd, None, Some(120)).await?;

    if !result.stdout.is_empty() {
        println!("{}", result.stdout);
    }
    if !result.stderr.is_empty() {
        eprintln!("{}", result.stderr);
    }

    println!(
        "\n[Exit code: {} | Duration: {}ms]",
        result.exit_code, result.duration_ms
    );

    Ok(())
}
