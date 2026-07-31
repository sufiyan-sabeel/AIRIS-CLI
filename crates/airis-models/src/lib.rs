//! # AIRIS Model Registry
//!
//! Registry and routing system for AI models across providers.
//! Provides model selection, capability matching, and task-aware routing.

use airis_core::prelude::*;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

// ─── Task Kinds ──────────────────────────────────────────────────────────

/// Well-known task types for model routing decisions.
///
/// Each variant represents a class of workload with distinct model requirements.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum TaskKind {
    /// General conversation and chat.
    Chat,
    /// Code generation, editing, and analysis.
    Code,
    /// Autonomous agent loops with tool-calling.
    Agent,
    /// Cost-optimized tasks where price is primary.
    Cheap,
    /// Latency-sensitive tasks requiring fast responses.
    Fast,
    /// Embedding generation.
    Embedding,
}

impl TaskKind {
    /// Returns the string key used in configuration routing tables.
    pub fn as_str(&self) -> &str {
        match self {
            Self::Chat => "chat",
            Self::Code => "code",
            Self::Agent => "agent",
            Self::Cheap => "cheap",
            Self::Fast => "fast",
            Self::Embedding => "embedding",
        }
    }

    /// Parse a task kind from its configuration key.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "chat" => Some(Self::Chat),
            "code" => Some(Self::Code),
            "agent" => Some(Self::Agent),
            "cheap" => Some(Self::Cheap),
            "fast" => Some(Self::Fast),
            "embedding" => Some(Self::Embedding),
            _ => None,
        }
    }

    /// Returns the minimum capability requirements for this task kind.
    ///
    /// Used to filter models when no explicit route exists.
    pub fn required_capabilities(&self) -> ModelCapabilities {
        let mut caps = ModelCapabilities::default();
        match self {
            Self::Chat => {
                // Standard chat: streaming, reasonable context
                caps.supports_streaming = true;
                caps.supports_tools = true;
            }
            Self::Code => {
                // Code tasks need function calling and large context
                caps.supports_tools = true;
                caps.supports_function_calling = true;
                caps.context_window = 32_000.max(caps.context_window);
            }
            Self::Agent => {
                // Autonomous agents need full tool support
                caps.supports_tools = true;
                caps.supports_function_calling = true;
                caps.supports_streaming = true;
                caps.context_window = 16_000.max(caps.context_window);
            }
            Self::Cheap => {
                // Cost-sensitive: minimal requirements
                caps.supports_streaming = true;
            }
            Self::Fast => {
                // Speed-sensitive: prefer smaller context
                caps.supports_streaming = true;
                caps.context_window = 8_000;
                caps.max_tokens = 2_048;
            }
            Self::Embedding => {
                // Embedding models are non-generative
                caps.supports_embeddings = true;
                caps.supports_streaming = false;
                caps.supports_tools = false;
                caps.supports_function_calling = false;
                caps.supports_vision = false;
                caps.supports_json_mode = false;
                caps.max_tokens = 0;
            }
        }
        caps
    }
}

impl std::fmt::Display for TaskKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// ─── Internal State ──────────────────────────────────────────────────────

/// Internal mutable state for the registry.
struct RegistryInner {
    /// Registered providers keyed by provider ID.
    providers: HashMap<ProviderId, Box<dyn Provider>>,
    /// Cached model configurations keyed by model ID.
    model_configs: HashMap<ModelId, ModelConfig>,
    /// Explicit task-to-model routing overrides.
    task_routing: HashMap<String, ModelId>,
}

impl RegistryInner {
    fn new() -> Self {
        Self {
            providers: HashMap::new(),
            model_configs: HashMap::new(),
            task_routing: HashMap::new(),
        }
    }
}

// ─── Model Registry Implementation ──────────────────────────────────────

/// Production implementation of [`ModelRegistry`].
///
/// Manages provider registration, model configuration caching, and
/// task-aware model routing. Thread-safe via internal `RwLock`.
#[derive(Clone)]
pub struct ModelRegistryImpl {
    inner: Arc<RwLock<RegistryInner>>,
}

