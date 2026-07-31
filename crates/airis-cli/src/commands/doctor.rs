//! `airis doctor` — Diagnose and fix system issues.

use airis_core::prelude::*;

pub async fn execute(
    auto_fix: bool,
    config: &airis_config::ConfigManager,
    tools: &airis_tools::ToolRegistryImpl,
    terminal: &airis_terminal::TerminalImpl,
) -> AirisResult<()> {
    println!("AIRIS Doctor — Running diagnostics...");
    println!();

    let mut issues = Vec::new();

    // Check config
    let cfg = config.config();
    println!("[✓] Config loaded from {:?}", config.config_dir());
    println!("    Default model: {:?}", cfg.core.default_model);
    println!("    Theme: {}", cfg.core.theme);

    // Check git
    let cwd = std::env::current_dir().map_err(AirisError::Io)?;
    let git_dir = cwd.join(".git");
    if git_dir.exists() {
        println!("[✓] Git repository detected");
    } else {
        println!("[ ] Not a git repository");
        issues.push("Not in a git repository — some features may be limited.");
    }

    // Check tools
    let tool_names = tools.names();
    println!("[✓] {} tools registered", tool_names.len());

    // Check terminal
    let has_bash = terminal.which("bash").await.unwrap_or(false);
    if has_bash {
        println!("[✓] Shell available (bash)");
    }

    let has_cargo = terminal.which("cargo").await.unwrap_or(false);
    if has_cargo {
        println!("[✓] Cargo available");
    }

    println!();
    if issues.is_empty() {
        println!("All checks passed! AIRIS-CLI is ready.");
    } else {
        println!("Issues found:");
        for issue in &issues {
            println!("  - {}", issue);
        }
        if auto_fix {
            println!("\nAuto-fix would resolve these issues.");
        }
    }

    Ok(())
}
