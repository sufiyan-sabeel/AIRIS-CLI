//! `airis search` — Search codebase or web.

use airis_core::prelude::*;

pub async fn execute(
    query: &str,
    code_search: bool,
    limit: usize,
    config: &airis_config::ConfigManager,
    indexer: &airis_indexer::IndexerImpl,
) -> AirisResult<()> {
    if code_search {
        println!("Searching codebase for: {}", query);

        let results = indexer.search(query, limit).await?;

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
