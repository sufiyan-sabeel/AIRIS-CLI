//! Streaming types for receiving model output token by token.

use crate::types::*;

/// Handler for streaming model responses.
pub trait StreamHandler: Send {
    /// Called for each new token/content chunk.
    fn on_chunk(&mut self, chunk: &str);

    /// Called for each tool call during streaming.
    fn on_tool_call(&mut self, id: &str, name: &str, arguments: &serde_json::Value);

    /// Called when streaming is complete.
    fn on_done(&mut self, finish_reason: &str, usage: Option<TokenUsage>);

    /// Called when an error occurs.
    fn on_error(&mut self, error: &str);

    /// Called with progress updates.
    fn on_progress(&mut self, step: &str, progress: f64);
}

/// Collects streamed content into a final string.
#[derive(Default)]
pub struct StringCollector {
    content: String,
    usage: Option<TokenUsage>,
    error: Option<String>,
    tool_calls: Vec<(String, String, serde_json::Value)>,
}

impl StringCollector {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn content(&self) -> &str {
        &self.content
    }

    pub fn usage(&self) -> Option<&TokenUsage> {
        self.usage.as_ref()
    }

    pub fn error(&self) -> Option<&str> {
        self.error.as_deref()
    }

    pub fn tool_calls(&self) -> &[(String, String, serde_json::Value)] {
        &self.tool_calls
    }
}

impl StreamHandler for StringCollector {
    fn on_chunk(&mut self, chunk: &str) {
        self.content.push_str(chunk);
    }

    fn on_tool_call(&mut self, id: &str, name: &str, arguments: &serde_json::Value) {
        self.tool_calls
            .push((id.to_string(), name.to_string(), arguments.clone()));
    }

    fn on_done(&mut self, _finish_reason: &str, usage: Option<TokenUsage>) {
        self.usage = usage;
    }

    fn on_error(&mut self, error: &str) {
        self.error = Some(error.to_string());
    }

    fn on_progress(&mut self, _step: &str, _progress: f64) {}
}
