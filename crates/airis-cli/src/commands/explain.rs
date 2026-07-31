//! `airis explain` — Explain code or concepts.

use crate::CommandContext;
use airis_core::prelude::*;

/// Execute the explain command.
pub async fn execute(
    target: &str,
    detail: &str,
    ctx: &CommandContext,
) -> AirisResult<()> {
    let detail_instruction = match detail {
        "brief" => "Provide a brief, high-level explanation (2-3 sentences).",
        "detailed" => "Provide a thorough, in-depth explanation with examples and edge cases.",
        _ => "Provide a clear, balanced explanation with moderate detail.",
    };

    let result = ctx
        .runner
        .run(
            &format!(
                "Explain the following code/concept:\n\n{}\n\n{}",
                target, detail_instruction
            ),
            AgentContext::default(),
        )
        .await?;

    println!("{}", result.output);
    Ok(())
}
