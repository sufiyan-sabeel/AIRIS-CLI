//! Core trait definitions for the AIRIS-CLI system.
//!
//! These traits define the interfaces that all provider, model, tool, and
//! agent implementations must satisfy.

use crate::error::AirisResult;
use crate::streaming::StreamHandler;
use crate::types::*;
use async_trait::async_trait;
use std::collections::HashMap;

// ─── Provider ──────────────────────────────────────────────────────────────

/// A model provider (OpenAI, Anthropic, Ollama, etc.)
#[async_trait]
pub trait Provider: Send + Sync {
    /// Unique provider identifier.
    fn id(&self) -> ProviderId;

    /// Human-readable provider name.
    fn display_name(&self) -> &str;

    /// List models available from this provider.
    async fn list_models(&self) -> AirisResult<Vec<ModelConfig>>;

    /// Check if a specific model is available.
    async fn model_available(&self, model: &ModelId) -> AirisResult<bool>;

    /// Generate a completion (non-streaming).
    async fn complete(
        &self,
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
    ) -> AirisResult<Message>;

    /// Generate a completion (streaming).
    async fn complete_stream(
        &self,
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
        handler: Box<dyn StreamHandler>,
    ) -> AirisResult<Message>;

    /// Generate embeddings.
    async fn embed(&self, model: &ModelId, input: &[String]) -> AirisResult<Vec<Vec<f32>>>;

    /// Count tokens in the given text.
    async fn count_tokens(&self, model: &ModelId, text: &str) -> AirisResult<usize>;

    /// Provider capabilities.
    fn capabilities(&self) -> ProviderCapabilities;

    /// Clone as boxed trait object.
    fn box_clone(&self) -> Box<dyn Provider>;
}

// ─── Model Registry ────────────────────────────────────────────────────────

/// Registry of available models across all providers.
#[async_trait]
pub trait ModelRegistry: Send + Sync {
    /// Register a provider.
    fn register_provider(&self, provider: Box<dyn Provider>);

    /// Get all registered providers.
    fn providers(&self) -> Vec<Box<dyn Provider>>;

    /// Get a provider by ID.
    fn provider(&self, id: &ProviderId) -> Option<Box<dyn Provider>>;

    /// Get model configuration.
    fn model(&self, id: &ModelId) -> Option<ModelConfig>;

    /// Resolve a model ID to (provider, model_config).
    fn resolve_model(&self, id: &ModelId) -> AirisResult<(Box<dyn Provider>, ModelConfig)>;

    /// Get the best model for a task type.
    fn model_for_task(&self, task: &str) -> AirisResult<ModelId>;

    /// List all available models.
    fn list_models(&self) -> Vec<ModelConfig>;
}

// ─── Session ───────────────────────────────────────────────────────────────

/// Session persistence.
#[async_trait]
pub trait SessionStore: Send + Sync {
    /// Save session data.
    async fn save(&self, session: &SessionData) -> AirisResult<()>;

    /// Load session by ID.
    async fn load(&self, id: &Uuid) -> AirisResult<SessionData>;

    /// List all session IDs.
    async fn list(&self) -> AirisResult<Vec<(Uuid, String, DateTime<Utc>)>>;

    /// Delete a session.
    async fn delete(&self, id: &Uuid) -> AirisResult<()>;

    /// Search sessions by query.
    async fn search(&self, query: &str) -> AirisResult<Vec<SessionData>>;
}

// ─── Cache ─────────────────────────────────────────────────────────────────

/// Key-value cache with TTL support.
#[async_trait]
pub trait CacheStore: Send + Sync {
    /// Get a value.
    async fn get(&self, key: &str) -> AirisResult<Option<Vec<u8>>>;

    /// Set a value with optional TTL (seconds).
    async fn set(&self, key: &str, value: Vec<u8>, ttl_secs: Option<u64>) -> AirisResult<()>;

    /// Delete a key.
    async fn delete(&self, key: &str) -> AirisResult<()>;

