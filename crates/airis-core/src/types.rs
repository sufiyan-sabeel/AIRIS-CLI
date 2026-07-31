//! Core data types used throughout the AIRIS-CLI system.

use chrono::{DateTime, Utc};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

// ─── Model & Provider Types ────────────────────────────────────────────────

/// Unique provider identifier.
#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderId(pub String);

impl ProviderId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<&str> for ProviderId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl std::fmt::Display for ProviderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Unique model identifier.
#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelId(pub String);

impl ModelId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<&str> for ModelId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl std::fmt::Display for ModelId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Capabilities a model supports.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCapabilities {
    pub max_tokens: usize,
    pub max_input_tokens: usize,
    pub supports_streaming: bool,
    pub supports_tools: bool,
    pub supports_vision: bool,
    pub supports_embeddings: bool,
    pub supports_function_calling: bool,
    pub supports_json_mode: bool,
    pub context_window: usize,
}

impl Default for ModelCapabilities {
    fn default() -> Self {
        Self {
            max_tokens: 4096,
            max_input_tokens: 128_000,
            supports_streaming: true,
            supports_tools: true,
            supports_vision: false,
            supports_embeddings: false,
            supports_function_calling: true,
            supports_json_mode: true,
            context_window: 128_000,
        }
    }
}

/// Configuration for a specific model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: ModelId,
    pub provider: ProviderId,
    pub display_name: String,
    pub capabilities: ModelCapabilities,
    pub default_params: ModelParams,
    pub pricing: Option<ModelPricing>,
}

/// Model pricing information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    pub input_per_1m_tokens: f64,
    pub output_per_1m_tokens: f64,
    pub currency: String,
}

/// Parameters for model inference.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelParams {
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: Option<u32>,
    pub max_tokens: Option<usize>,
    pub stop_sequences: Vec<String>,
    pub frequency_penalty: Option<f64>,
    pub presence_penalty: Option<f64>,
    pub seed: Option<u64>,
}

impl Default for ModelParams {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 0.95,
            top_k: None,
            max_tokens: None,
            stop_sequences: Vec::new(),
            frequency_penalty: None,
            presence_penalty: None,
            seed: None,
        }
    }
}

// ─── Messages ──────────────────────────────────────────────────────────────

/// Role of a message participant.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
}

impl std::fmt::Display for MessageRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::System => write!(f, "system"),
            Self::User => write!(f, "user"),
            Self::Assistant => write!(f, "assistant"),
            Self::Tool => write!(f, "tool"),
        }
    }
}

/// Content part for multi-modal messages.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentPart {
    Text { text: String },
    ToolCall { id: String, name: String, arguments: serde_json::Value },
    ToolResult { id: String, content: String },
    Image { url: String, detail: Option<String> },
}

/// A single message in a conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: MessageRole,
    pub content: Vec<ContentPart>,
    pub name: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub tokens: Option<usize>,
}

impl Message {
    pub fn new(role: MessageRole, text: impl Into<String>) -> Self {
        Self {
            role,
            content: vec![ContentPart::Text {
                text: text.into(),
            }],
            name: None,
            timestamp: Utc::now(),
            tokens: None,
        }
    }

    pub fn system(text: impl Into<String>) -> Self {
        Self::new(MessageRole::System, text)
    }

    pub fn user(text: impl Into<String>) -> Self {
        Self::new(MessageRole::User, text)
    }

    pub fn assistant(text: impl Into<String>) -> Self {
        Self::new(MessageRole::Assistant, text)
    }

