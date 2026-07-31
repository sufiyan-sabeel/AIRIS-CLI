//! Ollama local provider.
//!
//! Connects to a local Ollama instance (default http://localhost:11434).
//! Uses Ollama's native API format (no API key required for local use).

use airis_core::prelude::*;
use async_trait::async_trait;
use reqwest_eventsource::{EventSource, RequestBuilderExt};

/// Provider for local Ollama instances.
pub struct OllamaProvider {
    client: reqwest::Client,
    base_url: String,
    models: Vec<String>,
}

impl OllamaProvider {
    /// Create a new Ollama local provider.
    pub fn new(
        client: reqwest::Client,
        base_url: String,
        models: Vec<String>,
    ) -> Self {
        Self {
            client,
            base_url,
            models,
        }
    }

    fn chat_url(&self) -> String {
        format!("{}/api/chat", self.base_url)
    }

    fn generate_url(&self) -> String {
        format!("{}/api/generate", self.base_url)
    }

    fn models_url(&self) -> String {
        format!("{}/api/tags", self.base_url)
    }

    fn embed_url(&self) -> String {
        format!("{}/api/embed", self.base_url)
    }

    /// Convert AIRIS messages to Ollama format.
    fn build_ollama_messages(messages: &[Message]) -> Vec<serde_json::Value> {
        messages
            .iter()
            .map(|msg| {
                let role = match msg.role {
                    MessageRole::System => "system",
                    MessageRole::User => "user",
                    MessageRole::Assistant => "assistant",
                    MessageRole::Tool => "tool",
                };

                // Build content from parts
                let content = msg.text();

                serde_json::json!({
                    "role": role,
                    "content": content,
                })
            })
            .collect()
    }

    fn build_request_body(
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
        stream: bool,
    ) -> serde_json::Value {
        let ollama_messages = Self::build_ollama_messages(messages);

        let mut body = serde_json::json!({
            "model": model.as_str(),
            "messages": ollama_messages,
            "stream": stream,
        });

        let mut options = serde_json::Map::new();

        if (params.temperature - 0.7).abs() > f64::EPSILON {
            options.insert("temperature".into(), serde_json::json!(params.temperature));
        }

        if (params.top_p - 0.95).abs() > f64::EPSILON {
            options.insert("top_p".into(), serde_json::json!(params.top_p));
        }

        if let Some(top_k) = params.top_k {
            options.insert("top_k".into(), serde_json::json!(top_k));
        }

        if let Some(max_tokens) = params.max_tokens {
            body["max_tokens"] = serde_json::json!(max_tokens as i64);
        }

        if !params.stop_sequences.is_empty() {
            body["stop"] = serde_json::json!(params.stop_sequences);
        }

        if let Some(fp) = params.frequency_penalty {
            options.insert("frequency_penalty".into(), serde_json::json!(fp));
        }

        if let Some(pp) = params.presence_penalty {
            options.insert("presence_penalty".into(), serde_json::json!(pp));
        }

        if let Some(seed) = params.seed {
            options.insert("seed".into(), serde_json::json!(seed as i64));
        }

        if !options.is_empty() {
            body["options"] = serde_json::Value::Object(options);
        }

        if !tools.is_empty() {
            let oai_tools: Vec<serde_json::Value> = tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "type": "function",
                        "function": {
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.parameters,
                        }
                    })
                })
                .collect();
            body["tools"] = serde_json::json!(oai_tools);
        }

        body
    }

    /// Parse an Ollama chat response into a Message.
    fn parse_chat_response(&self, data: &serde_json::Value) -> AirisResult<Message> {
        let content = data["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let mut msg = assistant_message(content);

        // Ollama sometimes returns tool calls in the message
        if let Some(tool_calls) = data["message"]["tool_calls"].as_array() {
            if let Some(tc) = tool_calls.first() {
                if let Some(function) = tc.get("function") {
                    let name = function["name"].as_str().unwrap_or("unknown");
                    let arguments = function["arguments"].clone();
                    return Ok(tool_call_message("call_ollama", name, &arguments));
                }
            }
        }

        if let Some(eval_count) = data.get("eval_count").and_then(|v| v.as_u64()) {
            if let Some(eval_duration) = data.get("eval_duration").and_then(|v| v.as_u64()) {
                // Optionally calculate tokens
                msg.tokens = Some(eval_count as usize);
            }
        }

        Ok(msg)
    }
}

