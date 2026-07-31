//! `airis models` — List available models.

use airis_core::prelude::*;

pub async fn execute(
    provider: &Option<String>,
    refresh: bool,
    registry: &airis_models::ModelRegistryImpl,
) -> AirisResult<()> {
    if refresh {
        println!("Refreshing model cache...");
        println!("Model refresh coming soon.");
        return Ok(());
    }

    let models = registry.list_models();

    if models.is_empty() {
        println!("No models configured.");
        println!("Configure providers in ~/.config/airis/config.toml");
        return Ok(());
    }

    let filtered: Vec<_> = match provider {
        Some(p) => models
            .into_iter()
            .filter(|m| m.provider.as_str() == p)
            .collect(),
        None => models,
    };

    if filtered.is_empty() {
        println!("No models found for provider: {:?}", provider);
        return Ok(());
    }

    println!("Available models:");
    let mut current_provider = String::new();

    for model in &filtered {
        if model.provider.as_str() != current_provider {
            current_provider = model.provider.as_str().to_string();
            println!("\n  [{}]", model.provider);
        }
        println!(
            "    {} — context: {}, tokens: {}",
            model.id, model.capabilities.context_window, model.capabilities.max_tokens
        );
    }

    Ok(())
}
