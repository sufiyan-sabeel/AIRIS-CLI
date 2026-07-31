//! `airis code` — Autonomous coding agent mode.

use airis_core::prelude::*;

/// Execute the code command — autonomous coding agent.
pub async fn execute(
    task: &str,
    max_steps: usize,
    config: &airis_config::ConfigManager,
    agent: &airis_agent::AgentImpl,
    tools: &airis_tools::ToolRegistryImpl,
    workspace: &airis_workspace::WorkspaceManagerImpl,
) -> AirisResult<()> {
    let cfg = config.config();
    println!("AIRIS Coding Agent — KageOS");
    println!("Task: {}", task);
    println!("Max steps: {}", max_steps);
    println!();

    let context = AgentContext {
        max_steps,
        ..AgentContext::default()
    };

    let result = agent.run(task, context).await?;

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
