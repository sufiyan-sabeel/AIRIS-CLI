//! # AIRIS Telemetry
//!
//! Telemetry and observability system for AIRIS-CLI.
//!
//! Provides event recording, metric collection, trace span tracking,
//! and structured logging via the [`Telemetry`] trait, backed by
//! [`tracing`] for structured JSON output with optional file rotation.

use std::collections::HashMap;
use std::io::{self, IsTerminal};
use std::sync::Once;
use std::sync::OnceLock;

use airis_core::prelude::*;
use chrono::Utc;
use serde::Serialize;
use tracing_subscriber::filter::LevelFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::Layer;

// ─── Internal record types ───────────────────────────────────────────────

/// A recorded event, serialized to JSON for structured output.
#[derive(Debug, Clone, Serialize)]
struct EventRecord {
    #[serde(rename = "type")]
    record_type: &'static str,
    name: String,
    properties: HashMap<String, String>,
    timestamp: String,
    target: &'static str,
}

/// A recorded metric sample.
#[derive(Debug, Clone, Serialize)]
struct MetricRecord {
    #[serde(rename = "type")]
    record_type: &'static str,
    name: String,
    value: f64,
    unit: String,
    timestamp: String,
    target: &'static str,
}

/// A recorded trace span.
#[derive(Debug, Clone, Serialize)]
struct TraceRecord {
    #[serde(rename = "type")]
    record_type: &'static str,
    name: String,
    duration_ms: u64,
    success: bool,
    timestamp: String,
    target: &'static str,
}

// ─── TelemetryImpl ───────────────────────────────────────────────────────

/// Production implementation of the [`Telemetry`] trait.
///
/// Records telemetry as structured [`tracing`] events, which are emitted
/// as JSON lines to stdout and/or a rotating log file depending on
/// configuration.
///
/// # Subscriber setup
///
/// [`Self::new`] installs a global tracing subscriber on first call.
/// Subsequent calls are no-ops (the subscriber is already set) so it is
/// safe to create multiple `TelemetryImpl` instances during testing or
/// reconfiguration — only the first one configures the process-wide logger.
///
/// The non-blocking file writer guard (if file logging is active) is
/// stored in a process-global [`OnceLock`] to ensure the writer thread
/// survives for the entire process lifetime.
pub struct TelemetryImpl {
    config: TelemetryConfig,
}

impl TelemetryImpl {
    /// Create a new telemetry instance and (on first process-wide call)
    /// install the global tracing subscriber.
    ///
    /// `config` controls level, output targets, and file rotation.
    pub fn new(config: TelemetryConfig) -> Self {
        if config.enabled {
            Self::install_subscriber(&config);
        }
        Self { config }
    }

    /// Install the global tracing subscriber exactly once per process.
    ///
    /// The non-blocking writer guard (if file logging is active) is
    /// stored in a process-global [`OnceLock`] so the file writer thread
    /// survives for the entire process lifetime.
    fn install_subscriber(config: &TelemetryConfig) {
        static INIT: Once = Once::new();
        static FILE_GUARD: OnceLock<Option<tracing_appender::non_blocking::WorkerGuard>> =
            OnceLock::new();

        INIT.call_once(|| {
            let level = Self::parse_level(&config.level);

            // ── stdout layer ──────────────────────────────────────────
            let is_tty = io::stdout().is_terminal();
            let stdout_layer: Box<dyn Layer<_> + Send + Sync> = if is_tty {
                // Human-readable compact output on TTY.
                tracing_subscriber::fmt::layer()
                    .with_target(true)
                    .with_level(true)
                    .with_thread_ids(false)
                    .with_file(false)
                    .with_line_number(false)
                    .compact()
                    .with_filter(level.clone())
                    .boxed()
            } else {
                // JSON when piped, daemonised, or in CI.
                tracing_subscriber::fmt::layer()
                    .json()
                    .with_current_span(false)
                    .with_span_list(false)
                    .flatten_event_fields(true)
                    .with_target(true)
                    .with_timer(tracing_subscriber::fmt::time::UtcTime::rfc_3339())
                    .with_filter(level.clone())
                    .boxed()
            };

            // ── file layer (optional, with daily rotation) ────────────
            if config.file_logging {
                if let Some(log_dir) = &config.log_dir {
                    let _ = std::fs::create_dir_all(log_dir);
                    let file_appender =
                        tracing_appender::rolling::daily(log_dir, "airis.log");
                    let (non_blocking, guard) =
                        tracing_appender::non_blocking(file_appender);

                    let file_layer = tracing_subscriber::fmt::layer()
                        .json()
                        .with_current_span(false)
                        .with_span_list(false)
                        .flatten_event_fields(true)
                        .with_target(true)
                        .with_timer(tracing_subscriber::fmt::time::UtcTime::rfc_3339())
                        .with_writer(non_blocking)
                        .with_filter(level)
                        .boxed();

                    let subscriber = tracing_subscriber::Registry::default()
                        .with(stdout_layer)
                        .with(file_layer);
                    let _ = tracing::subscriber::set_global_default(subscriber);

                    let _ = FILE_GUARD.set(Some(guard));
                } else {
                    let subscriber =
                        tracing_subscriber::Registry::default().with(stdout_layer);
                    let _ = tracing::subscriber::set_global_default(subscriber);
                    let _ = FILE_GUARD.set(None);
                }
            } else {
                let subscriber =
                    tracing_subscriber::Registry::default().with(stdout_layer);
                let _ = tracing::subscriber::set_global_default(subscriber);
            }
        });
    }

