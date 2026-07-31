//! `airis memory` — View or search memory.

use crate::CommandContext;
use airis_core::prelude::*;

pub async fn execute(
    query: &Option<String>,
    list: bool,
    clear: bool,
    stats: bool,
    memory_type: &Option<String>,
    ctx: &CommandContext,
) -> AirisResult<()> {
    if clear {
        println!("Clearing memory...");
        // Memory clearing would go here
        println!("Memory cleared.");
        return Ok(());
    }

    if stats {
        let mem_stats = ctx.memory.stats().await?;
        println!("Memory Statistics:");
        println!("  Total entries:  {}", mem_stats.total_entries);
        println!("  Episodic:       {}", mem_stats.episodic);
        println!("  Semantic:       {}", mem_stats.semantic);
        println!("  Procedural:     {}", mem_stats.procedural);
        println!("  Working:        {}", mem_stats.working);
        return Ok(());
    }

    if list {
        let mtype = memory_type.as_deref().map(|t| match t {
            "episodic" => MemoryType::Episodic,
            "semantic" => MemoryType::Semantic,
            "procedural" => MemoryType::Procedural,
            "working" => MemoryType::Working,
            _ => MemoryType::Semantic,
        });

        let entries = match mtype {
            Some(t) => ctx.memory.recall_by_type(t, 20).await?,
            None => ctx.memory.recall("", 20).await?,
        };

        if entries.is_empty() {
            println!("No memories found.");
            return Ok(());
        }

        for entry in &entries {
            let preview: String = entry.content.chars().take(100).collect();
            println!(
                "  [{:?}] {}: {}",
                entry.entry_type, entry.key, preview
            );
        }
        return Ok(());
    }

    if let Some(q) = query {
        let entries = ctx.memory.recall(q, 10).await?;
        if entries.is_empty() {
            println!("No memories found for: {}", q);
            return Ok(());
        }

        println!("Memories matching '{}':", q);
        for entry in &entries {
            println!(
                "--- [{:.8}] {:?} (importance: {:.2})",
                entry.id, entry.entry_type, entry.importance
            );
            println!("{}", entry.content);
            println!();
        }
    }

    Ok(())
}