    /// Check if key exists.
    async fn exists(&self, key: &str) -> AirisResult<bool>;

    /// Clear all entries.
    async fn clear(&self) -> AirisResult<()>;

    /// Get cache stats.
    async fn stats(&self) -> AirisResult<CacheStats>;
}

/// Cache statistics.
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub entries: usize,
    pub size_bytes: u64,
    pub hits: u64,
    pub misses: u64,
}

// ─── Agent ─────────────────────────────────────────────────────────────────

/// Agent execution engine.
#[async_trait]
pub trait Agent: Send + Sync {
    /// Agent identifier.
    fn id(&self) -> &str;

    /// Agent human-readable name.
    fn name(&self) -> &str;

    /// Execute a single step with context.
    async fn step(&self, context: AgentContext) -> AirisResult<AgentStep>;

    /// Run the agent to completion with a goal.
    async fn run(&self, goal: &str, context: AgentContext) -> AirisResult<AgentResult>;

    /// Reset agent state.
    async fn reset(&self) -> AirisResult<()>;
}

/// Context passed to an agent for execution.
#[derive(Debug, Clone)]
pub struct AgentContext {
    pub messages: Vec<Message>,
    pub tools: Vec<ToolDefinition>,
    pub workspace: Option<PathBuf>,
    pub model: ModelId,
    pub max_steps: usize,
    pub session: Option<SessionData>,
}

impl Default for AgentContext {
    fn default() -> Self {
        Self {
            messages: Vec::new(),
            tools: Vec::new(),
            workspace: None,
            model: ModelId("default".into()),
            max_steps: 25,
            session: None,
        }
    }
}

/// Result of an agent execution.
#[derive(Debug, Clone)]
pub struct AgentStep {
    pub action: AgentAction,
    pub tool_result: Option<ToolResult>,
    pub message: Option<Message>,
    pub finished: bool,
}

/// Final result of an agent run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResult {
    pub success: bool,
    pub output: String,
    pub steps_taken: usize,
    pub total_duration_ms: u64,
    pub token_usage: TokenUsage,
    pub plan: Option<ExecutionPlan>,
}

// ─── Planner ───────────────────────────────────────────────────────────────

/// Task planning and decomposition.
#[async_trait]
pub trait Planner: Send + Sync {
    /// Create a plan from a goal.
    async fn plan(&self, goal: &str, context: &[Message]) -> AirisResult<ExecutionPlan>;

    /// Refine an existing plan.
    async fn refine(&self, plan: &ExecutionPlan, feedback: &str) -> AirisResult<ExecutionPlan>;

    /// Check if a plan step can be executed.
    async fn validate_step(&self, step: &PlanStep) -> AirisResult<bool>;
}

// ─── Tools ─────────────────────────────────────────────────────────────────

/// A single tool that an agent can invoke.
#[async_trait]
pub trait Tool: Send + Sync {
    /// Tool name (used in function calling).
    fn name(&self) -> &str;

    /// Tool description for the model.
    fn description(&self) -> &str;

    /// Tool parameters as JSON Schema.
    fn parameters(&self) -> serde_json::Value;

    /// Execute the tool with given arguments.
    async fn execute(&self, args: serde_json::Value) -> AirisResult<ToolResult>;
}

/// Registry of available tools.
#[async_trait]
pub trait ToolRegistry: Send + Sync {
    /// Register a tool.
    fn register(&self, tool: Box<dyn Tool>);

    /// Get a tool by name.
    fn get(&self, name: &str) -> Option<Box<dyn Tool>>;

    /// List all registered tools as definitions.
    fn definitions(&self) -> Vec<ToolDefinition>;

    /// Get all tool names.
    fn names(&self) -> Vec<String>;
}

// ─── Editor ────────────────────────────────────────────────────────────────

/// File editing capabilities.
#[async_trait]
pub trait Editor: Send + Sync {
    /// Read file contents.
    async fn read(&self, path: &Path) -> AirisResult<String>;

