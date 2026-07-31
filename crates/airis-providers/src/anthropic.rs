//! Anthropic Claude provider.
//!
//! Implements the Anthropic Messages API for Claude models.
//! Uses `x-api-key` header for authentication and a separate `system` parameter
//! for system messages.

use airis_core::prelude::*;
use async_trait::async_trait;
use reqwest_eventsource::{EventSource, RequestBuilderExt};

/// Provider for Anthropic Claude models.
pub struct AnthropicProvider {
    client: reqwest::Client,
    base_url: String,
    api_key: Option<String>,
    models: Vec<String>,
}

impl AnthropicProvider {
    /// Create a new Anthropic Claude provider.
    pub fn new(
        client: reqwest::Client,
        base_url: String,
        api_key: Option<String>,
        models: Vec<String>,
    ) -> Self {
        Self {
            client,
            base_url,
            api_key,
            models,
        }
    }

    fn messages_url(&self) -> String {
        format!("{}/messages", self.base_url)
    }

    /// Convert AIRIS messages to Anthropic format.
    ///
    /// Anthropic separates system messages from the messages array.
    /// Returns (system_prompt, messages_array).
    fn build_anthropic_messages(
        messages: &[Message],
    ) -> (Option<String>, Vec<serde_json::Value>) {
        let mut system: Option<String> = None;
        let mut result: Vec<serde_json::Value> = Vec::new();

        for msg in messages {
            match msg.role {
                MessageRole::System => {
                    // Accumulate system messages
                    let text = msg.text();
                    match &mut system {
                        Some(s) => s.push_str("\n\n");
                        None => system = Some(String::new()),
                    }
                    if let Some(s) = &mut system {
                        s.push_str(&text);
                    }
                }
                MessageRole::User => {
                    // Handle multi-part content (text + images)
                    let content: Vec<serde_json::Value> = msg
                        .content
                        .iter()
                        .map(|part| match part {
                            ContentPart::Text { text } => {
                                serde_json::json!({
                                    "type": "text",
                                    "text": text
                                })
                            }
                            ContentPart::Image { url, .. } => {
                                // Anthropic supports base64 image data
                                // For URL-based images, we use media_type detection
                                let (media_type, image_data) = if url.starts_with("data:") {
                                    // data:image/jpeg;base64,...
                                    let parts: Vec<&str> = url.splitn(2, ',').collect();
                                    let mime = parts[0]
                                        .replace("data:", "")
                                        .split(';')
                                        .next()
                                        .unwrap_or("image/jpeg")
                                        .to_string();
                                    (mime, parts.get(1).unwrap_or(&"").to_string())
                                } else {
                                    ("image/jpeg".to_string(), url.clone())
                                };

                                serde_json::json!({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": media_type,
                                        "data": image_data,
                                    }
                                })
                            }
                            _ => serde_json::json!({ "type": "text", "text": "" }),
                        })
                        .collect();

                    let entry = if content.len() == 1
                        && content[0].get("text").is_some()
                    {
                        serde_json::json!({
                            "role": "user",
                            "content": content[0]["text"].as_str().unwrap_or("")
                        })
                    } else {
                        serde_json::json!({
                            "role": "user",
                            "content": content
                        })
                    };

                    result.push(entry);
                }
                MessageRole::Assistant => {
                    // Check for tool calls
                    let has_tool_calls = msg.content.iter().any(|c| {
                        matches!(c, ContentPart::ToolCall { .. })
                    });

                    if has_tool_calls {
                        for part in &msg.content {
                            if let ContentPart::ToolCall { id, name, arguments } = part {
                                result.push(serde_json::json!({
                                    "role": "assistant",
                                    "content": [
                                        {
                                            "type": "tool_use",
                                            "id": id,
                                            "name": name,
                                            "input": arguments,
                                        }
                                    ]
                                }));
                            }
                        }
                    } else {
                        result.push(serde_json::json!({
                            "role": "assistant",
                            "content": msg.text()
                        }));
                    }
                }
                MessageRole::Tool => {
                    for part in &msg.content {
                        if let ContentPart::ToolResult { id, content } = part {
                            result.push(serde_json::json!({
                                "role": "user",
                                "content": [
                                    {
                                        "type": "tool_result",
                                        "tool_use_id": id,
                                        "content": content,
                                    }
                                ]
                            }));
                        }
                    }
                }
            }
        }

