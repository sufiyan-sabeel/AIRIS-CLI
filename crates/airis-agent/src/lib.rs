//! # AIRIS Agent
//!
//! Core agent with ReAct reasoning loop, tool calling, streaming,
//! and multi-agent execution. Inspired by architectural patterns
//! from Oh My Pi, implemented from scratch in Rust.

pub mod orchestrator;

use airis_core::prelude::*;
use async_trait::async_trait;
use chrono::Utc;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, warn, error};
use uuid::Uuid;

const MAX_REACT_LOOP: usize = 25;
const MAX_RETRIES: u32 = 3;
const INITIAL_BACKOFF_MS: u64 = 1000;

// ─── Agent Implementation ─────────────────────────────────────────────────

/// Core agent implementing the ReAct reasoning loop.
pub struct AgentImpl {
    model_registry: Arc<RwLock<Option<Arc<dyn ModelRegistry>>>>,
    tool_registry: Arc<RwLock<Option<Arc<dyn ToolRegistry>>>>,
    system_prompt: Arc<RwLock<String>>,
    session_store: Arc<RwLock<Option<Arc<dyn SessionStore>>>>,
    memory_store: Arc<RwLock<Option<Arc<dyn MemoryStore>>>>,
    conversation: Arc<RwLock<Conversation>>,
    state: Arc<RwLock<AgentState>>,
}

#[derive(Debug, Clone)]
enum AgentState {
    Idle,
    Running { step: usize, start_time: chrono::DateTime<Utc> },
    Paused,
    Error(String),
}

impl AgentImpl {
    pub fn new() -> Self {
        Self {
            model_registry: Arc::new(RwLock::new(None)),
            tool_registry: Arc::new(RwLock::new(None)),
            system_prompt: Arc::new(RwLock::new(
                "You are AIRIS, an advanced AI coding assistant by KageOS. \
                 You help users with coding tasks, explanations, and problem-solving. \
                 Be concise, accurate, and practical. Use tools when needed to \
                 accomplish tasks effectively."
                    .into(),
            )),
            session_store: Arc::new(RwLock::new(None)),
            memory_store: Arc::new(RwLock::new(None)),
            conversation: Arc::new(RwLock::new(Conversation::new())),
            state: Arc::new(RwLock::new(AgentState::Idle)),
        }
    }

    pub fn with_registry(self, registry: Arc<dyn ModelRegistry>) -> Self {
        *self.model_registry.write() = Some(registry);
        self
    }

    pub fn with_tools(self, tools: Arc<dyn ToolRegistry>) -> Self {
        *self.tool_registry.write() = Some(tools);
        self
    }

    pub fn with_system_prompt(self, prompt: &str) -> Self {
        *self.system_prompt.write() = prompt.to_string();
        self
    }

    pub fn with_session_store(self, store: Arc<dyn SessionStore>) -> Self {
        *self.session_store.write() = Some(store);
        self
    }

    pub fn with_memory(self, memory: Arc<dyn MemoryStore>) -> Self {
        *self.memory_store.write() = Some(memory);
        self
    }

    /// Get the current conversation.
    pub fn conversation(&self) -> Conversation {
        self.conversation.read().clone()
    }

    /// Restore conversation from a loaded session.
    pub fn restore_conversation(&self, conv: Conversation) {
        *self.conversation.write() = conv;
    }