    /// Write file contents.
    async fn write(&self, path: &Path, content: &str) -> AirisResult<()>;

    /// Apply an edit (find old_text, replace with new_text).
    async fn edit(&self, edit: &FileEdit) -> AirisResult<()>;

    /// Apply a diff/patch.
    async fn apply_patch(&self, path: &Path, patch: &str) -> AirisResult<()>;

    /// Get diff between current and original.
    async fn diff(&self, path: &Path) -> AirisResult<String>;

    /// Undo last edit.
    async fn undo(&self) -> AirisResult<UndoEntry>;

    /// Get undo history.
    async fn undo_history(&self) -> AirisResult<Vec<UndoEntry>>;

    /// Get file content at a specific line range.
    async fn read_range(&self, path: &Path, start: usize, end: usize) -> AirisResult<String>;

    /// Create a new file.
    async fn create_file(&self, path: &Path, content: &str) -> AirisResult<()>;

    /// Delete a file.
    async fn delete_file(&self, path: &Path) -> AirisResult<()>;
}

// ─── Terminal ──────────────────────────────────────────────────────────────

/// Terminal/command execution.
#[async_trait]
pub trait Terminal: Send + Sync {
    /// Execute a command and return output.
    async fn execute(&self, command: &str, cwd: Option<&Path>, timeout_secs: Option<u64>) -> AirisResult<TerminalOutput>;

    /// Execute a command with streaming output.
    async fn execute_stream(
        &self,
        command: &str,
        cwd: Option<&Path>,
        on_stdout: Box<dyn Fn(&str) + Send>,
        on_stderr: Box<dyn Fn(&str) + Send>,
    ) -> AirisResult<i32>;

    /// Check if a command is available.
    async fn which(&self, command: &str) -> AirisResult<bool>;

    /// Get current working directory.
    async fn cwd(&self) -> AirisResult<String>;
}

// ─── Git ───────────────────────────────────────────────────────────────────

/// Git integration.
#[async_trait]
pub trait GitOps: Send + Sync {
    /// Check if inside a git repo.
    async fn is_repo(&self, path: &Path) -> AirisResult<bool>;

    /// Get current branch name.
    async fn current_branch(&self, path: &Path) -> AirisResult<String>;

    /// Get git status.
    async fn status(&self, path: &Path) -> AirisResult<String>;

    /// Get staged diff.
    async fn staged_diff(&self, path: &Path) -> AirisResult<String>;

    /// Get unstaged diff.
    async fn unstaged_diff(&self, path: &Path) -> AirisResult<String>;

    /// Stage files.
    async fn add(&self, path: &Path, files: &[PathBuf]) -> AirisResult<()>;

    /// Commit with message.
    async fn commit(&self, path: &Path, message: &str) -> AirisResult<()>;

    /// Get commit log.
    async fn log(&self, path: &Path, max_count: usize) -> AirisResult<Vec<String>>;

    /// Get file history.
    async fn file_history(&self, path: &Path, file: &Path) -> AirisResult<Vec<String>>;

    /// Create a commit message for the current changes.
    async fn generate_commit_message(&self, path: &Path) -> AirisResult<String>;
}

// ─── Workspace ─────────────────────────────────────────────────────────────

/// Workspace management.
#[async_trait]
pub trait WorkspaceManager: Send + Sync {
    /// Set workspace root.
    async fn set_root(&self, path: &Path) -> AirisResult<()>;

    /// Get workspace root.
    fn root(&self) -> Option<PathBuf>;

    /// Get workspace summary.
    async fn summary(&self) -> AirisResult<WorkspaceSummary>;

    /// List files matching pattern.
    async fn list_files(&self, pattern: &str) -> AirisResult<Vec<PathBuf>>;

    /// Read a workspace file.
    async fn read_file(&self, relative_path: &Path) -> AirisResult<String>;

    /// Get workspace configuration.
    async fn config(&self) -> AirisResult<serde_json::Value>;
}

