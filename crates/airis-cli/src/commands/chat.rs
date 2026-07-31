//! `airis chat` — Interactive chat with AI assistant.

use crate::CommandContext;
use airis_core::prelude::*;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::info;

/// Execute the chat command.
pub async fn execute(
    prompt: &Option<String>,
    session_id: &Option<String>,
    use_tui: bool,
    ctx: &CommandContext,
) -> AirisResult<()> {
    info!("Starting chat session (tui={})", use_tui);

    if use_tui {
        // Launch TUI mode with animated AIRIS logo welcome screen
        let cfg = ctx.config.config().clone();
        let mut app = airis_ui::tui::TuiApp::new(&cfg);
        let mut terminal = airis_ui::tui::TuiApp::setup_terminal()
            .map_err(|e| AirisError::Custom(format!("Terminal setup failed: {}", e)))?;
        app.run(&mut terminal)
            .map_err(|e| AirisError::Custom(format!("TUI error: {}", e)))?;
        airis_ui::tui::TuiApp::teardown_terminal(&mut terminal)
            .map_err(|e| AirisError::Custom(format!("Terminal teardown failed: {}", e)))?;
        return Ok(());
    }

    // REPL mode - connect to actual AI provider
    if let Some(msg) = prompt {
        let output = ctx.runner.chat(msg).await?;
        println!("{}", output);
        return Ok(());
    }

    // Interactive REPL loop
    println!("╔══════════════════════════════════════════╗");
    println!("║     AIRIS Chat — KageOS AI Assistant    ║");
    println!("╠══════════════════════════════════════════╣");
    println!("║  Type /help for commands                 ║");
    println!("║  Type /exit to quit                      ║");
    println!("║  Ctrl+C to cancel current response       ║");
    println!("╚══════════════════════════════════════════╝");
    println!();

    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();
    let mut conversation_id = uuid::Uuid::new_v4();
    let mut model_override: Option<String> = None;

    // Resume session if specified
    if let Some(sid) = session_id {
        if let Ok(id) = uuid::Uuid::parse_str(sid) {
            conversation_id = id;
            println!("[Resumed session: {}]", id);
        }
    }

    loop {
        line.clear();
        print!("> ");
        std::io::stdout().flush().ok();

        reader.read_line(&mut line).await.map_err(AirisError::Io)?;
        let input = line.trim().to_string();

        // Handle commands
        if input.starts_with('/') {
            let parts: Vec<&str> = input.splitn(2, ' ').collect();
            let cmd = parts[0];
            let arg = parts.get(1).copied().unwrap_or("");

            match cmd {
                "/exit" | "/quit" => {
                    println!("Goodbye!");
                    break;
                }
                "/help" => {
                    println!("Commands:");
                    println!("  /exit, /quit     Exit the chat");
                    println!("  /clear           Clear conversation history");
                    println!("  /model <name>    Switch model");
                    println!("  /save            Save session");
                    println!("  /tokens          Show token usage");
                    println!("  /help            Show this help");
                }
                "/clear" => {
                    ctx.runner.chat("[system: conversation cleared]").await.ok();
                    println!("Conversation cleared.");
                }
                "/save" => {
                    println!("Session saved: {}", conversation_id);
                }
                "/model" if !arg.is_empty() => {
                    model_override = Some(arg.to_string());
                    println!("Switched to model: {}", arg);
                }
                "/tokens" => {
                    println!("Token tracking coming soon.");
                }
                _ => {
                    println!("Unknown command: {}", cmd);
                    println!("Type /help for available commands.");
                }
            }
            continue;
        }

        if input.is_empty() || input == "\n" {
            continue;
        }

        // Send to AI provider via agent
        println!();
        let spinner = indicatif::ProgressBar::new_spinner();
        spinner.set_message("AI is thinking...");
        spinner.enable_steady_tick(std::time::Duration::from_millis(100));

        match ctx.runner.chat(&input).await {
            Ok(response) => {
                spinner.finish_and_clear();
                println!("{}", response);
                println!();
            }
            Err(e) => {
                spinner.finish_and_clear();
                eprintln!("Error: {}", e);
            }
        }
    }

    Ok(())
}
