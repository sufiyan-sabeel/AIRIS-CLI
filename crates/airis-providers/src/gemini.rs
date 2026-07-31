//! Google Gemini provider.
//!
//! Implements the Google Generative Language API for Gemini models.
//! Uses API key as query parameter and has a different message/content format.

use airis_core::prelude::*;
use async_trait::async_trait;
use reqwest_eventsource::{EventSource, RequestBuilderExt};

/// Provider for Google Gemini models.
pub struct GeminiProvider {
    client: reqwest::Client,
    base_url: String,
    api_key: Option<String>,
    models: Vec<String>,
}

impl GeminiProvider {
    /// Create a new Google Gemini provider.
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

    /// Build the full URL with API key as query parameter.
    fn api_url(&self, path: &str) -> Result<String, AirisError> {
        let key = self
            .api_key
            .as_deref()
            .ok_or_else(|| AirisError::Auth("Gemini API key is required".into()))?;
        Ok(format!(
            "{}{}?key={}",
            self.base_url.trim_end_matches('/'),
            path,
            key
        ))
    }

    fn models_url(&self) -> Result<String, AirisError> {
        self.api_url("/models")
    }

    fn chat_url(&self, model: &ModelId) -> Result<String, AirisError> {
        self.api_url(&format!("/models/{}:generateContent", model.as_str()))
    }

    fn stream_chat_url(&self, model: &ModelId) -> Result<String, AirisError> {
        self.api_url(&format!(
            "/models/{}:streamGenerateContent",
            model.as_str()
        ))
    }

    fn embed_url(&self, model: &ModelId) -> Result<String, AirisError> {
        self.api_url(&format!("/models/{}:embedContent", model.as_str()))
    }