    /// Parse a config level string into a [`LevelFilter`].
    fn parse_level(level: &str) -> LevelFilter {
        match level.trim().to_lowercase().as_str() {
            "trace" | "5" => LevelFilter::TRACE,
            "debug" | "4" => LevelFilter::DEBUG,
            "info" | "3" => LevelFilter::INFO,
            "warn" | "warning" | "2" => LevelFilter::WARN,
            "error" | "1" => LevelFilter::ERROR,
            "off" | "0" => LevelFilter::OFF,
            _ => LevelFilter::INFO,
        }
    }
}

#[async_trait]
impl Telemetry for TelemetryImpl {
    /// Record an event with associated properties.
    ///
    /// Emitted as a structured `tracing` event at INFO level with JSON
    /// fields for ingestion by log aggregators.
    async fn event(&self, name: &str, properties: HashMap<String, String>) {
        if !self.config.enabled {
            return;
        }

        let timestamp = Utc::now().to_rfc3339();

        // Serialise properties to a JSON string so the tracing JSON
        // formatter includes them as a single nested field.
        let props_json = serde_json::to_string(&properties).unwrap_or_default();

        tracing::info!(
            target = "airis::telemetry",
            record_type = "event",
            name = name,
            properties = props_json,
            timestamp = timestamp,
        );
    }

    /// Record a metric sample.
    ///
    /// `value` is the numeric measurement and `unit` describes its
    /// dimension (e.g. `"ms"`, `"count"`, `"tokens"`).
    async fn metric(&self, name: &str, value: f64, unit: &str) {
        if !self.config.enabled {
            return;
        }

        let timestamp = Utc::now().to_rfc3339();

        tracing::info!(
            target = "airis::telemetry",
            record_type = "metric",
            name = name,
            value = value,
            unit = unit,
            timestamp = timestamp,
        );
    }

    /// Record a trace span — an operation with a duration and success status.
    ///
    /// Useful for tracking LLM calls, tool invocations, and other
    /// discrete operations.
    async fn trace(&self, name: &str, duration_ms: u64, success: bool) {
        if !self.config.enabled {
            return;
        }

        let timestamp = Utc::now().to_rfc3339();

        tracing::info!(
            target = "airis::telemetry",
            record_type = "trace",
            name = name,
            duration_ms = duration_ms,
            success = success,
            timestamp = timestamp,
        );
    }

    /// Flush buffered telemetry.
    ///
    /// Yields to the runtime to allow the non-blocking tracing writer
    /// to drain its channel.
    async fn flush(&self) {
        // tracing_appender does not expose an explicit flush API, so
        // we yield control so the non-blocking worker can catch up.
        tokio::task::yield_now().await;
    }
}

// ─── Default ─────────────────────────────────────────────────────────────

