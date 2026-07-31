//! `airis review` — Review code for issues.

use airis_core::prelude::*;
use crate::CommandContext;

pub async fn execute(
    target: &Option<String>,
    severity: &str,
    ctx: &CommandContext,
) -> AirisResult<()> {
    let target = target.as_deref().unwrap_or(".");
    println!("Reviewing {} (severity: {})...", target, severity);

    let result = ctx
        .runner
        .run(
            &format!(
                "Review the following code for bugs, security issues, and code quality problems. \
                 Focus on {severity} severity issues:\n\n{target}"
            ),
            AgentContext {
                max_steps: 10,
                ..AgentContext::default()
            },
        )
        .await?;

    println!("{}", result.output);
    Ok(())
}
