//! `airis task` — Run a task from a plan.

use crate::CommandContext;
use airis_core::prelude::*;
use std::path::Path;

pub async fn execute(
    input: &str,
    ctx: &CommandContext,
) -> AirisResult<()> {
    // Check if input is a file path or inline task
    let task = if Path::new(input).exists() {
        tokio::fs::read_to_string(input).await?
    } else {
        input.to_string()
    };

    println!("Executing task...");
    println!();

    let context = AgentContext {
        max_steps: 25,
        ..AgentContext::default()
    };

    let result = ctx.runner.run(&task, context).await?;

    if result.success {
        println!("=== Result ===\n{}", result.output);
    } else {
        eprintln!("Task failed: {}", result.output);
    }

    println!("\nSteps taken: {}", result.steps_taken);
    Ok(())
}
