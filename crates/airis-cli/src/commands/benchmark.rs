//! `airis benchmark` — Run performance benchmarks.

use airis_core::prelude::*;
use std::time::Instant;

pub async fn execute(
    suite: &str,
    warmup: usize,
    iterations: usize,
) -> AirisResult<()> {
    println!("AIRIS-CLI Benchmark Suite");
    println!("Suite: {}", suite);
    println!("Warmup: {}, Iterations: {}", warmup, iterations);
    println!();

    match suite {
        "startup" => {
            benchmark_startup(warmup, iterations).await?;
        }
        "all" => {
            benchmark_startup(warmup, iterations).await?;
        }
        other => {
            println!("Unknown benchmark suite: {}", other);
        }
    }

    Ok(())
}

async fn benchmark_startup(warmup: usize, iterations: usize) -> AirisResult<()> {
    println!("=== Startup Performance ===");

    for i in 0..(warmup + iterations) {
        let start = Instant::now();

        // Measure config loading time
        let _config = airis_config::ConfigManager::new().await?;

        let elapsed = start.elapsed();
        let label = if i < warmup { " (warmup)" } else { "" };

        println!("  Config load: {:6.2?}{}", elapsed, label);
    }

    Ok(())
}
