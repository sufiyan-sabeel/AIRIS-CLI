//! `airis plan` — Plan a task.

use airis_core::prelude::*;
use std::path::PathBuf;

pub async fn execute(
    task: &str,
    output: &Option<PathBuf>,
    execute_plan: bool,
    config: &airis_config::ConfigManager,
    agent: &airis_agent::AgentImpl,
    workspace: &airis_workspace::WorkspaceManagerImpl,
) -> AirisResult<()> {
    println!("Planning task: {}", task);
    println!();

    // Generate plan using the agent
    let context = AgentContext {
        max_steps: 5,
        ..AgentContext::default()
    };

    let result = agent
        .run(
            &format!(
                "Create a detailed step-by-step plan to accomplish the following task:\n\n{}\n\n\
                 Format the plan as numbered steps. For each step, describe what needs to be done, \
                 what tools are needed, and dependencies between steps.",
                task
            ),
            context,
        )
        .await?;

    println!("=== Plan ===\n");
    println!("{}", result.output);

    // Save to file if requested
    if let Some(path) = output {
        tokio::fs::write(path, &result.output).await?;
        println!("\nPlan saved to: {:?}", path);
    }

    // Execute if requested
    if execute_plan {
        println!("\nExecuting plan...");
        let exec_context = AgentContext {
            max_steps: 25,
            ..AgentContext::default()
        };
        let exec_result = agent.run(task, exec_context).await?;
        println!("\n=== Result ===\n{}", exec_result.output);
    }

    Ok(())
}