// ─── Memory ────────────────────────────────────────────────────────────────

/// Long-term memory.
#[async_trait]
pub trait MemoryStore: Send + Sync {
    /// Store a memory entry.
    async fn store(&self, entry: MemoryEntry) -> AirisResult<()>;

    /// Recall memories by query.
    async fn recall(&self, query: &str, limit: usize) -> AirisResult<Vec<MemoryEntry>>;

    /// Recall memories by type.
    async fn recall_by_type(&self, entry_type: MemoryType, limit: usize) -> AirisResult<Vec<MemoryEntry>>;

    /// Recall memories by importance.
    async fn recall_important(&self, min_importance: f64, limit: usize) -> AirisResult<Vec<MemoryEntry>>;

    /// Delete a memory entry.
    async fn forget(&self, id: &Uuid) -> AirisResult<()>;

    /// Consolidate/summarize memories.
    async fn consolidate(&self) -> AirisResult<()>;

    /// Get memory statistics.
    async fn stats(&self) -> AirisResult<MemoryStats>;
}

#[derive(Debug, Clone)]
pub struct MemoryStats {
    pub total_entries: usize,
    pub episodic: usize,
    pub semantic: usize,
    pub procedural: usize,
    pub working: usize,
    pub oldest: Option<DateTime<Utc>>,
    pub newest: Option<DateTime<Utc>>,
}

// ─── Indexer ───────────────────────────────────────────────────────────────

/// Code search and project index.
#[async_trait]
pub trait Indexer: Send + Sync {
    /// Index a workspace.
    async fn index(&self, root: &Path) -> AirisResult<IndexStats>;

    /// Search code by query.
    async fn search(&self, query: &str, limit: usize) -> AirisResult<Vec<SearchResult>>;

    /// Search symbols by name.
    async fn search_symbols(&self, name: &str, kind: Option<SymbolKind>) -> AirisResult<Vec<Symbol>>;

    /// Get file index entry.
    async fn get_file(&self, path: &Path) -> AirisResult<Option<IndexedFile>>;

    /// Get index statistics.
    async fn stats(&self) -> AirisResult<IndexStats>;

    /// Clear index.
    async fn clear(&self) -> AirisResult<()>;
}

#[derive(Debug, Clone)]
pub struct IndexStats {
    pub total_files: usize,
    pub total_chunks: usize,
    pub total_symbols: usize,
    pub indexed_bytes: u64,
    pub languages: Vec<String>,
    pub last_indexed: Option<DateTime<Utc>>,
}

// ─── LSP ───────────────────────────────────────────────────────────────────

/// LSP integration.
#[async_trait]
pub trait LspClient: Send + Sync {
    /// Start LSP server for a language.
    async fn start(&self, language: &str, root: &Path) -> AirisResult<()>;

    /// Stop LSP server.
    async fn stop(&self, language: &str) -> AirisResult<()>;

    /// Get diagnostics for a file.
    async fn diagnostics(&self, file: &Path) -> AirisResult<Vec<LspDiagnostic>>;

    /// Get completions at a position.
    async fn completions(&self, file: &Path, line: usize, column: usize) -> AirisResult<Vec<String>>;

    /// Go to definition.
    async fn goto_definition(&self, file: &Path, line: usize, column: usize) -> AirisResult<Vec<PathBuf>>;

    /// Find references.
    async fn find_references(&self, file: &Path, line: usize, column: usize) -> AirisResult<Vec<Location>>;

    /// Format a file.
    async fn format(&self, file: &Path) -> AirisResult<String>;

    /// Hover information.
    async fn hover(&self, file: &Path, line: usize, column: usize) -> AirisResult<Option<String>>;

    /// Rename symbol.
    async fn rename(&self, file: &Path, line: usize, column: usize, new_name: &str) -> AirisResult<()>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
}

// ─── Plugin ────────────────────────────────────────────────────────────────

