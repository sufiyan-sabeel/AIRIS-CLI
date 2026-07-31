//! `airis fix` — Fix code issues automatically.

use airis_core::prelude::*;

/// Execute the fix command.
pub async fn execute(
    target: &Option<String>,
    auto_apply: bool,
    config: &airis_config::ConfigManager,
    agent: &airis_agent::AgentImpl,
    tools: &airis_tools::ToolRegistryImpl,
) -> AirisResult<()> {
    let target = target.as_deref().unwrap_or(".");
    println!("Analyzing {} for issues...", target);

    let context = AgentContext {
        max_steps: 15,
        ..AgentContext::default()
    };

    let result = agent
        .run(&format!("Analyze and fix code issues in: {}", target), context)
        .await?;

    if result.success {
        println!("{}", result.output);
        if auto_apply {
            println!("Fixes applied automatically.");
        } else {
            println!("Review the changes above. Use --yes to auto-apply.");
        }
    } else {
        eprintln!("Fix failed: {}", result.output);
    }

    Ok(())
}
