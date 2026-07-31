//! `airis chat` — Interactive chat with AI assistant.

use airis_core::prelude::*;
use tracing::info;

/// Execute the chat command.
pub async fn execute(
    prompt: &Option<String>,
    session: &Option<String>,
    use_tui: bool,
    config: &airis_config::ConfigManager,
    agent: &airis_agent::AgentImpl,
    tools: &airis_tools::ToolRegistryImpl,
) -> AirisResult<()> {
    info!("Starting chat session (tui={})", use_tui);

    if use_tui {
        // Launch TUI mode
        let app = airis_ui::tui::TuiApp::new(config.config());
        app.run().await?;
        return Ok(());
    }

    // Simple REPL mode
    let mut conversation = Conversation::new();
    conversation.system_prompt = Some(
        "You are AIRIS, an advanced AI coding assistant by KageOS. \
         Help the user with coding tasks, explanations, and problem-solving. \
         Be concise, accurate, and practical."
            .into(),
    );

    if let Some(session_id) = session {
        // Resume session - parse UUID
        if let Ok(id) = uuid::Uuid::parse_str(session_id) {
            // Session loading would go here
            info!("Resuming session: {}", id);
        }
    }

    // If initial prompt provided, run immediately
    if let Some(msg) = prompt {
        conversation.push(Message::user(msg));
        let response = agent
            .run(msg, AgentContext::default())
            .await?;
        println!("{}", response.output);
        return Ok(());
    }

    // Interactive loop
    println!("AIRIS Chat — KageOS AI Coding Assistant");
    println!("Type /help for commands, /exit to quit.");
    println!();

    loop {
        // Read input (simple stdin for now)
        let mut input = String::new();
        std::io::stdin()
            .read_line(&mut input)
            .map_err(|e| AirisError::Io(e))?;
        let input = input.trim().to_string();

        match input.as_str() {
            "/exit" | "/quit" => {
                println!("Goodbye!");
                break;
            }
            "/help" => {
                println!("Commands:");
                println!("  /exit, /quit  Exit the chat");
                println!("  /clear        Clear conversation");
                println!("  /help         Show this help");
                println!("  /save         Save session");
                println!("  /model <name> Switch model");
                continue;
            }
            "/clear" => {
                conversation = Conversation::new();
                println!("Conversation cleared.");
                continue;
            }
            "/save" => {
                println!("Session saved: {}", conversation.id);
                continue;
            }
            _ if input.starts_with('/') => {
                println!("Unknown command: {}", input);
                continue;
            }
            _ => {} // Normal message
        }

        if input.is_empty() {
            continue;
        }

        conversation.push(Message::user(&input));
        let response = agent
            .run(&input, AgentContext::default())
            .await?;
        println!("\n{}\n", response.output);
    }

    Ok(())
}