/// Plugin loader.
#[async_trait]
pub trait PluginLoader: Send + Sync {
    /// Load a plugin from a manifest.
    async fn load(&self, manifest: PluginManifest) -> AirisResult<Box<dyn Plugin>>;

    /// Load all plugins from configured paths.
    async fn load_all(&self) -> AirisResult<Vec<Box<dyn Plugin>>>;

    /// Unload a plugin.
    async fn unload(&self, name: &str) -> AirisResult<()>;

    /// List loaded plugins.
    fn list(&self) -> Vec<PluginManifest>;
}

/// A loaded plugin.
#[async_trait]
pub trait Plugin: Send + Sync {
    /// Plugin manifest.
    fn manifest(&self) -> &PluginManifest;

    /// Initialize the plugin.
    async fn init(&self, config: &serde_json::Value) -> AirisResult<()>;

    /// Get plugin capabilities.
    fn capabilities(&self) -> Vec<String>;
}

// ─── MCP ───────────────────────────────────────────────────────────────────

/// MCP server management.
#[async_trait]
pub trait McpManager: Send + Sync {
    /// Start an MCP server.
    async fn start_server(&self, config: &McpServerConfig) -> AirisResult<()>;

    /// Stop an MCP server.
    async fn stop_server(&self, name: &str) -> AirisResult<()>;

    /// List available MCP tools.
    async fn list_tools(&self) -> AirisResult<Vec<McpToolDefinition>>;

    /// List available MCP resources.
    async fn list_resources(&self) -> AirisResult<Vec<McpResource>>;

    /// Call an MCP tool.
    async fn call_tool(&self, name: &str, args: serde_json::Value) -> AirisResult<String>;

    /// Read an MCP resource.
    async fn read_resource(&self, uri: &str) -> AirisResult<String>;
}

// ─── Telemetry ─────────────────────────────────────────────────────────────

/// Telemetry and logging.
#[async_trait]
pub trait Telemetry: Send + Sync {
    /// Record an event.
    async fn event(&self, name: &str, properties: HashMap<String, String>);

    /// Record a metric.
    async fn metric(&self, name: &str, value: f64, unit: &str);

    /// Record a trace span.
    async fn trace(&self, name: &str, duration_ms: u64, success: bool);

    /// Flush any buffered telemetry.
    async fn flush(&self);
}

// ─── Config ────────────────────────────────────────────────────────────────

/// Configuration management.
#[async_trait]
pub trait ConfigManager: Send + Sync {
    /// Load configuration.
    async fn load(&self) -> AirisResult<AirisConfig>;

    /// Save configuration.
    async fn save(&self, config: &AirisConfig) -> AirisResult<()>;

    /// Get a specific config value by path.
    fn get(&self, path: &str) -> Option<serde_json::Value>;

    /// Set a specific config value by path.
    async fn set(&self, path: &str, value: serde_json::Value) -> AirisResult<()>;

    /// Get config directory.
    fn config_dir(&self) -> PathBuf;
}

// ─── CLI Command ───────────────────────────────────────────────────────────

/// A CLI command that can be registered and executed.
#[async_trait]
pub trait CliCommand: Send + Sync {
    /// Command name.
    fn name(&self) -> &str;

    /// Command description.
    fn description(&self) -> &str;

    /// Execute the command.
    async fn execute(&self, args: Vec<String>) -> AirisResult<()>;
}

// ─── Context Compressor ────────────────────────────────────────────────────

/// Context compression for long conversations.
#[async_trait]
pub trait ContextCompressor: Send + Sync {
    /// Compress a conversation to fit within token limits.
    async fn compress(
        &self,
        conversation: &Conversation,
        max_tokens: usize,
    ) -> AirisResult<Conversation>;

    /// Summarize a block of text.
    async fn summarize(&self, text: &str, max_tokens: usize) -> AirisResult<String>;
}

// Helper so things can work without Path import issues
use std::path::Path;
use chrono::DateTime;
use crate::types::*;