        (system, result)
    }

    fn build_request_body(
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
        stream: bool,
    ) -> serde_json::Value {
        let (system_prompt, anthropic_messages) = Self::build_anthropic_messages(messages);

        let mut body = serde_json::json!({
            "model": model.as_str(),
            "messages": anthropic_messages,
            "stream": stream,
            "max_tokens": params.max_tokens.unwrap_or(4096),
        });

        if let Some(system) = system_prompt {
            if !system.is_empty() {
                body["system"] = serde_json::json!(system);
            }
        }

        if (params.temperature - 0.7).abs() > f64::EPSILON {
            body["temperature"] = serde_json::json!(params.temperature);
        }

        if (params.top_p - 0.95).abs() > f64::EPSILON {
            body["top_p"] = serde_json::json!(params.top_p);
        }

        if !params.stop_sequences.is_empty() {
            body["stop_sequences"] = serde_json::json!(params.stop_sequences);
        }

        if !tools.is_empty() {
            let anthropic_tools: Vec<serde_json::Value> = tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "name": t.name,
                        "description": t.description,
                        "input_schema": t.parameters,
                    })
                })
                .collect();
            body["tools"] = serde_json::json!(anthropic_tools);
        }

        body
    }

    /// Parse an Anthropic message response into AIRIS Message.
    fn parse_message_response(&self, data: &serde_json::Value) -> AirisResult<Message> {
        let content_blocks = data["content"]
            .as_array()
            .ok_or_else(|| AirisError::ModelResponse("Missing content in response".into()))?;

        for block in content_blocks {
            let block_type = block["type"].as_str().unwrap_or("text");

            match block_type {
                "tool_use" => {
                    let id = block["id"].as_str().unwrap_or("call_unknown");
                    let name = block["name"].as_str().unwrap_or("unknown");
                    let input = block["input"].clone();
                    return Ok(tool_call_message(id, name, &input));
                }
                "text" => {
                    let text = block["text"].as_str().unwrap_or("");
                    let mut msg = assistant_message(text);
                    if let Some(usage) = data.get("usage") {
                        msg.tokens = Some(
                            usage["input_tokens"].as_u64().unwrap_or(0) as usize
                                + usage["output_tokens"].as_u64().unwrap_or(0) as usize,
                        );
                    }
                    return Ok(msg);
                }
                _ => {}
            }
        }

        Ok(assistant_message(""))
    }
}

#[async_trait]
impl Provider for AnthropicProvider {
    fn id(&self) -> ProviderId {
        ProviderId("anthropic".into())
    }

    fn display_name(&self) -> &str {
        "Anthropic"
    }

