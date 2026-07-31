//! Error types for the AIRIS-CLI system.

use thiserror::Error;

/// Top-level error for AIRIS-CLI operations.
#[derive(Error, Debug)]
pub enum AirisError {
    // ── Configuration ──
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Failed to parse config: {0}")]
    ConfigParse(#[from] toml::de::Error),

    // ── I/O ──
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Path not valid UTF-8: {0}")]
    PathEncoding(String),

    // ── Network / Provider ──
    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Provider error ({provider}): {message}")]
    Provider { provider: String, message: String },

    #[error("Provider {0} not available")]
    ProviderNotAvailable(String),

    #[error("Rate limited. Retry after {0}s")]
    RateLimited(u64),

    #[error("Authentication failed: {0}")]
    Auth(String),

    // ── Model / AI ──
    #[error("Model {0} not found")]
    ModelNotFound(String),

    #[error("Context length exceeded (max: {max}, got: {got})")]
    ContextLengthExceeded { max: usize, got: usize },

    #[error("Model response error: {0}")]
    ModelResponse(String),

    #[error("Stream interrupted")]
    StreamInterrupted,

    #[error("Stream timeout")]
    StreamTimeout,

    // ── Agent ──
    #[error("Agent error: {0}")]
    Agent(String),

    #[error("Agent planning failed: {0}")]
    PlanningFailed(String),

    #[error("Tool execution error: {0}")]
    ToolExecution(String),

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Agent step limit exceeded ({0})")]
    StepLimitExceeded(usize),

    // ── Session ──
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session save error: {0}")]
    SessionSave(String),

    #[error("Session load error: {0}")]
    SessionLoad(String),

    // ── Workspace / Index ──
    #[error("Workspace error: {0}")]
    Workspace(String),

    #[error("Index error: {0}")]
    Index(String),

    #[error("Search error: {0}")]
    Search(String),

    // ── Editor ──
    #[error("Edit error: {0}")]
    Edit(String),

    #[error("Patch application failed at line {line}: {message}")]
    PatchFailed { line: usize, message: String },

    #[error("Undo history empty")]
    UndoEmpty,

    // ── Git ──
    #[error("Git error: {0}")]
    Git(String),

    #[error("Not a git repository")]
    NotGitRepo,

    // ── Plugin ──
    #[error("Plugin error: {0}")]
    Plugin(String),

    #[error("Plugin {0} failed to load")]
    PluginLoadFailed(String),

    #[error("Plugin {0} is not compatible")]
    PluginIncompatible(String),

    // ── LSP ──
    #[error("LSP error: {0}")]
    Lsp(String),

    #[error("LSP server not running: {0}")]
    LspNotRunning(String),

    // ── Terminal ──
    #[error("Terminal error: {0}")]
    Terminal(String),

    #[error("Command exited with code {code}")]
    CommandFailed { code: i32, stderr: String },

    #[error("Command timed out after {0}s")]
    CommandTimeout(u64),

    // ── Cache ──
    #[error("Cache error: {0}")]
    Cache(String),

    #[error("Cache miss")]
    CacheMiss,

    // ── Internal ──
    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Not implemented: {0}")]
    NotImplemented(String),

    #[error("Unsupported platform: {0}")]
    UnsupportedPlatform(String),

    #[error("{0}")]
    Custom(String),
}

/// Convenience result alias.
pub type AirisResult<T> = Result<T, AirisError>;

impl From<String> for AirisError {
    fn from(s: String) -> Self {
        Self::Custom(s)
    }
}

impl From<&str> for AirisError {
    fn from(s: &str) -> Self {
        Self::Custom(s.to_string())
    }
}

impl From<toml::de::Error> for AirisError {
    fn from(e: toml::de::Error) -> Self {
        Self::ConfigParse(e)
    }
}

impl From<serde_json::Error> for AirisError {
    fn from(e: serde_json::Error) -> Self {
        Self::Internal(e.to_string())
    }
}
