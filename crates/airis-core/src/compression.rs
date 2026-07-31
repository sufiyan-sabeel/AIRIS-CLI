//! Context compression for long conversations.
//!
//! Provides [`SimpleCompressor`], a basic implementation of
//! [`ContextCompressor`] that drops the oldest non-system messages
//! to fit within a token budget.

use async_trait::async_trait;

use crate::error::AirisResult;
use crate::traits::ContextCompressor;
use crate::types::Conversation;

/// A simple compressor that truncates conversations by removing the
/// oldest non-system messages first until the token budget is met.
///
/// For `summarize` this is a placeholder — it returns a prefix of the
/// text estimated to fit within the token limit.
#[derive(Debug, Clone, Default)]
pub struct SimpleCompressor;

#[async_trait]
impl ContextCompressor for SimpleCompressor {
    /// Compress a conversation to fit within `max_tokens`.
    ///
    /// System messages are always preserved; other messages are removed
    /// oldest-first until the estimated token count fits the budget.
    async fn compress(
        &self,
        conversation: &Conversation,
        max_tokens: usize,
    ) -> AirisResult<Conversation> {
        let mut compressed = conversation.clone();
        compressed.truncate(max_tokens);
        Ok(compressed)
    }

    /// Summarize (truncate) `text` to approximately `max_tokens`.
    ///
    /// This is a placeholder implementation that estimates tokens as
    /// `text.len() / 4` and returns a prefix of the text when it
    /// exceeds the limit.
    async fn summarize(&self, text: &str, max_tokens: usize) -> AirisResult<String> {
        // Rough estimate: ~4 characters per token
        let estimated = text.len() / 4;
        if estimated <= max_tokens {
            return Ok(text.to_string());
        }

        // Truncate to approximate token limit
        let cutoff = max_tokens.saturating_mul(4).min(text.len());
        // Try to break at a word boundary for cleanliness
        let truncated = if cutoff >= text.len() {
            text.to_string()
        } else {
            let (prefix, _) = text.split_at(cutoff);
            // Find the last space to avoid mid-word cutoff
            if let Some(last_space) = prefix.rfind(' ') {
                let end = last_space.max(1);
                let mut result = String::with_capacity(end + 3);
                result.push_str(&prefix[..end]);
                result.push_str("...");
                result
            } else {
                format!("{}...", prefix)
            }
        };

        Ok(truncated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Message, MessageRole};
    use chrono::Utc;

    #[tokio::test]
    async fn test_compress_keeps_system_messages() {
        let mut conv = Conversation::new();
        conv.messages.push(Message::system("You are a helpful assistant."));
        conv.messages.push(Message::user("Hello"));
        conv.messages.push(Message::assistant("Hi there!"));
        conv.messages.push(Message::user("How are you?"));

        let compressor = SimpleCompressor;
        let compressed = compressor.compress(&conv, 1000).await.unwrap();
        assert_eq!(compressed.messages.len(), 4);
    }

    #[tokio::test]
    async fn test_compress_removes_oldest_non_system() {
        let mut conv = Conversation::new();
        conv.messages.push(Message::system("You are a helpful assistant."));
        conv.messages.push(Message::user("Hello"));
        conv.messages.push(Message::assistant("Hi there!"));
        conv.messages.push(Message::user("How are you?"));

        // Assign estimated tokens
        for msg in &mut conv.messages {
            msg.tokens = Some(msg.text().len() / 4 + 1);
        }

        let compressor = SimpleCompressor;
        let max_tokens = conv.messages[0].tokens.unwrap_or(0)      // system
            + conv.messages[2].tokens.unwrap_or(0)   // assistant
            + conv.messages[3].tokens.unwrap_or(0)   // user (most recent)
            + 1;                                       // small buffer

        let compressed = compressor.compress(&conv, max_tokens).await.unwrap();
        // System + most recent assistant + user
        assert_eq!(compressed.messages.len(), 3);
        assert_eq!(compressed.messages[0].role, MessageRole::System);
        // The oldest non-system (user "Hello") should be gone
        for msg in &compressed.messages {
            assert_ne!(msg.text().trim(), "Hello", "oldest non-system message should be removed");
        }
    }

    #[tokio::test]
    async fn test_summarize_short_text() {
        let compressor = SimpleCompressor;
        let text = "Short text.";
        let result = compressor.summarize(text, 100).await.unwrap();
        assert_eq!(result, text);
    }

    #[tokio::test]
    async fn test_summarize_truncates_long_text() {
        let compressor = SimpleCompressor;
        let text = "a ".repeat(1000);
        let result = compressor.summarize(&text, 10).await.unwrap();
        assert!(result.len() < text.len());
        assert!(result.ends_with("..."));
    }
}