impl ModelRegistryImpl {
    /// Create an empty registry with no providers or models.
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(RegistryInner::new())),
        }
    }

    /// Build a registry from application configuration.
    ///
    /// Populates the task routing table from the `ModelsConfig.routing` section.
    /// Providers and model configs must be registered separately via
    /// [`register_provider`](ModelRegistry::register_provider) and
    /// [`register_model`](ModelRegistryImpl::register_model).
    pub fn from_config(config: &ModelsConfig) -> Self {
        let registry = Self::new();
        let routing = &config.routing;

        let mut inner = registry.inner.write().expect("registry lock poisoned");

        // Populate routing table from config
        if let Some(id) = &routing.chat {
            inner.task_routing.insert("chat".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.code {
            inner.task_routing.insert("code".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.agent {
            inner.task_routing.insert("agent".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.cheap {
            inner.task_routing.insert("cheap".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.fast {
            inner.task_routing.insert("fast".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.embedding {
            inner.task_routing.insert("embedding".into(), ModelId(id.clone()));
        }

        registry
    }

    /// Register a model configuration directly, without an associated provider.
    ///
    /// The provider must be registered separately before [`resolve_model`] is called
    /// for this model, otherwise resolution will fail with a provider-not-found error.
    pub fn register_model(&self, config: ModelConfig) {
        let mut inner = self.inner.write().expect("registry lock poisoned");
        inner.model_configs.insert(config.id.clone(), config);
    }

    /// Register multiple model configurations at once.
    pub fn register_models(&self, configs: Vec<ModelConfig>) {
        let mut inner = self.inner.write().expect("registry lock poisoned");
        for config in configs {
            inner.model_configs.insert(config.id.clone(), config);
        }
    }

    /// Remove a model configuration from the registry.
    pub fn unregister_model(&self, id: &ModelId) {
        let mut inner = self.inner.write().expect("registry lock poisoned");
        inner.model_configs.remove(id);
    }

    /// Set or override the model to use for a given task kind.
    pub fn set_task_route(&self, task: &str, model_id: ModelId) {
        let mut inner = self.inner.write().expect("registry lock poisoned");
        inner.task_routing.insert(task.to_string(), model_id);
    }

    /// Remove a task route override.
    pub fn clear_task_route(&self, task: &str) {
        let mut inner = self.inner.write().expect("registry lock poisoned");
        inner.task_routing.remove(task);
    }

    /// Find all providers whose capabilities satisfy the given requirements.
    ///
    /// Returns provider IDs that match all required capability flags.
    pub fn find_providers_with_capabilities(
        &self,
        required: &ProviderCapabilities,
    ) -> Vec<ProviderId> {
        let inner = self.inner.read().expect("registry lock poisoned");
        inner
            .providers
            .values()
            .filter(|p| {
                let caps = p.capabilities();
                (!required.streaming || caps.streaming)
                    && (!required.tools || caps.tools)
                    && (!required.vision || caps.vision)
                    && (!required.embeddings || caps.embeddings)
                    && (!required.json_mode || caps.json_mode)
            })
            .map(|p| p.id())
            .collect()
    }

    /// Check if a model satisfies the given capability requirements.
    ///
    /// Returns `true` if the model is registered and all required capabilities
    /// are supported or not requested (fields set to `false` in the requirement).
    pub fn model_supports(&self, model_id: &ModelId, required: &ModelCapabilities) -> bool {
        let inner = self.inner.read().expect("registry lock poisoned");
        match inner.model_configs.get(model_id) {
            Some(config) => {
                let caps = &config.capabilities;
                (required.max_tokens == 0 || caps.max_tokens >= required.max_tokens)
                    && (required.max_input_tokens == 0
                        || caps.max_input_tokens >= required.max_input_tokens)
                    && (!required.supports_streaming || caps.supports_streaming)
                    && (!required.supports_tools || caps.supports_tools)
                    && (!required.supports_vision || caps.supports_vision)
                    && (!required.supports_embeddings || caps.supports_embeddings)
                    && (!required.supports_function_calling || caps.supports_function_calling)
                    && (!required.supports_json_mode || caps.supports_json_mode)
                    && (required.context_window == 0
                        || caps.context_window >= required.context_window)
            }
            None => false,
        }
    }

    /// Select the best matching model for a task kind when no explicit route exists.
    ///
    /// Uses capability requirements and pricing heuristics:
    /// - Filters models to those meeting the task's minimum capabilities
    /// - For `Cheap`, prefers models with the lowest per-token pricing
    /// - For `Fast`, prefers models with smaller context windows (typically faster)
    /// - For other tasks, prefers models with broader capabilities
    fn select_best_model_for_task(&self, task: &TaskKind) -> AirisResult<ModelId> {
        let inner = self.inner.read().expect("registry lock poisoned");
        let required = task.required_capabilities();

        // Collect candidate models that satisfy minimum requirements
        let candidates: Vec<&ModelConfig> = inner
            .model_configs
            .values()
            .filter(|config| {
                let caps = &config.capabilities;
                // Model must satisfy all non-zero requirements
                (required.max_tokens == 0 || caps.max_tokens >= required.max_tokens)
                    && (required.max_input_tokens == 0
                        || caps.max_input_tokens >= required.max_input_tokens)
                    && (!required.supports_streaming || caps.supports_streaming)
                    && (!required.supports_tools || caps.supports_tools)
                    && (!required.supports_vision || caps.supports_vision)
                    && (!required.supports_embeddings || caps.supports_embeddings)
                    && (!required.supports_function_calling || caps.supports_function_calling)
                    && (!required.supports_json_mode || caps.supports_json_mode)
                    && (required.context_window == 0
                        || caps.context_window >= required.context_window)
            })
            .collect();

        if candidates.is_empty() {
            return Err(AirisError::ModelNotFound(format!(
                "no model available for task '{task}'"
            )));
        }

        // Score and pick the best model based on task needs
        match task {
            TaskKind::Cheap => {
                // Cheapest model first: sort by pricing
                candidates
                    .iter()
                    .min_by(|a, b| {
                        let cost_a = a
                            .pricing
                            .as_ref()
                            .map(|p| p.input_per_1m_tokens + p.output_per_1m_tokens)
                            .unwrap_or(0.0);
                        let cost_b = b
                            .pricing
                            .as_ref()
                            .map(|p| p.input_per_1m_tokens + p.output_per_1m_tokens)
                            .unwrap_or(0.0);
                        cost_a
                            .partial_cmp(&cost_b)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    })
                    .map(|c| c.id.clone())
                    .ok_or_else(|| {
                        AirisError::ModelNotFound(format!("no model for task '{task}'"))
                    })
            }
            TaskKind::Fast => {
                // Fastest model: prefer smaller context windows (less to process)
                candidates
                    .iter()
                    .min_by_key(|c| c.capabilities.context_window)
                    .map(|c| c.id.clone())
                    .ok_or_else(|| {
                        AirisError::ModelNotFound(format!("no model for task '{task}'"))
                    })
            }
            TaskKind::Embedding => {
                // Must have embedding support (already filtered above)
                candidates
                    .first()
                    .map(|c| c.id.clone())
                    .ok_or_else(|| {
                        AirisError::ModelNotFound(format!("no model for task '{task}'"))
                    })
            }
            _ => {
                // Chat, Code, Agent: prefer the model with the richest capabilities.
                // Score = context_window + max_tokens (heuristic for capability depth).
                candidates
                    .iter()
                    .max_by_key(|c| c.capabilities.context_window + c.capabilities.max_tokens)
                    .map(|c| c.id.clone())
                    .ok_or_else(|| {
                        AirisError::ModelNotFound(format!("no model for task '{task}'"))
                    })
            }
        }
    }
}

impl Default for ModelRegistryImpl {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Trait Implementation ────────────────────────────────────────────────

impl ModelRegistry for ModelRegistryImpl {
    fn register_provider(&self, provider: Box<dyn Provider>) {
        let id = provider.id();
        let mut inner = self.inner.write().expect("registry lock poisoned");
        inner.providers.insert(id, provider);
    }

    fn providers(&self) -> Vec<Box<dyn Provider>> {
        let inner = self.inner.read().expect("registry lock poisoned");
        inner.providers.values().map(|p| p.box_clone()).collect()
    }

    fn provider(&self, id: &ProviderId) -> Option<Box<dyn Provider>> {
        let inner = self.inner.read().expect("registry lock poisoned");
        inner.providers.get(id).map(|p| p.box_clone())
    }

    fn model(&self, id: &ModelId) -> Option<ModelConfig> {
        let inner = self.inner.read().expect("registry lock poisoned");
        inner.model_configs.get(id).cloned()
    }

    fn resolve_model(&self, id: &ModelId) -> AirisResult<(Box<dyn Provider>, ModelConfig)> {
        let inner = self.inner.read().expect("registry lock poisoned");

        let config = inner
            .model_configs
            .get(id)
            .cloned()
            .ok_or_else(|| AirisError::ModelNotFound(id.to_string()))?;

        let provider = inner
            .providers
            .get(&config.provider)
            .map(|p| p.box_clone())
            .ok_or_else(|| {
                AirisError::ProviderNotAvailable(format!(
                    "provider '{}' for model '{}'",
                    config.provider, id
                ))
            })?;

        Ok((provider, config))
    }

    fn model_for_task(&self, task: &str) -> AirisResult<ModelId> {
        let inner = self.inner.read().expect("registry lock poisoned");

        // First, check for an explicit route override
        if let Some(model_id) = inner.task_routing.get(task) {
            return Ok(model_id.clone());
        }

        // If it's a known task kind, use heuristic selection
        if let Some(task_kind) = TaskKind::from_str(task) {
            // Drop the read lock before calling select_best_model_for_task
            // to avoid deadlock if it needs write access (it doesn't currently,
            // but best practice).
            drop(inner);
            return self.select_best_model_for_task(&task_kind);
        }

        // Unknown task kind with no explicit route
        Err(AirisError::ModelNotFound(format!(
            "no route or model for unknown task '{task}'; \
             register a route with set_task_route or use a known task kind \
             (chat, code, agent, cheap, fast, embedding)"
        )))
    }

    fn list_models(&self) -> Vec<ModelConfig> {
        let inner = self.inner.read().expect("registry lock poisoned");
        inner.model_configs.values().cloned().collect()
    }
}

// ─── Utility Functions ───────────────────────────────────────────────────

/// Builder for constructing a configured [`ModelRegistryImpl`].
///
/// Provides a fluent API for registering providers, models, and routes
/// before finalizing.
#[derive(Clone, Default)]
pub struct ModelRegistryBuilder {
    providers: Vec<Box<dyn Provider>>,
    model_configs: Vec<ModelConfig>,
    task_routes: HashMap<String, ModelId>,
}

impl ModelRegistryBuilder {
    /// Create a new builder.
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a provider to the registry.
    pub fn with_provider(mut self, provider: Box<dyn Provider>) -> Self {
        self.providers.push(provider);
        self
    }

    /// Add a model configuration.
    pub fn with_model(mut self, config: ModelConfig) -> Self {
        self.model_configs.push(config);
        self
    }

    /// Add multiple model configurations.
    pub fn with_models(mut self, configs: Vec<ModelConfig>) -> Self {
        self.model_configs.extend(configs);
        self
    }

    /// Set a task route override.
    pub fn with_route(mut self, task: impl Into<String>, model_id: ModelId) -> Self {
        self.task_routes.insert(task.into(), model_id);
        self
    }

    /// Apply routing from a [`ModelRouting`] configuration.
    pub fn with_routing(mut self, routing: &ModelRouting) -> Self {
        if let Some(id) = &routing.chat {
            self.task_routes.insert("chat".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.code {
            self.task_routes.insert("code".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.agent {
            self.task_routes.insert("agent".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.cheap {
            self.task_routes.insert("cheap".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.fast {
            self.task_routes.insert("fast".into(), ModelId(id.clone()));
        }
        if let Some(id) = &routing.embedding {
            self.task_routes
                .insert("embedding".into(), ModelId(id.clone()));
        }
        self
    }

    /// Build the [`ModelRegistryImpl`].
    pub fn build(self) -> ModelRegistryImpl {
        let registry = ModelRegistryImpl::new();
        for provider in self.providers {
            registry.register_provider(provider);
        }
        registry.register_models(self.model_configs);
        for (task, model_id) in self.task_routes {
            registry.set_task_route(&task, model_id);
        }
        registry
    }
}

// ─── Registration helpers for common provider patterns ──────────────────

/// Register a provider and its available models into a registry.
///
/// This is a convenience that:
/// 1. Registers the provider
/// 2. For each model ID in `model_ids`, creates a minimal [`ModelConfig`] and registers it
///
/// Full model configurations (with capabilities and pricing) should be registered
/// separately via [`ModelRegistryImpl::register_model`] for production use.
pub fn register_provider_with_models(
    registry: &ModelRegistryImpl,
    provider: Box<dyn Provider>,
    model_ids: Vec<&str>,
) {
    let provider_id = provider.id();
    registry.register_provider(provider);

    for model_id in model_ids {
        let config = ModelConfig {
            id: ModelId(model_id.to_string()),
            provider: provider_id.clone(),
            display_name: model_id.to_string(),
            capabilities: ModelCapabilities::default(),
            default_params: ModelParams::default(),
            pricing: None,
        };
        registry.register_model(config);
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    /// A simple mock provider for testing.
    struct MockProvider {
        id: ProviderId,
        name: String,
        caps: ProviderCapabilities,
    }

    impl MockProvider {
        fn new(id: &str, caps: ProviderCapabilities) -> Self {
            Self {
                id: ProviderId(id.into()),
                name: id.to_string(),
                caps,
            }
        }
    }

    #[async_trait]
    impl Provider for MockProvider {
        fn id(&self) -> ProviderId {
            self.id.clone()
        }

        fn display_name(&self) -> &str {
            &self.name
        }

        async fn list_models(&self) -> AirisResult<Vec<ModelConfig>> {
            Ok(vec![ModelConfig {
                id: ModelId(format!("{}/test-model", self.id)),
                provider: self.id.clone(),
                display_name: "Test Model".into(),
                capabilities: ModelCapabilities::default(),
                default_params: ModelParams::default(),
                pricing: None,
            }])
        }

        async fn model_available(&self, _model: &ModelId) -> AirisResult<bool> {
            Ok(true)
        }

        async fn complete(
            &self,
            _model: &ModelId,
            _messages: &[Message],
            _params: &ModelParams,
            _tools: &[ToolDefinition],
        ) -> AirisResult<Message> {
            Ok(Message::new(MessageRole::Assistant, "mock response"))
        }

        async fn complete_stream(
            &self,
            _model: &ModelId,
            _messages: &[Message],
            _params: &ModelParams,
            _tools: &[ToolDefinition],
            _handler: Box<dyn StreamHandler>,
        ) -> AirisResult<Message> {
            Ok(Message::new(MessageRole::Assistant, "mock stream response"))
        }

        async fn embed(
            &self,
            _model: &ModelId,
            _input: &[String],
        ) -> AirisResult<Vec<Vec<f32>>> {
            Ok(vec![vec![0.1, 0.2, 0.3]])
        }

        async fn count_tokens(&self, _model: &ModelId, text: &str) -> AirisResult<usize> {
            Ok(text.len())
        }

        fn capabilities(&self) -> ProviderCapabilities {
            self.caps.clone()
        }

        fn box_clone(&self) -> Box<dyn Provider> {
            Box::new(Self {
                id: self.id.clone(),
                name: self.name.clone(),
                caps: self.caps.clone(),
            })
        }
    }

    fn test_model_config(id: &str, provider: &ProviderId) -> ModelConfig {
        ModelConfig {
            id: ModelId(id.into()),
            provider: provider.clone(),
            display_name: id.into(),
            capabilities: ModelCapabilities {
                context_window: 128_000,
                max_tokens: 4096,
                ..ModelCapabilities::default()
            },
            default_params: ModelParams::default(),
            pricing: None,
        }
    }

    #[test]
    fn test_new_registry_is_empty() {
        let registry = ModelRegistryImpl::new();
        assert!(registry.list_models().is_empty());
        assert!(registry.providers().is_empty());
    }

    #[test]
    fn test_register_and_query_provider() {
        let registry = ModelRegistryImpl::new();
        let caps = ProviderCapabilities {
            streaming: true,
            tools: true,
            vision: false,
            embeddings: false,
            json_mode: true,
        };
        let provider = MockProvider::new("test-provider", caps);

        registry.register_provider(Box::new(provider));

        assert_eq!(registry.providers().len(), 1);

        let retrieved = registry.provider(&ProviderId("test-provider".into()));
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id(), ProviderId("test-provider".into()));
    }

    #[test]
    fn test_register_and_resolve_model() {
        let registry = ModelRegistryImpl::new();
        let provider_id = ProviderId("test-provider".into());
        let caps = ProviderCapabilities {
            streaming: true,
            tools: true,
            vision: false,
            embeddings: false,
            json_mode: true,
        };
        let provider = MockProvider::new("test-provider", caps);
        registry.register_provider(Box::new(provider));

        let config = test_model_config("test-provider/gpt-4", &provider_id);
        let model_id = config.id.clone();
        registry.register_model(config);

        let model = registry.model(&model_id);
        assert!(model.is_some());
        assert_eq!(model.unwrap().id, model_id);

        let resolved = registry.resolve_model(&model_id);
        assert!(resolved.is_ok());
        let (_provider, resolved_config) = resolved.unwrap();
        assert_eq!(resolved_config.id, model_id);
    }

    #[test]
    fn test_resolve_model_not_found() {
        let registry = ModelRegistryImpl::new();
        let result = registry.resolve_model(&ModelId("nonexistent".into()));
        assert!(result.is_err());
    }

    #[test]
    fn test_resolve_model_provider_missing() {
        let registry = ModelRegistryImpl::new();
        let config = test_model_config("orphan-model", &ProviderId("missing-provider".into()));
        registry.register_model(config);

        let result = registry.resolve_model(&ModelId("orphan-model".into()));
        assert!(result.is_err());
    }

    #[test]
    fn test_task_routing_explicit() {
        let registry = ModelRegistryImpl::new();
        let provider_id = ProviderId("test".into());
        let provider = MockProvider::new("test", ProviderCapabilities {
            streaming: true,
            tools: true,
            vision: false,
            embeddings: false,
            json_mode: true,
        });
        registry.register_provider(Box::new(provider));

        let chat_model = test_model_config("test/chat-model", &provider_id);
        let chat_id = chat_model.id.clone();
        registry.register_model(chat_model.clone());

        let code_model = test_model_config("test/code-model", &provider_id);
        let code_id = code_model.id.clone();
        registry.register_model(code_model.clone());

        // Set explicit routes
        registry.set_task_route("chat", chat_id.clone());
        registry.set_task_route("code", code_id.clone());

        assert_eq!(registry.model_for_task("chat").unwrap(), chat_id);
        assert_eq!(registry.model_for_task("code").unwrap(), code_id);
    }

    #[test]
    fn test_task_routing_with_unknown_task() {
        let registry = ModelRegistryImpl::new();
        let result = registry.model_for_task("unknown-task");
        assert!(result.is_err());
    }

    #[test]
    fn test_find_providers_with_capabilities() {
        let registry = ModelRegistryImpl::new();

        let full_provider = MockProvider::new(
            "full",
            ProviderCapabilities {
                streaming: true,
                tools: true,
                vision: true,
                embeddings: true,
                json_mode: true,
            },
        );
        registry.register_provider(Box::new(full_provider));

        let basic_provider = MockProvider::new(
            "basic",
            ProviderCapabilities {
                streaming: true,
                tools: false,
                vision: false,
                embeddings: false,
                json_mode: false,
            },
        );
        registry.register_provider(Box::new(basic_provider));

        // Find providers with vision capability
        let vision_providers = registry.find_providers_with_capabilities(&ProviderCapabilities {
            streaming: false,
            tools: false,
            vision: true,
            embeddings: false,
            json_mode: false,
        });
        assert_eq!(vision_providers.len(), 1);
        assert_eq!(vision_providers[0], ProviderId("full".into()));

        // Find providers with streaming (both have it)
        let streaming_providers =
            registry.find_providers_with_capabilities(&ProviderCapabilities {
                streaming: true,
                tools: false,
                vision: false,
                embeddings: false,
                json_mode: false,
            });
        assert_eq!(streaming_providers.len(), 2);
    }

    #[test]
    fn test_model_supports_capabilities() {
        let registry = ModelRegistryImpl::new();
        let provider_id = ProviderId("test".into());
        let provider = MockProvider::new("test", ProviderCapabilities::default());
        registry.register_provider(Box::new(provider));

        let mut config = test_model_config("test/model", &provider_id);
        config.capabilities.supports_vision = true;
        config.capabilities.context_window = 100_000;
        let model_id = config.id.clone();
        registry.register_model(config);

        // Model supports vision
        assert!(registry.model_supports(
            &model_id,
            &ModelCapabilities {
                supports_vision: true,
                ..ModelCapabilities::default()
            }
        ));

        // Model does NOT support embeddings
        assert!(!registry.model_supports(
            &model_id,
            &ModelCapabilities {
                supports_embeddings: true,
                ..ModelCapabilities::default()
            }
        ));

        // Context window requirement satisfied
        assert!(registry.model_supports(
            &model_id,
            &ModelCapabilities {
                context_window: 50_000,
                ..ModelCapabilities::default()
            }
        ));

        // Context window requirement too large
        assert!(!registry.model_supports(
            &model_id,
            &ModelCapabilities {
                context_window: 200_000,
                ..ModelCapabilities::default()
            }
        ));
    }

    #[test]
    fn test_from_config_builds_routing_table() {
        let routing = ModelRouting {
            chat: Some("gpt-4".into()),
            code: Some("gpt-4".into()),
            agent: Some("claude-3".into()),
            cheap: Some("gpt-3.5-turbo".into()),
            fast: Some("gpt-4o-mini".into()),
            embedding: Some("text-embedding-3".into()),
        };
        let models_config = ModelsConfig {
            enabled: vec![],
            routing,
        };

        let registry = ModelRegistryImpl::from_config(&models_config);

        assert_eq!(
            registry.model_for_task("chat").unwrap(),
            ModelId("gpt-4".into())
        );
        assert_eq!(
            registry.model_for_task("code").unwrap(),
            ModelId("gpt-4".into())
        );
        assert_eq!(
            registry.model_for_task("agent").unwrap(),
            ModelId("claude-3".into())
        );
        assert_eq!(
            registry.model_for_task("cheap").unwrap(),
            ModelId("gpt-3.5-turbo".into())
        );
        assert_eq!(
            registry.model_for_task("fast").unwrap(),
            ModelId("gpt-4o-mini".into())
        );
        assert_eq!(
            registry.model_for_task("embedding").unwrap(),
            ModelId("text-embedding-3".into())
        );
    }

    #[test]
    fn test_heuristic_routing_when_no_explicit_route() {
        let registry = ModelRegistryImpl::new();
        let provider_id = ProviderId("provider".into());
        let provider = MockProvider::new(
            "provider",
            ProviderCapabilities {
                streaming: true,
                tools: true,
                vision: false,
                embeddings: false,
                json_mode: true,
            },
        );
        registry.register_provider(Box::new(provider));

        // Register a capable model for chat/code/agent tasks
        let big_model = ModelConfig {
            id: ModelId("big-model".into()),
            provider: provider_id.clone(),
            display_name: "Big Capable Model".into(),
            capabilities: ModelCapabilities {
                max_tokens: 8192,
                max_input_tokens: 128_000,
                supports_streaming: true,
                supports_tools: true,
                supports_vision: false,
                supports_embeddings: false,
                supports_function_calling: true,
                supports_json_mode: true,
                context_window: 128_000,
            },
            default_params: ModelParams::default(),
            pricing: None,
        };
        let big_id = big_model.id.clone();
        registry.register_model(big_model);

        // Chat should find the big model via heuristic
        let chat_model = registry.model_for_task("chat");
        assert!(chat_model.is_ok());
        assert_eq!(chat_model.unwrap(), big_id);
    }

    #[test]
    fn test_heuristic_cheap_routing() {
        let registry = ModelRegistryImpl::new();
        let provider_id = ProviderId("provider".into());
        let provider = MockProvider::new(
            "provider",
            ProviderCapabilities {
                streaming: true,
                tools: true,
                vision: false,
                embeddings: false,
                json_mode: true,
            },
        );
        registry.register_provider(Box::new(provider));

        // Expensive model
        registry.register_model(ModelConfig {
            id: ModelId("expensive".into()),
            provider: provider_id.clone(),
            display_name: "Expensive".into(),
            capabilities: ModelCapabilities::default(),
            default_params: ModelParams::default(),
            pricing: Some(ModelPricing {
                input_per_1m_tokens: 30.0,
                output_per_1m_tokens: 60.0,
                currency: "USD".into(),
            }),
        });

        // Cheap model
        registry.register_model(ModelConfig {
            id: ModelId("cheap-model".into()),
            provider: provider_id.clone(),
            display_name: "Cheap".into(),
            capabilities: ModelCapabilities::default(),
            default_params: ModelParams::default(),
            pricing: Some(ModelPricing {
                input_per_1m_tokens: 0.5,
                output_per_1m_tokens: 1.5,
                currency: "USD".into(),
            }),
        });

        let result = registry.model_for_task("cheap");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), ModelId("cheap-model".into()));
    }

    #[test]
    fn test_model_registry_builder() {
        let provider_id = ProviderId("builder-test".into());
        let provider = MockProvider::new(
            "builder-test",
            ProviderCapabilities {
                streaming: true,
                tools: true,
                vision: false,
                embeddings: false,
                json_mode: true,
            },
        );

        let config = test_model_config("builder-test/model-1", &provider_id);

        let registry = ModelRegistryBuilder::new()
            .with_provider(Box::new(provider))
            .with_model(config.clone())
            .with_route("chat", ModelId("builder-test/model-1".into()))
            .build();

        assert_eq!(registry.providers().len(), 1);
        assert_eq!(registry.list_models().len(), 1);
        assert_eq!(
            registry.model_for_task("chat").unwrap(),
            ModelId("builder-test/model-1".into())
        );
    }

    #[test]
    fn test_register_provider_with_models_helper() {
        let registry = ModelRegistryImpl::new();
        let provider = MockProvider::new(
            "helper-test",
            ProviderCapabilities {
                streaming: true,
                tools: false,
                vision: false,
                embeddings: false,
                json_mode: false,
            },
        );

        register_provider_with_models(
            &registry,
            Box::new(provider),
            vec!["helper-test/model-a", "helper-test/model-b"],
        );

        assert_eq!(registry.list_models().len(), 2);
        assert!(registry.model(&ModelId("helper-test/model-a".into())).is_some());
        assert!(registry.model(&ModelId("helper-test/model-b".into())).is_some());
    }

    #[test]
    fn test_unregister_model() {
        let registry = ModelRegistryImpl::new();
        let provider_id = ProviderId("test".into());
        let config = test_model_config("test/model", &provider_id);
        let model_id = config.id.clone();
        registry.register_model(config);
        assert!(registry.model(&model_id).is_some());

        registry.unregister_model(&model_id);
        assert!(registry.model(&model_id).is_none());
    }

    #[test]
    fn test_clear_task_route() {
        let registry = ModelRegistryImpl::new();
        registry.set_task_route("chat", ModelId("gpt-4".into()));
        assert!(registry.model_for_task("chat").is_ok());

        registry.clear_task_route("chat");
        // After clearing, no models registered, so it should fail
        assert!(registry.model_for_task("chat").is_err());
    }

    #[test]
    fn test_task_kind_display_and_parse() {
        assert_eq!(TaskKind::Chat.as_str(), "chat");
        assert_eq!(TaskKind::Code.as_str(), "code");
        assert_eq!(TaskKind::Agent.as_str(), "agent");
        assert_eq!(TaskKind::Cheap.as_str(), "cheap");
        assert_eq!(TaskKind::Fast.as_str(), "fast");
        assert_eq!(TaskKind::Embedding.as_str(), "embedding");

        assert_eq!(TaskKind::from_str("chat"), Some(TaskKind::Chat));
        assert_eq!(TaskKind::from_str("unknown"), None);

        assert_eq!(format!("{}", TaskKind::Chat), "chat");
    }

    #[test]
    fn test_task_kind_required_caps_embedding() {
        let caps = TaskKind::Embedding.required_capabilities();
        assert!(caps.supports_embeddings);
        assert!(!caps.supports_streaming);
        assert!(!caps.supports_tools);
        assert!(!caps.supports_function_calling);
    }

    #[test]
    fn test_task_kind_required_caps_code() {
        let caps = TaskKind::Code.required_capabilities();
        assert!(caps.supports_tools);
        assert!(caps.supports_function_calling);
        assert!(caps.context_window >= 32_000);
    }

    #[test]
    fn test_fast_routing_prefers_smaller_context() {
        let registry = ModelRegistryImpl::new();
        let provider_id = ProviderId("provider".into());
        let provider = MockProvider::new(
            "provider",
            ProviderCapabilities::default(),
        );
        registry.register_provider(Box::new(provider));

        registry.register_model(ModelConfig {
            id: ModelId("big-context".into()),
            provider: provider_id.clone(),
            display_name: "Big".into(),
            capabilities: ModelCapabilities {
                context_window: 128_000,
                ..ModelCapabilities::default()
            },
            default_params: ModelParams::default(),
            pricing: None,
        });

        registry.register_model(ModelConfig {
            id: ModelId("small-context".into()),
            provider: provider_id,
            display_name: "Small".into(),
            capabilities: ModelCapabilities {
                context_window: 8_000,
                ..ModelCapabilities::default()
            },
            default_params: ModelParams::default(),
            pricing: None,
        });

        let result = registry.model_for_task("fast");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), ModelId("small-context".into()));
    }

    #[test]
    fn test_concurrent_access() {
        use std::thread;
        let registry = Arc::new(ModelRegistryImpl::new());
        let provider_id = ProviderId("concurrent".into());

        let mut handles = vec![];
        for i in 0..10 {
            let reg = registry.clone();
            let pid = provider_id.clone();
            handles.push(thread::spawn(move || {
                let config = test_model_config(
                    &format!("concurrent/model-{}", i),
                    &pid,
                );
                reg.register_model(config);
            }));
        }

        for h in handles {
            h.join().unwrap();
        }

        assert_eq!(registry.list_models().len(), 10);
    }
}