    async fn list_models(&self) -> AirisResult<Vec<ModelConfig>> {
        if !self.models.is_empty() {
            return Ok(self
                .models
                .iter()
                .map(|m| {
                    let is_opus = m.contains("opus");
                    let is_haiku = m.contains("haiku");
                    let is_sonnet = m.contains("sonnet");
                    ModelConfig {
                        id: ModelId(m.clone()),
                        provider: ProviderId("anthropic".into()),
                        display_name: m.clone(),
                        capabilities: ModelCapabilities {
                            supports_vision: is_opus || is_sonnet,
                            supports_tools: true,
                            max_tokens: if is_opus { 4096 } else { 8192 },
                            max_input_tokens: 200_000,
                            context_window: 200_000,
                            supports_streaming: true,
                            supports_embeddings: false,
                            supports_function_calling: true,
                            supports_json_mode: m.contains("sonnet"),
                        },
                        default_params: ModelParams {
                            max_tokens: Some(4096),
                            ..ModelParams::default()
                        },
                        pricing: Some(match m.as_str() {
                            _ if is_opus => ModelPricing {
                                input_per_1m_tokens: 15.0,
                                output_per_1m_tokens: 75.0,
                                currency: "USD".into(),
                            },
                            _ if is_sonnet => ModelPricing {
                                input_per_1m_tokens: 3.0,
                                output_per_1m_tokens: 15.0,
                                currency: "USD".into(),
                            },
                            _ if is_haiku => ModelPricing {
                                input_per_1m_tokens: 0.25,
                                output_per_1m_tokens: 1.25,
                                currency: "USD".into(),
                            },
                            _ => ModelPricing {
                                input_per_1m_tokens: 3.0,
                                output_per_1m_tokens: 15.0,
                                currency: "USD".into(),
                            },
                        }),
                    }
                })
                .collect());
        }

        // Default model list if none configured
        Ok(vec![
            ModelConfig {
                id: ModelId("claude-sonnet-4-20250514".into()),
                provider: ProviderId("anthropic".into()),
                display_name: "Claude Sonnet 4".into(),
                capabilities: ModelCapabilities {
                    supports_vision: true,
                    supports_tools: true,
                    max_tokens: 8192,
                    max_input_tokens: 200_000,
                    context_window: 200_000,
                    supports_streaming: true,
                    supports_embeddings: false,
                    supports_function_calling: true,
                    supports_json_mode: true,
                },
                default_params: ModelParams {
                    max_tokens: Some(4096),
                    ..ModelParams::default()
                },
                pricing: Some(ModelPricing {
                    input_per_1m_tokens: 3.0,
                    output_per_1m_tokens: 15.0,
                    currency: "USD".into(),
                }),
            },
            ModelConfig {
                id: ModelId("claude-haiku-3-5-20241022".into()),
                provider: ProviderId("anthropic".into()),
                display_name: "Claude Haiku 3.5".into(),
                capabilities: ModelCapabilities {
                    supports_vision: false,
                    supports_tools: true,
                    max_tokens: 8192,
                    max_input_tokens: 200_000,
                    context_window: 200_000,
                    supports_streaming: true,
                    supports_embeddings: false,
                    supports_function_calling: true,
                    supports_json_mode: false,
                },
                default_params: ModelParams {
                    max_tokens: Some(4096),
                    ..ModelParams::default()
                },
                pricing: Some(ModelPricing {
                    input_per_1m_tokens: 0.25,
                    output_per_1m_tokens: 1.25,
                    currency: "USD".into(),
                }),
            },
        ])
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
        // Build a client with the Anthropic-specific auth header
        let body = Self::build_request_body(model, messages, params, tools, false);

        let mut request = self.client.post(&self.messages_url()).json(&body);

        // Anthropic uses x-api-key header
        if let Some(key) = &self.api_key {
            request = request.header("x-api-key", key);
            request = request.header("anthropic-version", "2023-06-01");
        }

        let resp = request.send().await.map_err(|e| {
            AirisError::Http(format!("Anthropic request failed: {}", e))
        })?;

        let status = resp.status();
        let text = resp.text().await.map_err(|e| {
            AirisError::Http(format!("Failed to read Anthropic response: {}", e))
        })?;

        if !status.is_success() {
            return Err(AirisError::Provider {
                provider: "anthropic".into(),
                message: format!("HTTP {}: {}", status.as_u16(), text),
            });
        }

        let data: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
            AirisError::ModelResponse(format!("Failed to parse Anthropic response: {} body={}", e, text))
        })?;

        self.parse_message_response(&data)
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

        let mut request = self.client.post(&self.messages_url()).json(&body);

        if let Some(key) = &self.api_key {
            request = request.header("x-api-key", key);
            request = request.header("anthropic-version", "2023-06-01");
        }

        let mut es = request
            .eventsource()
            .map_err(|e| AirisError::Http(format!("Failed to create event source: {}", e)))?;

        let mut content_parts: Vec<String> = Vec::new();
        let mut finish_reason = String::new();
        let mut usage: Option<TokenUsage> = None;
        let mut tool_calls: Vec<(String, String, serde_json::Value)> = Vec::new();

        loop {
            match es.next().await {
                Some(Ok(reqwest_eventsource::Event::Open)) => {}
                Some(Ok(reqwest_eventsource::Event::Message(msg))) => {
                    let event_type = &msg.event;

                    match event_type {
                        "content_block_delta" => {
                            if let Ok(data) =
                                serde_json::from_str::<serde_json::Value>(&msg.data)
                            {
                                if let Some(delta) = data.get("delta") {
                                    if let Some(text) = delta["text"].as_str() {
                                        if !text.is_empty() {
                                            content_parts.push(text.to_string());
                                            handler.on_chunk(text);
                                        }
                                    }
                                }
                            }
                        }
                        "content_block_start" => {
                            if let Ok(data) =
                                serde_json::from_str::<serde_json::Value>(&msg.data)
                            {
                                if let Some(block) = data.get("content_block") {
                                    if block["type"].as_str() == Some("tool_use") {
                                        let id = block["id"].as_str().unwrap_or("").to_string();
                                        let name =
                                            block["name"].as_str().unwrap_or("").to_string();
                                        let input = block["input"].clone();
                                        if !id.is_empty() && !name.is_empty() {
                                            tool_calls
                                                .push((id.clone(), name.clone(), input.clone()));
                                            handler.on_tool_call(&id, &name, &input);
                                        }
                                    }
                                }
                            }
                        }
                        "message_delta" => {
                            if let Ok(data) =
                                serde_json::from_str::<serde_json::Value>(&msg.data)
                            {
                                if let Some(delta) = data.get("delta") {
                                    if let Some(reason) = delta["stop_reason"].as_str() {
                                        finish_reason = reason.to_string();
                                    }
                                }
                                if let Some(usage_data) = data.get("usage") {
                                    usage = Some(TokenUsage {
                                        prompt_tokens: usage_data["input_tokens"]
                                            .as_u64()
                                            .unwrap_or(0) as usize,
                                        completion_tokens: usage_data["output_tokens"]
                                            .as_u64()
                                            .unwrap_or(0) as usize,
                                        total_tokens: (usage_data["input_tokens"]
                                            .as_u64()
                                            .unwrap_or(0)
                                            + usage_data["output_tokens"]
                                                .as_u64()
                                                .unwrap_or(0))
                                            as usize,
                                        cost: None,
                                    });
                                }
                            }
                        }
                        "error" => {
                            if let Ok(data) =
                                serde_json::from_str::<serde_json::Value>(&msg.data)
                            {
                                let err_msg = data["error"]["message"]
                                    .as_str()
                                    .unwrap_or("Unknown Anthropic error");
                                handler.on_error(err_msg);
                                return Err(AirisError::Provider {
                                    provider: "anthropic".into(),
                                    message: err_msg.to_string(),
                                });
                            }
                        }
                        "message_start" | "message_stop" | "ping" => {
                            // No-op events
                        }
                        _ => {
                            // Unknown event type, just continue
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

    async fn embed(&self, _model: &ModelId, _input: &[String]) -> AirisResult<Vec<Vec<f32>>> {
        Err(AirisError::NotImplemented("Anthropic does not support embeddings".into()))
    }

    async fn count_tokens(&self, _model: &ModelId, text: &str) -> AirisResult<usize> {
        // Anthropic doesn't have a public token counting API
        // Use ~4 chars per token as rough estimate
        let approx = (text.len() + 3) / 4;
        Ok(approx)
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            streaming: true,
            tools: true,
            vision: true,
            embeddings: false,
            json_mode: true,
        }
    }

    fn box_clone(&self) -> Box<dyn Provider> {
        Box::new(Self {
            client: self.client.clone(),
            base_url: self.base_url.clone(),
            api_key: self.api_key.clone(),
            models: self.models.clone(),
        })
    }
}