    /// Execute the ReAct loop.
    async fn react_loop(
        &self,
        goal: &str,
        model_id: &ModelId,
        max_steps: usize,
        tools: &[ToolDefinition],
        signal: Option<tokio::sync::watch::Receiver<bool>>,
    ) -> AirisResult<AgentResult> {
        let start_time = Utc::now();
        *self.state.write() = AgentState::Running {
            step: 0,
            start_time,
        };

        // Add user message
        let user_msg = Message::user(goal);
        self.conversation.write().push(user_msg.clone());

        let mut steps_taken = 0usize;
        let mut total_prompt_tokens = 0usize;
        let mut total_completion_tokens = 0usize;
        let mut step_results: Vec<String> = Vec::new();

        // Resolve model
        let registry = self.model_registry.read();
        let registry = registry.as_ref().ok_or_else(|| {
            AirisError::Agent("No model registry configured".into())
        })?;

        let (provider, model_config) = registry.resolve_model(model_id)?;

        for step in 0..max_steps {
            // Check if cancelled
            if let Some(ref sig) = signal {
                if *sig.borrow() {
                    return Ok(AgentResult {
                        success: false,
                        output: "Agent execution cancelled.".into(),
                        steps_taken,
                        total_duration_ms: (Utc::now() - start_time).num_milliseconds() as u64,
                        token_usage: TokenUsage {
                            prompt_tokens: total_prompt_tokens,
                            completion_tokens: total_completion_tokens,
                            total_tokens: total_prompt_tokens + total_completion_tokens,
                            cost: None,
                        },
                        plan: None,
                    });
                }
            }

            steps_taken = step + 1;

            // Build messages for this turn
            let messages = self.build_messages(tools);

            // Call provider with retry
            let response = self.call_with_retry(
                &*provider,
                model_id,
                &messages,
                &model_config.default_params,
                tools,
            )
            .await?;

            // Track tokens
            if let Some(tokens) = response.tokens {
                total_prompt_tokens += tokens / 2;
                total_completion_tokens += tokens / 2;
            }

            // Check for tool calls
            let tool_calls: Vec<&ContentPart> = response
                .content
                .iter()
                .filter(|c| matches!(c, ContentPart::ToolCall { .. }))
                .collect();

            if tool_calls.is_empty() {
                // Assistant responded with text — we're done
                self.conversation.write().push(response);

                // Store in memory
                if let Some(ref memory) = *self.memory_store.read() {
                    let entry = MemoryEntry {
                        id: Uuid::new_v4(),
                        key: "agent_interaction".into(),
                        content: format!("Goal: {}\nResult: {}", goal, response.text()),
                        entry_type: MemoryType::Episodic,
                        importance: 0.0,
                        timestamp: Utc::now(),
                        expires_at: None,
                        embedding: None,
                        metadata: HashMap::new(),
                    };
                    memory.store(entry).await.ok();
                }

                let output = response.text();
                step_results.push(output.clone());

                *self.state.write() = AgentState::Idle;

                return Ok(AgentResult {
                    success: true,
                    output,
                    steps_taken,
                    total_duration_ms: (Utc::now() - start_time).num_milliseconds() as u64,
                    token_usage: TokenUsage {
                        prompt_tokens: total_prompt_tokens,
                        completion_tokens: total_completion_tokens,
                        total_tokens: total_prompt_tokens + total_completion_tokens,
                        cost: None,
                    },
                    plan: None,
                });
            }

            // Process tool calls
            let tool_registry = self.tool_registry.read();
            let tool_registry = tool_registry.as_ref().ok_or_else(|| {
                AirisError::Agent("No tool registry configured".into())
            })?;

            // Add assistant message with tool calls
            self.conversation.write().push(response.clone());

            for tool_call in &tool_calls {
                if let ContentPart::ToolCall { id, name, arguments } = tool_call {
                    info!("Agent executing tool: {} (id={})", name, id);

                    let tool = tool_registry.get(name);
                    let result = match tool {
                        Some(tool) => {
                            tool.execute(arguments.clone()).await
                        }
                        None => Err(AirisError::ToolNotFound(name.clone())),
                    };

                    let tool_result = match result {
                        Ok(r) => {
                            info!("Tool {} succeeded in {}ms", name, r.duration_ms);
                            r
                        }
                        Err(e) => {
                            error!("Tool {} failed: {}", name, e);
                            ToolResult {
                                tool_name: name.clone(),
                                call_id: id.clone(),
                                success: false,
                                output: String::new(),
                                error: Some(e.to_string()),
                                duration_ms: 0,
                            }
                        }
                    };

                    // Add tool result to conversation
                    self.conversation.write().push(Message {
                        role: MessageRole::Tool,
                        content: vec![ContentPart::ToolResult {
                            id: id.clone(),
                            content: if tool_result.success {
                                tool_result.output
                            } else {
                                format!("Error: {}", tool_result.error.unwrap_or_default())
                            },
                        }],
                        name: Some(tool_result.tool_name),
                        timestamp: Utc::now(),
                        tokens: None,
                    });

                    step_results.push(format!(
                        "Tool {}: {} ({})",
                        tool_result.tool_name,
                        if tool_result.success { "success" } else { "failed" },
                        tool_result.duration_ms
                    ));
                }
            }
        }

        // Max steps reached
        *self.state.write() = AgentState::Idle;
        let output = step_results.join("\n");
        Err(AirisError::StepLimitExceeded(max_steps))
    }

    /// Build messages array for provider call.
    fn build_messages(&self, tools: &[ToolDefinition]) -> Vec<Message> {
        let conv = self.conversation.read();
        let mut messages: Vec<Message> = Vec::new();

        // System prompt
        let system = self.system_prompt.read();
        let mut system_msg = Message::system(&*system);
        if !tools.is_empty() {
            if let ContentPart::Text { text } = &mut system_msg.content[0] {
                text.push_str("\n\nYou have access to the following tools:\n");
                for tool in tools {
                    text.push_str(&format!(
                        "- `{}`: {}\n",
                        tool.name, tool.description
                    ));
                }
            }
        }
        messages.push(system_msg);

        // Conversation messages
        messages.extend(conv.messages.clone());

        messages
    }