    /// Convert AIRIS messages to Gemini format.
    ///
    /// Gemini uses a `contents` array where each entry has `role` and `parts`.
    /// System instructions are sent as a separate field.
    fn build_gemini_request(
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
        stream: bool,
    ) -> AirisResult<serde_json::Value> {
        let mut system_instruction: Option<String> = None;
        let mut contents: Vec<serde_json::Value> = Vec::new();

        for msg in messages {
            match msg.role {
                MessageRole::System => {
                    let text = msg.text();
                    match &mut system_instruction {
                        Some(s) => {
                            s.push_str("\n\n");
                            s.push_str(&text);
                        }
                        None => system_instruction = Some(text),
                    }
                }
                MessageRole::User => {
                    let parts: Vec<serde_json::Value> = msg
                        .content
                        .iter()
                        .map(|part| match part {
                            ContentPart::Text { text } => {
                                serde_json::json!({ "text": text })
                            }
                            ContentPart::Image { url, .. } => {
                                // Gemini accepts inline data or file URLs
                                if url.starts_with("data:") {
                                    let parts: Vec<&str> = url.splitn(2, ',').collect();
                                    let mime = parts[0]
                                        .replace("data:", "")
                                        .split(';')
                                        .next()
                                        .unwrap_or("image/jpeg");
                                    let b64_data = parts.get(1).unwrap_or(&"");
                                    serde_json::json!({
                                        "inline_data": {
                                            "mime_type": mime,
                                            "data": b64_data,
                                        }
                                    })
                                } else {
                                    serde_json::json!({
                                        "file_data": {
                                            "mime_type": "image/jpeg",
                                            "file_uri": url,
                                        }
                                    })
                                }
                            }
                            ContentPart::ToolResult { id, content } => {
                                serde_json::json!({
                                    "text": format!("[tool_result: {}] {}", id, content)
                                })
                            }
                            _ => serde_json::json!({ "text": "" }),
                        })
                        .collect();

                    contents.push(serde_json::json!({
                        "role": "user",
                        "parts": parts,
                    }));
                }
                MessageRole::Assistant => {
                    let has_tool_calls = msg.content.iter().any(|c| {
                        matches!(c, ContentPart::ToolCall { .. })
                    });

                    if has_tool_calls {
                        for part in &msg.content {
                            if let ContentPart::ToolCall { id, name, arguments } = part {
                                contents.push(serde_json::json!({
                                    "role": "model",
                                    "parts": [{
                                        "functionCall": {
                                            "name": name,
                                            "args": arguments,
                                        }
                                    }]
                                }));
                            }
                        }
                    } else {
                        contents.push(serde_json::json!({
                            "role": "model",
                            "parts": [{"text": msg.text()}],
                        }));
                    }
                }
                MessageRole::Tool => {
                    for part in &msg.content {
                        if let ContentPart::ToolResult { id, content } = part {
                            contents.push(serde_json::json!({
                                "role": "user",
                                "parts": [{
                                    "functionResponse": {
                                        "name": id,
                                        "response": {
                                            "name": id,
                                            "content": content,
                                        }
                                    }
                                }],
                            }));
                        }
                    }
                }
            }
        }

        // Build the request body
        let mut body = serde_json::json!({
            "contents": contents,
        });

        // System instruction as a separate top-level field
        if let Some(system) = system_instruction {
            body["systemInstruction"] = serde_json::json!({
                "parts": [{"text": system}]
            });
        }

        // Generation config
        let mut gen_config = serde_json::Map::new();
        gen_config.insert(
            "temperature".into(),
            serde_json::json!(params.temperature),
        );
        gen_config.insert("topP".into(), serde_json::json!(params.top_p));

        if let Some(top_k) = params.top_k {
            gen_config.insert("topK".into(), serde_json::json!(top_k));
        }

        if let Some(max_tokens) = params.max_tokens {
            gen_config.insert(
                "maxOutputTokens".into(),
                serde_json::json!(max_tokens),
            );
        }

        if !params.stop_sequences.is_empty() {
            gen_config.insert(
                "stopSequences".into(),
                serde_json::json!(params.stop_sequences),
            );
        }

        body["generationConfig"] = serde_json::Value::Object(gen_config);

        // Tools
        if !tools.is_empty() {
            let gemini_tools: Vec<serde_json::Value> = tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "functionDeclarations": [{
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.parameters,
                        }]
                    })
                })
                .collect();
            body["tools"] = serde_json::json!(gemini_tools);
        }

        if stream {
            // For SSE streaming, we need to use the streaming endpoint
            // The body is the same
        }

        Ok(body)
    }

    /// Parse a Gemini response into a Message.
    fn parse_chat_response(&self, data: &serde_json::Value) -> AirisResult<Message> {
        let candidates = data["candidates"]
            .as_array()
            .ok_or_else(|| AirisError::ModelResponse("Missing candidates in Gemini response".into()))?;

        let candidate = candidates
            .first()
            .ok_or_else(|| AirisError::ModelResponse("Empty candidates in Gemini response".into()))?;

        let content = candidate["content"]
            .as_object()
            .ok_or_else(|| AirisError::ModelResponse("Missing content in candidate".into()))?;

        let parts = content["parts"]
            .as_array()
            .ok_or_else(|| AirisError::ModelResponse("Missing parts in content".into()))?;

        for part in parts {
            if let Some(function_call) = part.get("functionCall") {
                let name = function_call["name"].as_str().unwrap_or("unknown");
                let args = function_call["args"].clone();
                return Ok(tool_call_message("gemini_call", name, &args));
            }

            if let Some(text) = part["text"].as_str() {
                let mut msg = assistant_message(text);

                if let Some(usage_metadata) = data.get("usageMetadata") {
                    msg.tokens = Some(
                        usage_metadata["totalTokenCount"]
                            .as_u64()
                            .unwrap_or(0) as usize,
                    );
                }

                // Check for finish reason
                if let Some(finish) = candidate.get("finishReason") {
                    let _reason = finish.as_str().unwrap_or("");
                }

                return Ok(msg);
            }
        }

        Ok(assistant_message(""))
    }
}

#[async_trait]
impl Provider for GeminiProvider {
    fn id(&self) -> ProviderId {
        ProviderId("gemini".into())
    }

    fn display_name(&self) -> &str {
        "Google Gemini"
    }

