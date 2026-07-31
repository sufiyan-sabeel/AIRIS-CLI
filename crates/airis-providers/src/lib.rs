//! # AIRIS Providers
//!
//! Provider implementations for the AIRIS-CLI system. Each provider wraps a
//! remote model API (OpenAI-compatible, Anthropic, Ollama, LM Studio, Gemini)
//! and implements the [`Provider`] trait from `airis-core`.

mod openai_compat;
mod anthropic;
mod ollama;
mod lmstudio;
mod gemini;

use airis_core::prelude::*;
use std::collections::HashMap;
use std::time::Duration;

// ─── Provider Factory ─────────────────────────────────────────────────────

/// Creates provider instances from configuration.
///
/// # Usage
///
/// ```ignore
/// let provider = ProviderFactory::create("openai", &config)?;
/// let models = provider.list_models().await?;
/// ```
pub struct ProviderFactory;

impl ProviderFactory {
    /// Create a provider by name with the given configuration.
    ///
    /// Supported `name` values:
    /// - `"openai"` — OpenAI / OpenRouter / DeepSeek / Groq / Together
    /// - `"anthropic"` — Anthropic Claude
    /// - `"ollama"` — Local Ollama
    /// - `"lmstudio"` — LM Studio / local GGUF
    /// - `"gemini"` — Google Gemini
    ///
    /// # Errors
    ///
    /// Returns [`AirisError::ProviderNotAvailable`] for unknown provider names.
    pub fn create(name: &str, config: &ProviderConfig) -> AirisResult<Box<dyn Provider>> {
        let base_url = config
            .base_url
            .clone()
            .unwrap_or_else(|| default_base_url(name));
        let timeout = Duration::from_secs(config.timeout_secs.max(5));
        let client = build_client(&base_url, config.api_key.as_deref(), timeout, name)?;

        match name {
            "openai" | "deepseek" | "groq" | "together" | "openrouter" => {
                Ok(Box::new(openai_compat::OpenAICompatibleProvider::new(
                    ProviderId(name.to_string()),
                    name.to_string(),
                    client,
                    base_url,
                    config.api_key.clone(),
                    config.models.clone(),
                )))
            }
            "anthropic" => Ok(Box::new(anthropic::AnthropicProvider::new(
                client,
                base_url,
                config.api_key.clone(),
                config.models.clone(),
            ))),
            "ollama" => Ok(Box::new(ollama::OllamaProvider::new(
                client,
                base_url,
                config.models.clone(),
            ))),
            "lmstudio" => Ok(Box::new(lmstudio::LMStudioProvider::new(
                client,
                base_url,
                config.models.clone(),
            ))),
            "gemini" => Ok(Box::new(gemini::GeminiProvider::new(
                client,
                base_url,
                config.api_key.clone(),
                config.models.clone(),
            ))),
            other => Err(AirisError::ProviderNotAvailable(other.to_string())),
        }
    }

    /// Create all providers from a map of provider configs.
    ///
    /// Providers that fail to create are silently skipped.
    pub fn create_all(
        configs: &HashMap<String, ProviderConfig>,
    ) -> Vec<Box<dyn Provider>> {
        configs
            .iter()
            .filter_map(|(name, cfg)| Self::create(name, cfg).ok())
            .collect()
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

fn default_base_url(name: &str) -> String {
    match name {
        "openai" => "https://api.openai.com/v1".into(),
        "openrouter" => "https://openrouter.ai/api/v1".into(),
        "deepseek" => "https://api.deepseek.com/v1".into(),
        "groq" => "https://api.groq.com/openai/v1".into(),
        "together" => "https://api.together.xyz/v1".into(),
        "anthropic" => "https://api.anthropic.com/v1".into(),
        "ollama" => "http://localhost:11434".into(),
        "lmstudio" => "http://localhost:1234/v1".into(),
        "gemini" => "https://generativelanguage.googleapis.com/v1beta".into(),
        _ => "https://api.openai.com/v1".into(),
    }
}

fn build_client(
    _base_url: &str,
    api_key: Option<&str>,
    timeout: Duration,
    _name: &str,
) -> AirisResult<reqwest::Client> {
    let mut headers = reqwest::header::HeaderMap::new();
    if let Some(key) = api_key {
        let header_value = format!("Bearer {}", key);
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&header_value).map_err(|e| {
                AirisError::Config(format!("Invalid API key header: {}", e))
            })?,
        );
    }
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(timeout)
        .build()
        .map_err(|e| AirisError::Http(format!("Failed to build HTTP client: {}", e)))?;

    Ok(client)
}

/// Build a response `Message` from an assistant text string.
pub(crate) fn assistant_message(text: impl Into<String>) -> Message {
    Message::assistant(text)
}

/// POST JSON to a URL and parse the JSON response.
pub(crate) async fn post_json(
    client: &reqwest::Client,
    url: &str,
    body: &serde_json::Value,
) -> AirisResult<serde_json::Value> {
    let resp = client
        .post(url)
        .json(body)
        .send()
        .await
        .map_err(|e| AirisError::Http(format!("Request failed: {}", e)))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| AirisError::Http(format!("Failed to read response: {}", e)))?;

    if !status.is_success() {
        return Err(AirisError::Provider {
            provider: "unknown".into(),
            message: format!("HTTP {}: {}", status.as_u16(), text),
        });
    }

    serde_json::from_str(&text).map_err(|e| {
        AirisError::ModelResponse(format!("Failed to parse JSON response: {} body={}", e, text))
    })
}

/// Build a `Message` with tool calls from raw tool call data.
pub(crate) fn tool_call_message(
    id: &str,
    name: &str,
    arguments: &serde_json::Value,
) -> Message {
    Message {
        role: MessageRole::Assistant,
        content: vec![ContentPart::ToolCall {
            id: id.to_string(),
            name: name.to_string(),
            arguments: arguments.clone(),
        }],
        name: None,
        timestamp: chrono::Utc::now(),
        tokens: None,
    }
}

/// Build a `Message` with a tool result.
#[allow(dead_code)]
pub(crate) fn tool_result_message(id: &str, content: String) -> Message {
    Message {
        role: MessageRole::Tool,
        content: vec![ContentPart::ToolResult {
            id: id.to_string(),
            content,
        }],
        name: None,
        timestamp: chrono::Utc::now(),
        tokens: None,
    }
}