    /// Call provider with exponential backoff retry.
    async fn call_with_retry(
        &self,
        provider: &dyn Provider,
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
    ) -> AirisResult<Message> {
        let mut last_error = None;

        for attempt in 0..=MAX_RETRIES {
            if attempt > 0 {
                let backoff = INITIAL_BACKOFF_MS * (1u64 << (attempt - 1));
                info!("Retry attempt {}/{} after {}ms", attempt, MAX_RETRIES, backoff);
                tokio::time::sleep(tokio::time::Duration::from_millis(backoff)).await;
            }

            match provider.complete(model, messages, params, tools).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    // Check if retryable
                    let retryable = matches!(
                        &e,
                        AirisError::RateLimited(_)
                            | AirisError::Http(_)
                            | AirisError::StreamInterrupted
                            | AirisError::StreamTimeout
                    );

                    if !retryable && attempt < MAX_RETRIES {
                        // Non-retryable on first attempts, but try on last attempt
                        if attempt == MAX_RETRIES - 1 {
                            // Last attempt - try anyway
                        } else {
                            last_error = Some(e);
                            break;
                        }
                    }

                    if attempt == MAX_RETRIES {
                        last_error = Some(e);
                    } else {
                        last_error = Some(e);
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            AirisError::ModelResponse("All retry attempts exhausted".into())
        }))
    }

    /// Execute with streaming response.
    async fn react_loop_streaming(
        &self,
        goal: &str,
        model_id: &ModelId,
        max_steps: usize,
        tools: &[ToolDefinition],
        tx: mpsc::Sender<StreamEvent>,
        signal: Option<tokio::sync::watch::Receiver<bool>>,
    ) -> AirisResult<AgentResult> {
        let start_time = Utc::now();
        *self.state.write() = AgentState::Running {
            step: 0,
            start_time,
        };

        let user_msg = Message::user(goal);
        self.conversation.write().push(user_msg);

        let registry = self.model_registry.read();
        let registry = registry.as_ref().ok_or_else(|| {
            AirisError::Agent("No model registry configured".into())
        })?;
        let (provider, model_config) = registry.resolve_model(model_id)?;

        let mut steps_taken = 0usize;
        let mut total_prompt_tokens = 0usize;
        let mut total_completion_tokens = 0usize;

        for step in 0..max_steps {
            if let Some(ref sig) = signal {
                if *sig.borrow() {
                    tx.send(StreamEvent::Error {
                        message: "Cancelled".into(),
                    }).await.ok();
                    break;
                }
            }

            steps_taken = step + 1;

            _ = tx.send(StreamEvent::Progress {
                step: format!("Step {}/{}", step + 1, max_steps),
                progress: (step as f64 + 1.0) / max_steps as f64,
            }).await;

            let messages = self.build_messages(tools);

            // Stream the response
            let collector = Arc::new(std::sync::Mutex::new(String::new()));
            let collector_clone = collector.clone();
            let tx_clone = tx.clone();

            let handler = Box::new(StreamingCallback::new(move |chunk: &str| {
                collector_clone.lock().unwrap().push_str(chunk);
                let _ = tx_clone.blocking_send(StreamEvent::Chunk {
                    content: chunk.to_string(),
                });
            }));

            let response = provider
                .complete_stream(model_id, &messages, &model_config.default_params, tools, handler)
                .await?;

            if let Some(tokens) = response.tokens {
                total_prompt_tokens += tokens / 2;
                total_completion_tokens += tokens / 2;
            }

            let tool_calls: Vec<&ContentPart> = response
                .content
                .iter()
                .filter(|c| matches!(c, ContentPart::ToolCall { .. }))
                .collect();

            if tool_calls.is_empty() {
                self.conversation.write().push(response);

                _ = tx.send(StreamEvent::Done {
                    finish_reason: "stop".into(),
                    usage: Some(TokenUsage {
                        prompt_tokens: total_prompt_tokens,
                        completion_tokens: total_completion_tokens,
                        total_tokens: total_prompt_tokens + total_completion_tokens,
                        cost: None,
                    }),
                }).await;

                *self.state.write() = AgentState::Idle;
                return Ok(AgentResult {
                    success: true,
                    output: collector.lock().unwrap().clone(),
                    steps_taken,
                    total_duration_ms: (Utc::now() - start_time).num_milliseconds() as u64,
                    token_usage: TokenUsage {
                        prompt_tokens: total_prompt_tokens,
                        completion_tokens: total_completion_tokens,
                        total_tokens: total_prompt_tokens + total_completion_tokens,
                        cost: None,
                    },
                    plan: None,
                });
            }

            self.conversation.write().push(response.clone());
            let tool_registry = self.tool_registry.read();
            let tool_registry = tool_registry.as_ref().ok_or_else(|| {
                AirisError::Agent("No tool registry configured".into())
            })?;

            for tool_call in &tool_calls {
                if let ContentPart::ToolCall { id, name, arguments } = tool_call {
                    _ = tx.send(StreamEvent::ToolCall {
                        id: id.clone(),
                        name: name.clone(),
                        arguments: arguments.clone(),
                    }).await;

                    let tool = tool_registry.get(name);
                    let result = match tool {
                        Some(t) => t.execute(arguments.clone()).await,
                        None => Err(AirisError::ToolNotFound(name.clone())),
                    };

                    match result {
                        Ok(r) => {
                            _ = tx.send(StreamEvent::ToolResult {
                                id: id.clone(),
                                result: r.output.clone(),
                            }).await;
                            self.conversation.write().push(Message {
                                role: MessageRole::Tool,
                                content: vec![ContentPart::ToolResult {
                                    id: id.clone(),
                                    content: r.output,
                                }],
                                name: Some(name.clone()),
                                timestamp: Utc::now(),
                                tokens: None,
                            });
                        }
                        Err(e) => {
                            _ = tx.send(StreamEvent::Error {
                                message: format!("Tool {} failed: {}", name, e),
                            }).await;
                            self.conversation.write().push(Message {
                                role: MessageRole::Tool,
                                content: vec![ContentPart::ToolResult {
                                    id: id.clone(),
                                    content: format!("Error: {}", e),
                                }],
                                name: Some(name.clone()),
                                timestamp: Utc::now(),
                                tokens: None,
                            });
                        }
                    }
                }
            }
        }

        *self.state.write() = AgentState::Idle;
        Err(AirisError::StepLimitExceeded(max_steps))
    }
}

