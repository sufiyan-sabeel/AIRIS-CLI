//! `airis code` — Autonomous coding agent mode.

use crate::CommandContext;
use airis_core::prelude::*;

/// Execute the code command — autonomous coding agent.
pub async fn execute(
    task: &str,
    max_steps: usize,
    ctx: &CommandContext,
) -> AirisResult<()> {
    println!("AIRIS Coding Agent — KageOS");
    println!("Task: {}", task);
    println!("Max steps: {}", max_steps);
    println!();

    let result = ctx.runner.code(task, max_steps).await?;

    println!("\n=== Result ===");
    if result.success {
        println!("{}", result.output);
    } else {
        eprintln!("Agent failed: {}", result.output);
    }

    println!("\nSteps taken: {}/{}", result.steps_taken, max_steps);
    if let Some(usage) = Some(&result.token_usage) {
        println!(
            "Tokens: {} prompt + {} completion = {} total",
            usage.prompt_tokens, usage.completion_tokens, usage.total_tokens
        );
    }

    Ok(())
}
