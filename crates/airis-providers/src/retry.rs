//! Provider retry and resilience middleware.
//!
//! Wraps a Provider with exponential backoff retry logic for transient
//! failures (rate limits, network errors, timeouts).

use airis_core::prelude::*;
use async_trait::async_trait;
use std::sync::Arc;
use tracing::{info, warn, error};

const MAX_RETRIES: u32 = 3;
const BASE_DELAY_MS: u64 = 1000;
const MAX_DELAY_MS: u64 = 60000;

/// Provider wrapper that adds retry with exponential backoff.
pub struct RetryProvider {
    inner: Arc<dyn Provider>,
    max_retries: u32,
    base_delay_ms: u64,
}

impl RetryProvider {
    pub fn new(inner: Arc<dyn Provider>) -> Self {
        Self {
            inner,
            max_retries: MAX_RETRIES,
            base_delay_ms: BASE_DELAY_MS,
        }
    }

    pub fn with_config(inner: Arc<dyn Provider>, max_retries: u32, base_delay_ms: u64) -> Self {
        Self {
            inner,
            max_retries,
            base_delay_ms,
        }
    }

    /// Check if an error is retryable.
    fn is_retryable(&self, err: &AirisError) -> bool {
        matches!(
            err,
            AirisError::RateLimited(_)
                | AirisError::Http(_)
                | AirisError::StreamInterrupted
                | AirisError::StreamTimeout
                | AirisError::Io(_)
        )
    }

    /// Compute delay for a given retry attempt.
    fn delay_ms(&self, attempt: u32) -> u64 {
        let delay = self.base_delay_ms * (1u64 << attempt.saturating_sub(1));
        delay.min(MAX_DELAY_MS)
    }
}

#[async_trait]
impl Provider for RetryProvider {
    fn id(&self) -> ProviderId {
        self.inner.id()
    }

    fn name(&self) -> &str {
        self.inner.name()
    }

    fn provider_config(&self) -> &ProviderConfig {
        self.inner.provider_config()
    }

    async fn complete(
        &self,
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
    ) -> AirisResult<Message> {
        let mut last_error = None;

        for attempt in 0..=self.max_retries {
            if attempt > 0 {
                let delay = self.delay_ms(attempt);
                info!(
                    "Retrying provider {} call (attempt {}/{}, delay {}ms)",
                    self.id(),
                    attempt,
                    self.max_retries,
                    delay
                );
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
            }

            match self.inner.complete(model, messages, params, tools).await {
                Ok(response) => {
                    if attempt > 0 {
                        info!("Retry attempt {} succeeded for provider {}", attempt, self.id());
                    }
                    return Ok(response);
                }
                Err(e) => {
                    if self.is_retryable(&e) && attempt < self.max_retries {
                        warn!(
                            "Transient error from provider {} (attempt {}): {}",
                            self.id(),
                            attempt + 1,
                            e
                        );
                        last_error = Some(e);
                        // Continue to retry
                    } else {
                        if attempt == self.max_retries {
                            error!(
                                "All {} retry attempts exhausted for provider {}: {}",
                                self.max_retries,
                                self.id(),
                                e
                            );
                        }
                        return Err(e);
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            AirisError::ModelResponse("All retry attempts exhausted without a response".into())
        }))
    }

    async fn complete_stream(
        &self,
        model: &ModelId,
        messages: &[Message],
        params: &ModelParams,
        tools: &[ToolDefinition],
        handler: Box<dyn StreamHandler>,
    ) -> AirisResult<Message> {
        // For streaming, we don't retry (state is consumed during streaming)
        // But we try once with a longer timeout
        self.inner.complete_stream(model, messages, params, tools, handler).await
    }

    fn capabilities(&self) -> ProviderCapabilities {
        self.inner.capabilities()
    }
}

/// Creates a retry-wrapped provider.
pub fn with_retry(provider: Arc<dyn Provider>) -> Arc<dyn Provider> {
    Arc::new(RetryProvider::new(provider))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_retry_config() {
        let provider = RetryProvider::with_config(
            Arc::new(MockProvider::new("test")),
            5,
            500,
        );
        assert_eq!(provider.max_retries, 5);
        assert_eq!(provider.base_delay_ms, 500);
    }

    #[test]
    fn test_retryable_errors() {
        let provider = RetryProvider::new(Arc::new(MockProvider::new("test")));

        assert!(provider.is_retryable(&AirisError::RateLimited("too fast".into())));
        assert!(provider.is_retryable(&AirisError::StreamInterrupted));
        assert!(provider.is_retryable(&AirisError::StreamTimeout));
        assert!(!provider.is_retryable(&AirisError::InvalidApiKey));
        assert!(!provider.is_retryable(&AirisError::ModelNotFound("gpt-5".into())));
    }

    #[test]
    fn test_backoff_delays() {
        let provider = RetryProvider::new(Arc::new(MockProvider::new("test")));
        assert_eq!(provider.delay_ms(1), 1000);
        assert_eq!(provider.delay_ms(2), 2000);
        assert_eq!(provider.delay_ms(3), 4000);
    }

    struct MockProvider {
        id: ProviderId,
    }

    impl MockProvider {
        fn new(name: &str) -> Self {
            Self { id: ProviderId(name.into()) }
        }
    }

    #[async_trait]
    impl Provider for MockProvider {
        fn id(&self) -> ProviderId { self.id.clone() }
        fn name(&self) -> &str { "mock" }
        fn provider_config(&self) -> &ProviderConfig {
            unimplemented!()
        }
        async fn complete(&self, _: &ModelId, _: &[Message], _: &ModelParams, _: &[ToolDefinition]) -> AirisResult<Message> {
            Ok(Message::assistant("mock response"))
        }
        async fn complete_stream(&self, _: &ModelId, _: &[Message], _: &ModelParams, _: &[ToolDefinition], _: Box<dyn StreamHandler>) -> AirisResult<Message> {
            Ok(Message::assistant("mock stream"))
        }
        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities::default()
        }
    }
}