    async fn list_models(&self) -> AirisResult<Vec<ModelConfig>> {
        if !self.models.is_empty() {
            return Ok(self
                .models
                .iter()
                .map(|m| {
                    let is_pro = m.contains("pro");
                    let is_flash = m.contains("flash");
                    let is_vision = m.contains("vision");
                    ModelConfig {
                        id: ModelId(m.clone()),
                        provider: ProviderId("gemini".into()),
                        display_name: m.clone(),
                        capabilities: ModelCapabilities {
                            supports_streaming: true,
                            supports_tools: true,
                            supports_vision: is_vision || is_pro || is_flash,
                            supports_embeddings: m.contains("embedding"),
                            supports_function_calling: true,
                            supports_json_mode: true,
                            max_tokens: if is_pro { 8192 } else { 4096 },
                            max_input_tokens: if is_pro { 1_048_576 } else { 128_000 },
                            context_window: if is_pro { 1_048_576 } else { 128_000 },
                        },
                        default_params: ModelParams {
                            max_tokens: Some(8192),
                            ..ModelParams::default()
                        },
                        pricing: None,
                    }
                })
                .collect());
        }

        // Try to fetch from Gemini API
        let models_url = self.models_url();
        match models_url {
            Ok(url) => {
                match self.client.get(&url).send().await {
                    Ok(resp) => {
                        let data: serde_json::Value = resp.json().await.map_err(|e| {
                            AirisError::Http(format!(
                                "Failed to parse Gemini models: {}",
                                e
                            ))
                        })?;
                        let models = data["models"]
                            .as_array()
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|m| {
                                        let name = m["name"].as_str()?;
                                        // Extract just the model name from "models/gemini-pro" -> "gemini-pro"
                                        let short_name = name
                                            .strip_prefix("models/")
                                            .unwrap_or(name)
                                            .to_string();
                                        let is_pro = short_name.contains("pro");
                                        let is_flash = short_name.contains("flash");
                                        let is_vision = short_name.contains("vision");
                                        let is_embedding =
                                            short_name.contains("embedding");
                                        Some(ModelConfig {
                                            id: ModelId(short_name.clone()),
                                            provider: ProviderId("gemini".into()),
                                            display_name: short_name,
                                            capabilities: ModelCapabilities {
                                                supports_streaming: true,
                                                supports_tools: true,
                                                supports_vision: is_vision || is_pro
                                                    || is_flash,
                                                supports_embeddings: is_embedding,
                                                supports_function_calling: true,
                                                supports_json_mode: true,
                                                max_tokens: if is_pro {
                                                    8192
                                                } else {
                                                    4096
                                                },
                                                max_input_tokens: if is_pro {
                                                    1_048_576
                                                } else {
                                                    128_000
                                                },
                                                context_window: if is_pro {
                                                    1_048_576
                                                } else {
                                                    128_000
                                                },
                                            },
                                            default_params: ModelParams {
                                                max_tokens: Some(8192),
                                                ..ModelParams::default()
                                            },
                                            pricing: None,
                                        })
                                    })
                                    .collect::<Vec<_>>()
                            })
                            .unwrap_or_default();
                        Ok(models)
                    }
                    Err(e) => {
                        tracing::warn!("Failed to fetch Gemini models: {}", e);
                        Ok(default_gemini_models())
                    }
                }
            }
            Err(e) => Err(e),
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
        let body = Self::build_gemini_request(model, messages, params, tools, false)?;
        let url = self.chat_url(model)?;
        let data = post_json(&self.client, &url, &body).await?;
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
        let body = Self::build_gemini_request(model, messages, params, tools, true)?;
        let url = self.stream_chat_url(model)?;
        let mut handler = handler;

        let mut es = self
            .client
            .post(&url)
            .json(&body)
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
                    if msg.data == "[DONE]" {
                        break;
                    }

                    match serde_json::from_str::<serde_json::Value>(&msg.data) {
                        Ok(data) => {
                            if let Some(candidates) = data["candidates"].as_array() {
                                for candidate in candidates {
                                    let finish = candidate["finishReason"]
                                        .as_str()
                                        .unwrap_or("")
                                        .to_string();
                                    if !finish.is_empty() {
                                        finish_reason = finish;
                                    }

                                    if let Some(content) = candidate["content"].as_object()
                                    {
                                        if let Some(parts) = content["parts"].as_array() {
                                            for part in parts {
                                                if let Some(text) = part["text"].as_str() {
                                                    if !text.is_empty() {
                                                        content_parts.push(
                                                            text.to_string(),
                                                        );
                                                        handler.on_chunk(text);
                                                    }
                                                }

                                                if let Some(function_call) =
                                                    part.get("functionCall")
                                                {
                                                    let name = function_call["name"]
                                                        .as_str()
                                                        .unwrap_or("")
                                                        .to_string();
                                                    let args =
                                                        function_call["args"].clone();
                                                    if !name.is_empty() {
                                                        tool_calls.push((
                                                            "gemini_call".into(),
                                                            name.clone(),
                                                            args.clone(),
                                                        ));
                                                        handler.on_tool_call(
                                                            "gemini_call",
                                                            &name,
                                                            &args,
                                                        );
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            if let Some(usage_meta) = data.get("usageMetadata") {
                                usage = Some(TokenUsage {
                                    prompt_tokens: usage_meta["promptTokenCount"]
                                        .as_u64()
                                        .unwrap_or(0) as usize,
                                    completion_tokens: usage_meta["candidatesTokenCount"]
                                        .as_u64()
                                        .unwrap_or(0) as usize,
                                    total_tokens: usage_meta["totalTokenCount"]
                                        .as_u64()
                                        .unwrap_or(0) as usize,
                                    cost: None,
                                });
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse Gemini SSE chunk: {}", e);
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
        let mut embeddings = Vec::new();

        for text in input {
            let body = serde_json::json!({
                "model": format!("models/{}", model.as_str()),
                "content": {
                    "parts": [{"text": text}]
                }
            });

            let url = self.embed_url(model)?;
            let data = post_json(&self.client, &url, &body).await?;

            let embedding = data["embedding"]["values"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                        .collect::<Vec<f32>>()
                })
                .unwrap_or_default();

            embeddings.push(embedding);
        }

        Ok(embeddings)
    }

    async fn count_tokens(&self, model: &ModelId, text: &str) -> AirisResult<usize> {
        // Try using the countTokens endpoint
        let count_url = self.api_url(&format!(
            "/models/{}:countTokens",
            model.as_str()
        ));

        match count_url {
            Ok(url) => {
                let body = serde_json::json!({
                    "contents": [{
                        "parts": [{"text": text}]
                    }]
                });

                match post_json(&self.client, &url, &body).await {
                    Ok(data) => {
                        let count = data["totalTokens"]
                            .as_u64()
                            .unwrap_or((text.len() / 4) as u64);
                        Ok(count as usize)
                    }
                    Err(_) => {
                        // Fallback to heuristic
                        Ok((text.len() + 3) / 4)
                    }
                }
            }
            Err(_) => Ok((text.len() + 3) / 4),
        }
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
            api_key: self.api_key.clone(),
            models: self.models.clone(),
        })
    }
}

/// Default Gemini model configurations when API fetch fails.
fn default_gemini_models() -> Vec<ModelConfig> {
    vec![
        ModelConfig {
            id: ModelId("gemini-2.5-pro-exp-03-25".into()),
            provider: ProviderId("gemini".into()),
            display_name: "Gemini 2.5 Pro (experimental)".into(),
            capabilities: ModelCapabilities {
                supports_streaming: true,
                supports_tools: true,
                supports_vision: true,
                supports_embeddings: false,
                supports_function_calling: true,
                supports_json_mode: true,
                max_tokens: 8192,
                max_input_tokens: 1_048_576,
                context_window: 1_048_576,
            },
            default_params: ModelParams {
                max_tokens: Some(8192),
                ..ModelParams::default()
            },
            pricing: None,
        },
        ModelConfig {
            id: ModelId("gemini-2.0-flash".into()),
            provider: ProviderId("gemini".into()),
            display_name: "Gemini 2.0 Flash".into(),
            capabilities: ModelCapabilities {
                supports_streaming: true,
                supports_tools: true,
                supports_vision: true,
                supports_embeddings: false,
                supports_function_calling: true,
                supports_json_mode: true,
                max_tokens: 8192,
                max_input_tokens: 1_048_576,
                context_window: 1_048_576,
            },
            default_params: ModelParams {
                max_tokens: Some(8192),
                ..ModelParams::default()
            },
            pricing: None,
        },
        ModelConfig {
            id: ModelId("gemini-2.0-flash-lite".into()),
            provider: ProviderId("gemini".into()),
            display_name: "Gemini 2.0 Flash Lite".into(),
            capabilities: ModelCapabilities {
                supports_streaming: true,
                supports_tools: true,
                supports_vision: true,
                supports_embeddings: false,
                supports_function_calling: true,
                supports_json_mode: true,
                max_tokens: 8192,
                max_input_tokens: 1_048_576,
                context_window: 1_048_576,
            },
            default_params: ModelParams {
                max_tokens: Some(8192),
                ..ModelParams::default()
            },
            pricing: None,
        },
        ModelConfig {
            id: ModelId("text-embedding-004".into()),
            provider: ProviderId("gemini".into()),
            display_name: "Text Embedding".into(),
            capabilities: ModelCapabilities {
                supports_streaming: false,
                supports_tools: false,
                supports_vision: false,
                supports_embeddings: true,
                supports_function_calling: false,
                supports_json_mode: false,
                max_tokens: 2048,
                max_input_tokens: 2048,
                context_window: 2048,
            },
            default_params: ModelParams::default(),
            pricing: None,
        },
    ]
}