/// Streaming callback bridge.
struct StreamingCallback {
    on_chunk: Box<dyn Fn(&str) + Send + 'static>,
}

impl StreamingCallback {
    fn new(on_chunk: impl Fn(&str) + Send + 'static) -> Self {
        Self {
            on_chunk: Box::new(on_chunk),
        }
    }
}

impl StreamHandler for StreamingCallback {
    fn on_chunk(&mut self, chunk: &str) {
        (self.on_chunk)(chunk);
    }

    fn on_tool_call(&mut self, _id: &str, _name: &str, _arguments: &serde_json::Value) {}
    fn on_done(&mut self, _finish_reason: &str, _usage: Option<TokenUsage>) {}
    fn on_error(&mut self, _error: &str) {}
    fn on_progress(&mut self, _step: &str, _progress: f64) {}
}

#[async_trait]
impl Agent for AgentImpl {
    fn id(&self) -> &str {
        "airis-agent"
    }

    fn name(&self) -> &str {
        "AIRIS Agent"
    }

    async fn step(&self, context: AgentContext) -> AirisResult<AgentStep> {
        let model_id = context.model;
        let tools = context.tools;

        let registry = self.model_registry.read();
        let registry = registry.as_ref().ok_or_else(|| {
            AirisError::Agent("No model registry configured".into())
        })?;
        let (provider, model_config) = registry.resolve_model(&model_id)?;

        let messages = self.build_messages(&tools);
        let response = provider
            .complete(&model_id, &messages, &model_config.default_params, &tools)
            .await?;

        self.conversation.write().push(response.clone());

        let tool_calls: Vec<&ContentPart> = response
            .content
            .iter()
            .filter(|c| matches!(c, ContentPart::ToolCall { .. }))
            .collect();

        let finished = tool_calls.is_empty();

        if !tool_calls.is_empty() {
            if let ContentPart::ToolCall { id, name, arguments } = &tool_calls[0] {
                let tool_registry = self.tool_registry.read();
                let tool_registry = tool_registry.as_ref().ok_or_else(|| {
                    AirisError::Agent("No tool registry configured".into())
                })?;

                let result = match tool_registry.get(name) {
                    Some(tool) => tool.execute(arguments.clone()).await.ok(),
                    None => None,
                };

                return Ok(AgentStep {
                    action: AgentAction::UseTool {
                        tool: name.clone(),
                        arguments: arguments.clone(),
                    },
                    tool_result: result,
                    message: Some(response),
                    finished,
                });
            }
        }

        Ok(AgentStep {
            action: AgentAction::Respond {
                content: response.text(),
            },
            tool_result: None,
            message: Some(response),
            finished,
        })
    }

