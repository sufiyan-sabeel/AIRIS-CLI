//! `airis search` — Search codebase or web.

use airis_core::prelude::*;
use crate::CommandContext;

pub async fn execute(
    query: &str,
    code: bool,
    limit: usize,
    ctx: &CommandContext,
) -> AirisResult<()> {
    if code {
        println!("Searching codebase for: {}", query);

        let results = ctx.indexer.search(query, limit).await?;

        if results.is_empty() {
            println!("No results found.");
            return Ok(());
        }

        for (i, result) in results.iter().enumerate() {
            println!(
                "{}. {}:{}:{}",
                i + 1,
                result.file.display(),
                result.line,
                result.column
            );
            // Show context
            for line in &result.context_before {
                println!("  {}", line);
            }
            println!("> {}", result.line_content);
            for line in &result.context_after {
                println!("  {}", line);
            }
            println!();
        }
    } else {
        println!("Web search currently requires API provider configuration.");
        println!("Use `airis search --code <query>` for local code search.");
    }

    Ok(())
}
