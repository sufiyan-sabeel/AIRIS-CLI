//! `airis review` — Review code for issues.

use airis_core::prelude::*;

pub async fn execute(
    target: &Option<String>,
    severity: &str,
    config: &airis_config::ConfigManager,
    agent: &airis_agent::AgentImpl,
    workspace: &airis_workspace::WorkspaceManagerImpl,
    indexer: &airis_indexer::IndexerImpl,
) -> AirisResult<()> {
    let target = target.as_deref().unwrap_or(".");
    println!("Reviewing {} (severity: {})...", target, severity);

    let context = AgentContext {
        max_steps: 10,
        ..AgentContext::default()
    };

    let result = agent
        .run(&format!("Review the following code for bugs, security issues, and code quality problems. Focus on {severity} severity issues:\n\n{target}"), context)
        .await?;

    println!("{}", result.output);
    Ok(())
}