#[async_trait]
impl Provider for OllamaProvider {
    fn id(&self) -> ProviderId {
        ProviderId("ollama".into())
    }

    fn display_name(&self) -> &str {
        "Ollama"
    }

    async fn list_models(&self) -> AirisResult<Vec<ModelConfig>> {
        if !self.models.is_empty() {
            return Ok(self
                .models
                .iter()
                .map(|m| {
                    ModelConfig {
                        id: ModelId(m.clone()),
                        provider: ProviderId("ollama".into()),
                        display_name: m.clone(),
                        capabilities: ModelCapabilities {
                            supports_streaming: true,
                            supports_tools: true,
                            supports_vision: m.contains("llava") || m.contains("vision"),
                            supports_embeddings: m.contains("embed") || m.contains("nomic"),
                            supports_function_calling: true,
                            supports_json_mode: m.contains("mistral") || m.contains("llama"),
                            max_tokens: 4096,
                            max_input_tokens: 8192,
                            context_window: 8192,
                        },
                        default_params: ModelParams::default(),
                        pricing: None, // Local, free to use
                    }
                })
                .collect());
        }

        // Fetch from Ollama API
        let url = self.models_url();
        match self.client.get(&url).send().await {
            Ok(resp) => {
                let data: serde_json::Value = resp.json().await.map_err(|e| {
                    AirisError::Http(format!("Failed to parse Ollama models: {}", e))
                })?;
                let models = data["models"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| {
                                let name = m["name"].as_str()?;
                                let full_name = name.to_string();
                                let base = name.split(':').next().unwrap_or(name).to_lowercase();
                                let is_vision = base.contains("llava") || base.contains("vision");
                                let is_embed = base.contains("embed") || base.contains("nomic");
                                Some(ModelConfig {
                                    id: ModelId(full_name),
                                    provider: ProviderId("ollama".into()),
                                    display_name: name.to_string(),
                                    capabilities: ModelCapabilities {
                                        supports_streaming: true,
                                        supports_tools: true,
                                        supports_vision: is_vision,
                                        supports_embeddings: is_embed,
                                        supports_function_calling: true,
                                        supports_json_mode: base.contains("mistral")
                                            || base.contains("llama"),
                                        max_tokens: 4096,
                                        max_input_tokens: 8192,
                                        context_window: 8192,
                                    },
                                    default_params: ModelParams::default(),
                                    pricing: None,
                                })
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                Ok(models)
            }
            Err(e) => {
                tracing::warn!("Failed to fetch models from Ollama: {}", e);
                Ok(vec![
                    ModelConfig {
                        id: ModelId("llama3.2:latest".into()),
                        provider: ProviderId("ollama".into()),
                        display_name: "Llama 3.2".into(),
                        capabilities: ModelCapabilities {
                            supports_streaming: true,
                            supports_tools: true,
                            ..ModelCapabilities::default()
                        },
                        default_params: ModelParams::default(),
                        pricing: None,
                    },
                    ModelConfig {
                        id: ModelId("mistral:latest".into()),
                        provider: ProviderId("ollama".into()),
                        display_name: "Mistral".into(),
                        capabilities: ModelCapabilities::default(),
                        default_params: ModelParams::default(),
                        pricing: None,
                    },
                ])
            }
        }
    }

    async fn model_available(&self, model: &ModelId) -> AirisResult<bool> {
        let models = self.list_models().await?;
        Ok(models.iter().any(|m| m.id == *model))
    }

    async fn complete(
        &self,
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
    ) -> AirisResult<Message> {
        let body = Self::build_request_body(model, messages, params, tools, false);
        let data = post_json(&self.client, &self.chat_url(), &body).await?;
        self.parse_chat_response(&data)
    }

    async fn complete_stream(
        &self,
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
        handler: Box<dyn StreamHandler>,
    ) -> AirisResult<Message> {
        let body = Self::build_request_body(model, messages, params, tools, true);
        let mut handler = handler;

        let mut es = self
            .client
            .post(&self.chat_url())
            .json(&body)
            .eventsource()
            .map_err(|e| AirisError::Http(format!("Failed to create event source: {}", e)))?;

        let mut content_parts: Vec<String> = Vec::new();
        let mut finish_reason = String::from("stop");
        let mut usage: Option<TokenUsage> = None;
        let mut tool_calls: Vec<(String, String, serde_json::Value)> = Vec::new();

        loop {
            match es.next().await {
                Some(Ok(reqwest_eventsource::Event::Open)) => {}
                Some(Ok(reqwest_eventsource::Event::Message(msg))) => {
                    if msg.data == "[DONE]" {
                        break;
                    }

                    match serde_json::from_str::<serde_json::Value>(&msg.data) {
                        Ok(data) => {
                            // Text content
                            if let Some(content) = data["message"]["content"].as_str() {
                                if !content.is_empty() {
                                    content_parts.push(content.to_string());
                                    handler.on_chunk(content);
                                }
                            }

                            // Check for tool calls in Ollama format
                            if let Some(tcs) = data["message"]["tool_calls"].as_array() {
                                for tc in tcs {
                                    if let Some(function) = tc.get("function") {
                                        let name = function["name"]
                                            .as_str()
                                            .unwrap_or("")
                                            .to_string();
                                        let args = function["arguments"].clone();
                                        tool_calls.push(("call_ollama".into(), name.clone(), args.clone()));
                                        handler.on_tool_call("call_ollama", &name, &args);
                                    }
                                }
                            }

                            // Done flag
                            if data.get("done").and_then(|v| v.as_bool()).unwrap_or(false) {
                                if let Some(eval_count) = data.get("eval_count").and_then(|v| v.as_u64()) {
                                    usage = Some(TokenUsage {
                                        prompt_tokens: data["prompt_eval_count"]
                                            .as_u64()
                                            .unwrap_or(0) as usize,
                                        completion_tokens: eval_count as usize,
                                        total_tokens: (data["prompt_eval_count"]
                                            .as_u64()
                                            .unwrap_or(0)
                                            + eval_count)
                                            as usize,
                                        cost: None,
                                    });
                                }
                                break;
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse Ollama chunk: {}", e);
                        }
                    }
                }
                Some(Err(e)) => {
                    match &e {
                        reqwest_eventsource::Error::StreamEnded => break,
                        _ => {
                            handler.on_error(&e.to_string());
                            return Err(AirisError::StreamInterrupted);
                        }
                    }
                }
                None => break,
            }
        }

        drop(es);

        handler.on_done(&finish_reason, usage.clone());

        if !tool_calls.is_empty() {
            let (id, name, args) = tool_calls.remove(0);
            Ok(tool_call_message(&id, &name, &args))
        } else {
            let full_content = content_parts.concat();
            let mut msg = assistant_message(full_content);
            if let Some(u) = usage {
                msg.tokens = Some(u.total_tokens);
            }
            Ok(msg)
        }
    }

    async fn embed(&self, model: &ModelId, input: &[String]) -> AirisResult<Vec<Vec<f32>>> {
        let body = serde_json::json!({
            "model": model.as_str(),
            "input": input,
        });

        let data = post_json(&self.client, &self.embed_url(), &body).await?;

        let embeddings = data["embeddings"]
            .as_array()
            .ok_or_else(|| AirisError::ModelResponse("Missing embedding data".into()))?
            .iter()
            .map(|item| {
                item.as_array()
                    .map(|arr| {
                        arr.iter()
                            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                            .collect::<Vec<f32>>()
                    })
                    .unwrap_or_default()
            })
            .collect();

        Ok(embeddings)
    }

    async fn count_tokens(&self, _model: &ModelId, text: &str) -> AirisResult<usize> {
        // Ollama doesn't have a public token counting API.
        // Use ~4 chars per token as a simple heuristic.
        let approx = (text.len() + 3) / 4;
        Ok(approx)
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            streaming: true,
            tools: true,
            vision: true,
            embeddings: true,
            json_mode: true,
        }
    }

    fn box_clone(&self) -> Box<dyn Provider> {
        Box::new(Self {
            client: self.client.clone(),
            base_url: self.base_url.clone(),
            models: self.models.clone(),
        })
    }
}
