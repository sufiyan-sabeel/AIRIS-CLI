//! `airis task` — Run a task from a plan.

use airis_core::prelude::*;
use std::path::Path;

pub async fn execute(
    input: &str,
    config: &airis_config::ConfigManager,
    agent: &airis_agent::AgentImpl,
    tools: &airis_tools::ToolRegistryImpl,
    workspace: &airis_workspace::WorkspaceManagerImpl,
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

    let result = agent.run(&task, context).await?;

    if result.success {
        println!("=== Result ===\n{}", result.output);
    } else {
        eprintln!("Task failed: {}", result.output);
    }

    println!("\nSteps taken: {}", result.steps_taken);
    Ok(())
}