    pub fn text(&self) -> String {
        self.content
            .iter()
            .filter_map(|part| match part {
                ContentPart::Text { text } => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    pub fn has_tool_calls(&self) -> bool {
        self.content.iter().any(|c| matches!(c, ContentPart::ToolCall { .. }))
    }
}

// ─── Conversation / Session ────────────────────────────────────────────────

/// A conversation consisting of a sequence of messages.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: Uuid,
    pub messages: Vec<Message>,
    pub system_prompt: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

impl Conversation {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4(),
            messages: Vec::new(),
            system_prompt: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        }
    }

    pub fn token_count(&self) -> usize {
        self.messages.iter().filter_map(|m| m.tokens).sum()
    }

    pub fn push(&mut self, message: Message) {
        self.updated_at = Utc::now();
        self.messages.push(message);
    }

    pub fn truncate(&mut self, max_tokens: usize) {
        let mut count = 0usize;
        // Always keep system message
        let mut keep = Vec::new();
        let mut system_msgs = Vec::new();
        let mut rest = Vec::new();

        for msg in self.messages.drain(..) {
            if msg.role == MessageRole::System {
                system_msgs.push(msg);
            } else {
                rest.push(msg);
            }
        }

        // Keep all system messages
        for msg in &system_msgs {
            count += msg.tokens.unwrap_or(0);
            keep.push(msg.clone());
        }

        // Keep messages from most recent, respecting token budget
        let mut reversed = Vec::new();
        for msg in rest.into_iter().rev() {
            let tokens = msg.tokens.unwrap_or(0);
            if count + tokens <= max_tokens {
                count += tokens;
                reversed.push(msg);
            } else {
                break;
            }
        }

        reversed.reverse();
        keep.extend(reversed);
        self.messages = keep;
    }
}

impl Default for Conversation {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Tool Definitions ──────────────────────────────────────────────────────

/// A tool/function definition for model function calling.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
    pub required: Vec<String>,
}

/// Result of a tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool_name: String,
    pub call_id: String,
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub duration_ms: u64,
}

// ─── Agent Types ───────────────────────────────────────────────────────────

/// Action an agent can take.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentAction {
    Think { thought: String },
    UseTool { tool: String, arguments: serde_json::Value },
    Respond { content: String },
    Delegate { agent: String, task: String },
    Finish { result: String },
    Error { message: String },
}

/// Agent execution plan step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    pub id: Uuid,
    pub description: String,
    pub action: AgentAction,
    pub depends_on: Vec<Uuid>,
    pub status: StepStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed(String),
    Skipped,
}

/// A full execution plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub id: Uuid,
    pub goal: String,
    pub steps: Vec<PlanStep>,
    pub created_at: DateTime<Utc>,
    pub status: PlanStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlanStatus {
    Draft,
    InProgress,
    Completed,
    Failed(String),
}

// ─── Context / Memory ──────────────────────────────────────────────────────

/// A chunk of context with metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextChunk {
    pub id: Uuid,
    pub content: String,
    pub source: String,
    pub relevance: f64,
    pub tokens: usize,
    pub timestamp: DateTime<Utc>,
    pub embedding: Option<Vec<f32>>,
}

/// Memory entry for long-term storage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: Uuid,
    pub key: String,
    pub content: String,
    pub entry_type: MemoryType,
    pub importance: f64,
    pub timestamp: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub embedding: Option<Vec<f32>>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryType {
    Episodic,
    Semantic,
    Procedural,
    Working,
}

// ─── Indexing ──────────────────────────────────────────────────────────────

/// An indexed file entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFile {
    pub path: PathBuf,
    pub content_hash: String,
    pub last_modified: DateTime<Utc>,
    pub size_bytes: u64,
    pub language: Option<String>,
    pub symbols: Vec<Symbol>,
    pub chunks: Vec<FileChunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SymbolKind {
    Function,
    Class,
    Struct,
    Enum,
    Trait,
    Module,
    Variable,
    Constant,
    Interface,
    Type,
    Method,
    Field,
    Import,
    Macro,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChunk {
    pub start_line: usize,
    pub end_line: usize,
    pub content: String,
    pub tokens: usize,
}

// ─── Search ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub line_content: String,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
    pub relevance: f64,
}

// ─── Diff / Edit ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEdit {
    pub file_path: PathBuf,
    pub old_text: String,
    pub new_text: String,
    pub start_line: usize,
    pub end_line: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndoEntry {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub file_path: PathBuf,
    pub original_content: String,
    pub edit_description: String,
}

// ─── Plugin ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub plugin_type: PluginType,
    pub api_version: String,
    pub entry_point: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PluginType {
    Command,
    Model,
    Tool,
    Theme,
    McpServer,
    Agent,
}

