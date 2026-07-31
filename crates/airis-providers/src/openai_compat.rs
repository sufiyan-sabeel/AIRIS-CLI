//! OpenAI-compatible REST provider.
//!
//! Supports OpenAI, OpenRouter, DeepSeek, Groq, Together, and any other
//! provider that exposes an OpenAI-compatible `/v1/chat/completions` API.

use airis_core::prelude::*;
use async_trait::async_trait;
use reqwest_eventsource::{EventSource, RequestBuilderExt};

/// Provider for OpenAI-compatible API endpoints.
pub struct OpenAICompatibleProvider {
    id: ProviderId,
    display_name: String,
    client: reqwest::Client,
    base_url: String,
    api_key: Option<String>,
    models: Vec<String>,
}

impl OpenAICompatibleProvider {
    /// Create a new OpenAI-compatible provider.
    pub fn new(
        id: ProviderId,
        display_name: impl Into<String>,
        client: reqwest::Client,
        base_url: String,
        api_key: Option<String>,
        models: Vec<String>,
    ) -> Self {
        Self {
            id,
            display_name: display_name.into(),
            client,
            base_url,
            api_key,
            models,
        }
    }

    /// Build the chat completions URL.
    fn chat_url(&self) -> String {
        format!("{}/chat/completions", self.base_url)
    }

    fn models_url(&self) -> String {
        format!("{}/models", self.base_url)
    }

    fn embed_url(&self) -> String {
        format!("{}/embeddings", self.base_url)
    }

    /// Convert AIRIS messages to OpenAI API messages.
    fn build_openai_messages(messages: &[Message]) -> Vec<serde_json::Value> {
        let mut result: Vec<serde_json::Value> = Vec::new();

        for msg in messages {
            let role = match msg.role {
                MessageRole::System => "system",
                MessageRole::User => "user",
                MessageRole::Assistant => "assistant",
                MessageRole::Tool => "tool",
            };

            // Check for tool calls or tool results in content parts
            let has_tool_content = msg.content.iter().any(|p| {
                matches!(p, ContentPart::ToolCall { .. } | ContentPart::ToolResult { .. })
            });

            if has_tool_content {
                for part in &msg.content {
                    match part {
                        ContentPart::ToolCall { id, name, arguments } => {
                            result.push(serde_json::json!({
                                "role": "assistant",
                                "content": null,
                                "tool_calls": [{
                                    "id": id,
                                    "type": "function",
                                    "function": {
                                        "name": name,
                                        "arguments": arguments.to_string(),
                                    }
                                }]
                            }));
                        }
                        ContentPart::ToolResult { id, content } => {
                            result.push(serde_json::json!({
                                "role": "tool",
                                "tool_call_id": id,
                                "content": content,
                            }));
                        }
                        _ => {}
                    }
                }
            } else {
                // Simple text content — handle vision parts
                let content: Vec<serde_json::Value> = msg
                    .content
                    .iter()
                    .map(|part| match part {
                        ContentPart::Text { text } => {
                            serde_json::json!({ "type": "text", "text": text })
                        }
                        ContentPart::Image { url, detail } => {
                            let mut img = serde_json::json!({
                                "type": "image_url",
                                "image_url": { "url": url }
                            });
                            if let Some(d) = detail {
                                img["image_url"]["detail"] = serde_json::json!(d);
                            }
                            img
                        }
                        _ => serde_json::json!({ "type": "text", "text": "" }),
                    })
                    .collect();

                if content.len() == 1 {
                    // Simple string form
                    let text = content[0]["text"].as_str().unwrap_or("").to_string();
                    result.push(serde_json::json!({
                        "role": role,
                        "content": text,
                    }));
                } else {
                    result.push(serde_json::json!({
                        "role": role,
                        "content": content,
                    }));
                }
            }
        }

        result
    }