    async fn run(&self, goal: &str, context: AgentContext) -> AirisResult<AgentResult> {
        let model_id = context.model;
        let max_steps = context.max_steps.min(MAX_REACT_LOOP);

        // Get tool definitions
        let tools_defs: Vec<ToolDefinition> = if let Some(ref registry) = *self.tool_registry.read() {
            registry.definitions()
        } else {
            Vec::new()
        };

        self.react_loop(goal, &model_id, max_steps, &tools_defs, None)
            .await
    }

    async fn reset(&self) -> AirisResult<()> {
        *self.conversation.write() = Conversation::new();
        *self.state.write() = AgentState::Idle;
        Ok(())
    }
}

// ─── Agent Runner (high-level) ────────────────────────────────────────────

/// High-level agent runner that wires everything together.
pub struct AgentRunner {
    agent: Arc<AgentImpl>,
    registry: Arc<dyn ModelRegistry>,
    tools: Arc<dyn ToolRegistry>,
}

impl AgentRunner {
    pub fn new(
        agent: Arc<AgentImpl>,
        registry: Arc<dyn ModelRegistry>,
        tools: Arc<dyn ToolRegistry>,
    ) -> Self {
        Self { agent, registry, tools }
    }

    /// Get a reference to the inner agent.
    pub fn agent(&self) -> &AgentImpl {
        &self.agent
    }

    /// Get a reference to the tool registry.
    pub fn tools(&self) -> &dyn ToolRegistry {
        &*self.tools
    }

    /// Get a reference to the model registry.
    pub fn registry(&self) -> &dyn ModelRegistry {
        &*self.registry
    }

    /// Run the agent with a goal and context.
    pub async fn run(&self, goal: &str, context: AgentContext) -> AirisResult<AgentResult> {
        self.agent.run(goal, context).await
    }

    /// Run a chat interaction.
    pub async fn chat(&self, prompt: &str) -> AirisResult<String> {
        let context = AgentContext {
            messages: vec![Message::user(prompt)],
            tools: self.tools.definitions(),
            model: ModelId("default".into()),
            max_steps: 10,
            session: None,
        };

        let result = self.agent.run(prompt, context).await?;
        Ok(result.output)
    }

    /// Run chat with streaming events.
    pub async fn chat_stream(
        &self,
        prompt: &str,
    ) -> AirisResult<mpsc::Receiver<StreamEvent>> {
        let (tx, rx) = mpsc::channel(256);

        let agent = self.agent.clone();
        let prompt = prompt.to_string();
        let tools = self.tools.definitions();
        let model_id = ModelId("default".into());

        tokio::spawn(async move {
            let _ = agent
                .react_loop_streaming(&prompt, &model_id, 10, &tools, tx, None)
                .await;
        });

        Ok(rx)
    }

    /// Autonomous coding mode.
    pub async fn code(&self, task: &str, max_steps: usize) -> AirisResult<AgentResult> {
        let context = AgentContext {
            messages: vec![Message::user(task)],
            tools: self.tools.definitions(),
            model: ModelId("default".into()),
            max_steps,
            session: None,
        };

        self.agent.run(task, context).await
    }

    /// Run the agent with a custom goal and context.
    pub async fn run(&self, goal: &str, context: AgentContext) -> AirisResult<AgentResult> {
        self.agent.run(goal, context).await
    }

    /// Get tool definitions from the registry.
    pub fn tool_definitions(&self) -> Vec<ToolDefinition> {
        self.tools.definitions()
    }

    /// Get tool names from the registry.
    pub fn tool_names(&self) -> Vec<String> {
        self.tools.names()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_creation() {
        let agent = AgentImpl::new();
        assert_eq!(agent.id(), "airis-agent");
        assert_eq!(agent.name(), "AIRIS Agent");
    }

    #[tokio::test]
    async fn test_agent_reset() {
        let agent = AgentImpl::new();
        agent.reset().await.unwrap();
        assert_eq!(agent.conversation().messages.len(), 0);
    }

    #[test]
    fn test_system_prompt() {
        let agent = AgentImpl::new().with_system_prompt("You are a test assistant.");
        // System prompt is set internally
    }

    #[test]
    fn test_state_transitions() {
        let agent = AgentImpl::new();
        // Initial state should be Idle
    }
}