impl Default for TelemetryImpl {
    fn default() -> Self {
        Self::new(TelemetryConfig {
            enabled: true,
            level: "info".to_string(),
            file_logging: false,
            log_dir: None,
        })
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn disabled_config() -> TelemetryConfig {
        TelemetryConfig {
            enabled: false,
            level: "off".to_string(),
            file_logging: false,
            log_dir: None,
        }
    }

    #[tokio::test]
    async fn test_disabled_telemetry_is_noop() {
        let telemetry = TelemetryImpl::new(disabled_config());
        assert!(!telemetry.config.enabled);

        // Should not panic or produce output.
        telemetry.event("test_event", HashMap::new()).await;
        telemetry.metric("test_metric", 42.0, "count").await;
        telemetry.trace("test_trace", 100, true).await;
        telemetry.flush().await;
    }

    #[tokio::test]
    async fn test_methods_do_not_panic() {
        let config = TelemetryConfig {
            enabled: false,
            level: "off".to_string(),
            file_logging: false,
            log_dir: None,
        };
        let telemetry = TelemetryImpl::new(config);

        let mut props = HashMap::new();
        props.insert("key".to_string(), "value".to_string());
        telemetry.event("event_name", props.clone()).await;
        telemetry.metric("latency", 1.5, "ms").await;
        telemetry.trace("llm_call", 1234, true).await;
        telemetry.flush().await;
    }

    #[tokio::test]
    async fn test_enabled_emits_tracing_events() {
        let config = TelemetryConfig {
            enabled: true,
            level: "info".to_string(),
            file_logging: false,
            log_dir: None,
        };
        let telemetry = TelemetryImpl::new(config);

        let mut props = HashMap::new();
        props.insert("model".to_string(), "gpt-4".to_string());
        telemetry.event("model_invocation", props).await;
        telemetry.metric("tokens", 1500.0, "count").await;
        telemetry.trace("tool_exec", 500, false).await;
        telemetry.flush().await;
    }

    #[test]
    fn test_parse_level() {
        assert_eq!(TelemetryImpl::parse_level("trace"), LevelFilter::TRACE);
        assert_eq!(TelemetryImpl::parse_level("DEBUG"), LevelFilter::DEBUG);
        assert_eq!(TelemetryImpl::parse_level("Info"), LevelFilter::INFO);
        assert_eq!(TelemetryImpl::parse_level("warn"), LevelFilter::WARN);
        assert_eq!(TelemetryImpl::parse_level("ERROR"), LevelFilter::ERROR);
        assert_eq!(TelemetryImpl::parse_level("off"), LevelFilter::OFF);
        assert_eq!(TelemetryImpl::parse_level("5"), LevelFilter::TRACE);
        assert_eq!(TelemetryImpl::parse_level("4"), LevelFilter::DEBUG);
        assert_eq!(TelemetryImpl::parse_level("3"), LevelFilter::INFO);
        assert_eq!(TelemetryImpl::parse_level("2"), LevelFilter::WARN);
        assert_eq!(TelemetryImpl::parse_level("1"), LevelFilter::ERROR);
        assert_eq!(TelemetryImpl::parse_level("0"), LevelFilter::OFF);
        // Unknown → INFO
        assert_eq!(TelemetryImpl::parse_level("bogus"), LevelFilter::INFO);
        assert_eq!(TelemetryImpl::parse_level(""), LevelFilter::INFO);
    }

    #[test]
    fn test_default_is_enabled() {
        let telemetry = TelemetryImpl::default();
        assert!(telemetry.config.enabled);
    }

    #[test]
    fn test_serde_record_types() {
        let event = EventRecord {
            record_type: "event",
            name: "test".into(),
            properties: HashMap::new(),
            timestamp: Utc::now().to_rfc3339(),
            target: "test",
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"event\""));
        assert!(json.contains("\"name\":\"test\""));

        let metric = MetricRecord {
            record_type: "metric",
            name: "cpu".into(),
            value: 0.5,
            unit: "percent".into(),
            timestamp: Utc::now().to_rfc3339(),
            target: "test",
        };
        let json = serde_json::to_string(&metric).unwrap();
        assert!(json.contains("\"type\":\"metric\""));
        assert!(json.contains("\"unit\":\"percent\""));

        let trace = TraceRecord {
            record_type: "trace",
            name: "op".into(),
            duration_ms: 42,
            success: true,
            timestamp: Utc::now().to_rfc3339(),
            target: "test",
        };
        let json = serde_json::to_string(&trace).unwrap();
        assert!(json.contains("\"type\":\"trace\""));
        assert!(json.contains("\"duration_ms\":42"));
    }

    #[tokio::test]
    async fn test_flush_completes() {
        let config = TelemetryConfig {
            enabled: true,
            level: "info".to_string(),
            file_logging: false,
            log_dir: None,
        };
        let telemetry = TelemetryImpl::new(config);
        telemetry.event("pre_flush", HashMap::new()).await;
        telemetry.flush().await;
        telemetry.metric("post_flush", 1.0, "count").await;
    }

    #[test]
    fn test_send_sync() {
        fn assert_send<T: Send>() {}
        fn assert_sync<T: Sync>() {}
        assert_send::<TelemetryImpl>();
        assert_sync::<TelemetryImpl>();
    }
}
