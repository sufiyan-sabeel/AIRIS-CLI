//! `airis index` — Index workspace for search.

use airis_core::prelude::*;
use std::path::PathBuf;

pub async fn execute(
    path: &Option<PathBuf>,
    refresh: bool,
    show_stats: bool,
    indexer: &airis_indexer::IndexerImpl,
    workspace: &airis_workspace::WorkspaceManagerImpl,
) -> AirisResult<()> {
    if show_stats {
        let stats = indexer.stats().await?;
        println!("Index Statistics:");
        println!("  Files indexed:    {}", stats.total_files);
        println!("  Total chunks:     {}", stats.total_chunks);
        println!("  Total symbols:    {}", stats.total_symbols);
        println!("  Indexed bytes:    {}", stats.indexed_bytes);
        println!("  Languages:        {}", stats.languages.join(", "));
        println!("  Last indexed:     {:?}", stats.last_indexed);
        return Ok(());
    }

    let root = path.clone().unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });

    if refresh {
        println!("Re-indexing {}...", root.display());
    } else {
        println!("Indexing {}...", root.display());
    }

    let stats = indexer.index(&root).await?;
    println!(
        "Indexed {} files ({} symbols, {} chunks, {} bytes)",
        stats.total_files, stats.total_symbols, stats.total_chunks, stats.indexed_bytes
    );

    Ok(())
}