    /// Build OpenAI-style request body.
    fn build_request_body(
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
        stream: bool,
    ) -> serde_json::Value {
        let oai_messages = Self::build_openai_messages(messages);

        let mut body = serde_json::json!({
            "model": model.as_str(),
            "messages": oai_messages,
            "stream": stream,
            "temperature": params.temperature,
            "top_p": params.top_p,
        });

        if let Some(max_tokens) = params.max_tokens {
            body["max_tokens"] = serde_json::json!(max_tokens);
        }

        if !params.stop_sequences.is_empty() {
            body["stop"] = serde_json::json!(params.stop_sequences);
        }

        if let Some(fp) = params.frequency_penalty {
            body["frequency_penalty"] = serde_json::json!(fp);
        }

        if let Some(pp) = params.presence_penalty {
            body["presence_penalty"] = serde_json::json!(pp);
        }

        if let Some(seed) = params.seed {
            body["seed"] = serde_json::json!(seed);
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

    /// Parse an OpenAI chat completion response into a Message.
    fn parse_chat_response(
        &self,
        data: &serde_json::Value,
    ) -> AirisResult<Message> {
        let choices = data["choices"]
            .as_array()
            .ok_or_else(|| AirisError::ModelResponse("Missing choices in response".into()))?;

        let choice = choices
            .first()
            .ok_or_else(|| AirisError::ModelResponse("Empty choices in response".into()))?;

        let delta = choice.get("delta");
        let message = choice.get("message");

        // Prefer message (non-streaming) over delta (streaming)
        let msg_obj = message.or(delta);

        if let Some(msg) = msg_obj {
            // Check for tool calls
            if let Some(tool_calls) = msg["tool_calls"].as_array() {
                if let Some(tc) = tool_calls.first() {
                    let id = tc["id"].as_str().unwrap_or("call_unknown");
                    let name = tc["function"]["name"].as_str().unwrap_or("unknown");
                    let arguments = tc["function"]["arguments"]
                        .as_str()
                        .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                        .unwrap_or(serde_json::Value::Null);
                    return Ok(tool_call_message(id, name, &arguments));
                }
            }

            // Text content
            let content = msg["content"].as_str().unwrap_or("").to_string();
            let mut assistant = assistant_message(&content);

            // Extract usage if present
            if let Some(usage) = data.get("usage") {
                assistant.tokens = Some(
                    usage["total_tokens"].as_u64().unwrap_or(0) as usize,
                );
            }

            return Ok(assistant);
        }

        Ok(assistant_message(""))
    }

    /// Parse a streaming chunk from an SSE event.
    fn parse_stream_chunk(
        &self,
        content_delta: &str,
        tool_calls: &mut Vec<(String, String, serde_json::Value)>,
        handler: &mut Box<dyn StreamHandler>,
    ) {
        if !content_delta.is_empty() {
            handler.on_chunk(content_delta);
        }
    }
}

#[async_trait]
impl Provider for OpenAICompatibleProvider {
    fn id(&self) -> ProviderId {
        self.id.clone()
    }

    fn display_name(&self) -> &str {
        &self.display_name
    }

    async fn list_models(&self) -> AirisResult<Vec<ModelConfig>> {
        if !self.models.is_empty() {
            return Ok(self
                .models
                .iter()
                .map(|m| {
                    let is_large = m.contains("vision") || m.contains("turbo");
                    let is_embedding = m.contains("embedding") || m.contains("ada");
                    ModelConfig {
                        id: ModelId(m.clone()),
                        provider: self.id.clone(),
                        display_name: m.clone(),
                        capabilities: ModelCapabilities {
                            supports_embeddings: is_embedding,
                            supports_vision: m.contains("vision") || m.contains("gpt-4o"),
                            ..ModelCapabilities::default()
                        },
                        default_params: ModelParams::default(),
                        pricing: None,
                    }
                })
                .collect());
        }

        // Try fetching from the API
        let url = self.models_url();
        match self.client.get(&url).send().await {
            Ok(resp) => {
                let data: serde_json::Value = resp.json().await.map_err(|e| {
                    AirisError::Http(format!("Failed to parse models: {}", e))
                })?;
                let models = data["data"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| {
                                let id = m["id"].as_str()?;
                                let owned = m["id"].as_str()?.to_string();
                                let is_embedding = owned.contains("embedding") || owned.contains("ada");
                                Some(ModelConfig {
                                    id: ModelId(owned),
                                    provider: self.id.clone(),
                                    display_name: id.to_string(),
                                    capabilities: ModelCapabilities {
                                        supports_embeddings: is_embedding,
                                        ..ModelCapabilities::default()
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
                // If we can't reach the API, return default model list
                tracing::warn!("Failed to fetch models from {}: {}", url, e);
                Ok(vec![ModelConfig {
                    id: ModelId("gpt-4o".into()),
                    provider: self.id.clone(),
                    display_name: "GPT-4o".into(),
                    capabilities: ModelCapabilities {
                        supports_vision: true,
                        ..ModelCapabilities::default()
                    },
                    default_params: ModelParams::default(),
                    pricing: None,
                }])
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

        let mut finish_reason = String::new();
        let mut usage: Option<TokenUsage> = None;
        let mut content_parts: Vec<String> = Vec::new();
        let mut tool_calls: Vec<(String, String, serde_json::Value)> = Vec::new();

        loop {
            match es.next().await {
                Some(Ok(reqwest_eventsource::Event::Open)) => {
                    // Connection opened, nothing to do
                }
                Some(Ok(reqwest_eventsource::Event::Message(msg))) => {
                    if msg.data == "[DONE]" {
                        break;
                    }

                    match serde_json::from_str::<serde_json::Value>(&msg.data) {
                        Ok(data) => {
                            if let Some(choices) = data["choices"].as_array() {
                                for choice in choices {
                                    let delta = &choice["delta"];
                                    let index = choice["index"].as_u64().unwrap_or(0);
                                    let finish = choice["finish_reason"]
                                        .as_str()
                                        .unwrap_or("")
                                        .to_string();

                                    if !finish.is_empty() {
                                        finish_reason = finish;
                                    }

                                    // Text content
                                    if let Some(content) = delta["content"].as_str() {
                                        if !content.is_empty() {
                                            content_parts.push(content.to_string());
                                            handler.on_chunk(content);
                                        }
                                    }

                                    // Tool calls
                                    if let Some(tcs) = delta["tool_calls"].as_array() {
                                        for tc in tcs {
                                            let id = tc["id"].as_str().unwrap_or("").to_string();
                                            let name = tc["function"]["name"]
                                                .as_str()
                                                .unwrap_or("")
                                                .to_string();
                                            let args_str = tc["function"]["arguments"]
                                                .as_str()
                                                .unwrap_or("");
                                            let args: serde_json::Value =
                                                serde_json::from_str(args_str)
                                                    .unwrap_or(serde_json::Value::Null);

                                            if !id.is_empty() && !name.is_empty() {
                                                tool_calls.push((id.clone(), name.clone(), args.clone()));
                                                handler.on_tool_call(&id, &name, &args);
                                            }
                                        }
                                    }

                                    // Usage info (last chunk)
                                    if let Some(u) = data.get("usage") {
                                        usage = Some(TokenUsage {
                                            prompt_tokens: u["prompt_tokens"]
                                                .as_u64()
                                                .unwrap_or(0) as usize,
                                            completion_tokens: u["completion_tokens"]
                                                .as_u64()
                                                .unwrap_or(0) as usize,
                                            total_tokens: u["total_tokens"]
                                                .as_u64()
                                                .unwrap_or(0) as usize,
                                            cost: None,
                                        });
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse SSE chunk: {}", e);
                        }
                    }
                }
                Some(Ok(reqwest_eventsource::Event::Open)) => {}
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

        // Signal completion and build final message
        handler.on_done(&finish_reason, usage.clone());

        // Determine the final message
        if !tool_calls.is_empty() {
            // Return the first tool call as the message
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

        let embeddings = data["data"]
            .as_array()
            .ok_or_else(|| AirisError::ModelResponse("Missing embedding data".into()))?
            .iter()
            .map(|item| {
                item["embedding"]
                    .as_array()
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

    async fn count_tokens(&self, model: &ModelId, text: &str) -> AirisResult<usize> {
        // Simple heuristic: ~4 characters per token for most OpenAI models
        // In production, use tiktoken-rs or similar
        let approx = (text.len() + 3) / 4;
        // Some providers have a tokenize endpoint
        // Try using the tokenize endpoint if available
        let tokenize_url = format!("{}/tokenize", self.base_url);
        if model.as_str().contains("deepseek") {
            let body = serde_json::json!({
                "model": model.as_str(),
                "input": text,
            });
            if let Ok(data) = post_json(&self.client, &tokenize_url, &body).await {
                if let Some(tokens) = data["tokens"].as_array() {
                    return Ok(tokens.len());
                }
            }
        }

        Ok(approx)
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            streaming: true,
            tools: true,
            vision: self.id.as_str().contains("openai") || self.id.as_str().contains("together"),
            embeddings: true,
            json_mode: true,
        }
    }

    fn box_clone(&self) -> Box<dyn Provider> {
        Box::new(Self {
            id: self.id.clone(),
            display_name: self.display_name.clone(),
            client: self.client.clone(),
            base_url: self.base_url.clone(),
            api_key: self.api_key.clone(),
            models: self.models.clone(),
        })
    }
}