// ─── Session ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub id: Uuid,
    pub conversation: Conversation,
    pub workspace_root: Option<PathBuf>,
    pub active_plan: Option<ExecutionPlan>,
    pub context_files: Vec<PathBuf>,
    pub metadata: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SessionData {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4(),
            conversation: Conversation::new(),
            workspace_root: None,
            active_plan: None,
            context_files: Vec::new(),
            metadata: HashMap::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

impl Default for SessionData {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Streaming ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    Chunk { content: String },
    ToolCall { id: String, name: String, arguments: serde_json::Value },
    ToolResult { id: String, result: String },
    Error { message: String },
    Done { finish_reason: String, usage: Option<TokenUsage> },
    Progress { step: String, progress: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: usize,
    pub completion_tokens: usize,
    pub total_tokens: usize,
    pub cost: Option<f64>,
}

// ─── Config TOML types ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AirisConfig {
    pub core: CoreConfig,
    pub models: ModelsConfig,
    pub providers: HashMap<String, ProviderConfig>,
    pub plugins: PluginsConfig,
    pub ui: UiConfig,
    pub workspace: WorkspaceConfig,
    pub telemetry: TelemetryConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreConfig {
    pub default_provider: Option<String>,
    pub default_model: Option<String>,
    pub max_tokens: usize,
    pub temperature: f64,
    pub theme: String,
    pub session_dir: PathBuf,
    pub cache_dir: PathBuf,
}

impl Default for CoreConfig {
    fn default() -> Self {
        Self {
            default_provider: None,
            default_model: None,
            max_tokens: 4096,
            temperature: 0.7,
            theme: "kageos-dark".into(),
            session_dir: PathBuf::from(".airis/sessions"),
            cache_dir: PathBuf::from(".airis/cache"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsConfig {
    pub enabled: Vec<String>,
    pub routing: ModelRouting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRouting {
    pub chat: Option<String>,
    pub code: Option<String>,
    pub agent: Option<String>,
    pub cheap: Option<String>,
    pub fast: Option<String>,
    pub embedding: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub models: Vec<String>,
    pub timeout_secs: u64,
    pub max_retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginsConfig {
    pub enabled: Vec<String>,
    #[serde(default)]
    pub paths: Vec<PathBuf>,
    pub allowed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    pub enable_animations: bool,
    pub show_token_count: bool,
    pub show_cost: bool,
    pub syntax_theme: String,
    pub font_size: u8,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            enable_animations: true,
            show_token_count: true,
            show_cost: false,
            syntax_theme: "base16-ocean.dark".into(),
            font_size: 12,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub indexing: IndexingConfig,
    pub max_context_files: usize,
    pub auto_index: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingConfig {
    pub max_file_size: u64,
    pub exclude_patterns: Vec<String>,
    pub include_patterns: Vec<String>,
    pub max_files: usize,
    pub enable_vector_search: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryConfig {
    pub enabled: bool,
    pub level: String,
    pub file_logging: bool,
    pub log_dir: Option<PathBuf>,
}

/// Provider capability flags for routing decisions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub streaming: bool,
    pub tools: bool,
    pub vision: bool,
    pub embeddings: bool,
    pub json_mode: bool,
}

/// LSP-related types.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerConfig {
    pub language: String,
    pub command: String,
    pub args: Vec<String>,
    pub root_patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspDiagnostic {
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub severity: LspSeverity,
    pub message: String,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LspSeverity {
    Error,
    Warning,
    Info,
    Hint,
}

// ─── MCP types ─────────────────────────────────────────────────────────────

/// Configuration for an MCP server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    /// Unique name for this server instance.
    pub name: String,
    /// Command to start the server.
    pub command: String,
    /// Arguments passed to the command.
    pub args: Vec<String>,
    /// Environment variables (overrides).
    pub env: Option<HashMap<String, String>>,
    /// Working directory for the server process.
    pub cwd: Option<PathBuf>,
    /// Transport type: "stdio" or "tcp".
    #[serde(default = "default_mcp_transport")]
    pub transport: String,
    /// Host for TCP transport.
    pub host: Option<String>,
    /// Port for TCP transport.
    pub port: Option<u16>,
}

fn default_mcp_transport() -> String {
    "stdio".to_string()
}

impl Default for McpServerConfig {
    fn default() -> Self {
        Self {
            name: String::new(),
            command: String::new(),
            args: Vec::new(),
            env: None,
            cwd: None,
            transport: "stdio".to_string(),
            host: None,
            port: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    pub server_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResource {
    pub uri: String,
    pub name: String,
    pub description: Option<String>,
    pub mime_type: Option<String>,
    pub server_name: String,
}

// ─── Terminal types ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub timed_out: bool,
}

// ─── Code review types ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewComment {
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub severity: ReviewSeverity,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewSeverity {
    Critical,
    Warning,
    Suggestion,
    Nitpick,
}

// ─── Workspace memory ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSummary {
    pub root: PathBuf,
    pub language: String,
    pub frameworks: Vec<String>,
    pub entry_points: Vec<PathBuf>,
    pub key_files: Vec<String>,
    pub dependencies: Vec<String>,
    pub last_analyzed: DateTime<Utc>,
}
