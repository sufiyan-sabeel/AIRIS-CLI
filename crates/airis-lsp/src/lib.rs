//! LSP (Language Server Protocol) integration for AIRIS-CLI.
//!
//! Provides [`LspClientImpl`], an implementation of the [`LspClient`] trait
//! that communicates with language server processes via stdin/stdout using
//! JSON-RPC 2.0 with Content-Length framing.
//!
//! # Architecture
//!
//! Each configured language spawns its own server process. A background task
//! reads the server's stdout and dispatches responses to awaiting callers
//! (matched by JSON-RPC request ID) while storing push-based diagnostics for
//! later retrieval.
//!
//! # Configuration
//!
//! ```rust,no_run
//! use airis_core::prelude::*;
//! use airis_lsp::LspClientImpl;
//! use std::collections::HashMap;
//!
//! let mut configs = HashMap::new();
//! configs.insert("rust".into(), LspServerConfig {
//!     language: "rust".into(),
//!     command: "rust-analyzer".into(),
//!     args: vec![],
//!     root_patterns: vec!["Cargo.toml".into()],
//! });
//! let client = LspClientImpl::new(configs);
//! ```

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use airis_core::prelude::*;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{Mutex, RwLock, oneshot};
use tracing::{debug, error, info, warn};

use lsp_types::Url;

// ─── Internal JSON-RPC 2.0 helpers ─────────────────────────────────────────

/// Read one JSON-RPC message from an async buffered reader.
///
/// LSP uses HTTP-style headers followed by a JSON body:
/// ```text
/// Content-Length: <N>\r\n
/// \r\n
/// <N bytes of JSON>
/// ```
async fn read_message<R>(reader: &mut R) -> AirisResult<Value>
where
    R: AsyncBufReadExt + Unpin,
{
    let mut content_length: Option<usize> = None;
    let mut line = String::new();

    loop {
        line.clear();
        let n = reader.read_line(&mut line).await.map_err(AirisError::Io)?;
        if n == 0 {
            return Err(AirisError::Lsp(
                "LSP server closed the connection".into(),
            ));
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            break; // end of headers
        }
        if let Some(len_str) = trimmed.strip_prefix("Content-Length: ") {
            let len: usize = len_str
                .trim()
                .parse()
                .map_err(|e| AirisError::Lsp(format!("Invalid Content-Length: {e}")))?;
            content_length = Some(len);
        }
        // Content-Type (ignored) and any other headers are skipped.
    }

    let len = content_length
        .ok_or_else(|| AirisError::Lsp("Missing Content-Length header".into()))?;

    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).await.map_err(AirisError::Io)?;

    serde_json::from_slice(&buf).map_err(AirisError::from)
}

/// Write a JSON-RPC message with Content-Length framing to an async writer.
async fn write_message<W>(writer: &mut W, msg: &Value) -> AirisResult<()>
where
    W: AsyncWriteExt + Unpin,
{
    let body = serde_json::to_string(msg)?;
    let header = format!("Content-Length: {}\r\n\r\n", body.len());
    writer
        .write_all(header.as_bytes())
        .await
        .map_err(AirisError::Io)?;
    writer
        .write_all(body.as_bytes())
        .await
        .map_err(AirisError::Io)?;
    writer.flush().await.map_err(AirisError::Io)?;
    Ok(())
}

// ─── URI conversion helpers ─────────────────────────────────────────────────

/// Convert a file system path to a `file://` URI.
fn path_to_uri(path: &Path) -> AirisResult<Url> {
    Url::from_file_path(path)
        .map_err(|_| AirisError::PathEncoding(path.display().to_string()))
}

/// Convert a `file://` URI back to a filesystem path.
fn uri_to_path(uri: &Url) -> PathBuf {
    uri.to_file_path().unwrap_or_else(|_| PathBuf::from(uri.as_str()))
}

// ─── Shared mutable state ──────────────────────────────────────────────────

/// State shared between `LspClientImpl` and all background reader tasks.
struct SharedState {
    /// JSON-RPC requests awaiting responses, keyed by request ID.
    pending: Mutex<HashMap<u64, oneshot::Sender<AirisResult<Value>>>>,
    /// Latest diagnostics per file, populated by `textDocument/publishDiagnostics`.
    diagnostics: RwLock<HashMap<PathBuf, Vec<LspDiagnostic>>>,
}

// ─── Running LSP server ────────────────────────────────────────────────────

/// A single running LSP server instance.
struct RunningServer {
    /// Child process handle (kept alive while the server runs).
    #[allow(dead_code)]
    child: Option<Child>,
    /// Writer to the server's stdin.
    stdin: ChildStdin,
    /// Background task that reads the server's stdout.
    _reader_handle: tokio::task::JoinHandle<()>,
    /// Capabilities reported during initialization.
    #[allow(dead_code)]
    capabilities: lsp_types::ServerCapabilities,
    /// Root URI for this workspace.
    #[allow(dead_code)]
    root_uri: Url,
    /// Set of file paths currently opened via `textDocument/didOpen`.
    open_files: HashSet<PathBuf>,
}

// ─── LspClientImpl ─────────────────────────────────────────────────────────

/// Implementation of [`LspClient`] that spawns and communicates with LSP
/// language servers over stdin/stdout using JSON-RPC 2.0.
///
/// Servers are configured per-language via [`LspServerConfig`] and launched
/// on demand by [`start()`](LspClient::start). All LSP requests are
/// asynchronous and thread-safe.
pub struct LspClientImpl {
    /// Language → server configuration.
    configs: HashMap<String, LspServerConfig>,
    /// Currently running servers (language → instance).
    servers: RwLock<HashMap<String, RunningServer>>,
    /// State shared with background I/O tasks.
    state: Arc<SharedState>,
    /// Monotonic counter for JSON-RPC request IDs.
    next_id: AtomicU64,
}

impl LspClientImpl {
    /// Create a new LSP client with the given language-server configurations.
    ///
    /// The map should contain one entry per supported language, e.g.:
    /// ```ignore
    /// configs.insert("rust".into(), LspServerConfig {
    ///     language: "rust".into(),
    ///     command: "rust-analyzer".into(),
    ///     args: vec![],
    ///     root_patterns: vec!["Cargo.toml".into()],
    /// });
    /// ```
    pub fn new(configs: HashMap<String, LspServerConfig>) -> Self {
        Self {
            configs,
            servers: RwLock::new(HashMap::new()),
            state: Arc::new(SharedState {
                pending: Mutex::new(HashMap::new()),
                diagnostics: RwLock::new(HashMap::new()),
            }),
            next_id: AtomicU64::new(1),
        }
    }

    // ── Internal helpers ────────────────────────────────────────────────

    /// Look up the server configuration for a language.
    fn config_for(&self, language: &str) -> AirisResult<&LspServerConfig> {
        self.configs
            .get(language)
            .ok_or_else(|| AirisError::Lsp(format!("No LSP server configured for '{language}'")))
    }



    /// Send a JSON-RPC request and await the response.
    async fn request(
        &self,
        server: &mut RunningServer,
        method: &str,
        params: Value,
    ) -> AirisResult<Value> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel::<AirisResult<Value>>();

        // Register before sending to avoid races.
        self.state.pending.lock().await.insert(id, tx);

        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });
        write_message(&mut server.stdin, &msg).await?;

        const TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);
        match tokio::time::timeout(TIMEOUT, rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_recv_err)) => Err(AirisError::Lsp(
                "LSP server communication broken — background task exited".into(),
            )),
            Err(_elapsed) => {
                self.state.pending.lock().await.remove(&id);
                Err(AirisError::Lsp(format!(
                    "LSP request '{method}' timed out after {}s",
                    TIMEOUT.as_secs()
                )))
            }
        }
    }

    /// Send a JSON-RPC notification (fire-and-forget, no response).
    async fn notify(
        &self,
        server: &mut RunningServer,
        method: &str,
        params: Value,
    ) -> AirisResult<()> {
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        write_message(&mut server.stdin, &msg).await
    }

    /// Ensure a document is open in the server, opening it if not yet tracked.
    async fn ensure_open(&self, server: &mut RunningServer, path: &Path) -> AirisResult<()> {
        if server.open_files.contains(path) {
            return Ok(());
        }
        self.open_document(server, path).await?;
        server.open_files.insert(path.to_path_buf());
        Ok(())
    }

    /// Send `textDocument/didOpen` for a file.
    async fn open_document(&self, server: &mut RunningServer, path: &Path) -> AirisResult<()> {
        let uri = path_to_uri(path)?;
        let content = tokio::fs::read_to_string(path).await.map_err(AirisError::Io)?;

        let params = lsp_types::DidOpenTextDocumentParams {
            text_document: lsp_types::TextDocumentItem {
                uri,
                language_id: String::new(),
                version: 1,
                text: content,
            },
        };
        self.notify(server, "textDocument/didOpen", serde_json::to_value(params)?)
            .await
    }

    /// Send `textDocument/didClose` for a file.
    #[allow(dead_code)]
    async fn close_document(&self, server: &mut RunningServer, path: &Path) -> AirisResult<()> {
        let uri = path_to_uri(path)?;
        let params = lsp_types::DidCloseTextDocumentParams {
            text_document: lsp_types::TextDocumentIdentifier { uri },
        };
        self.notify(server, "textDocument/didClose", serde_json::to_value(params)?)
            .await
    }

    // ── Background stdout reader ────────────────────────────────────────

    /// Spawn the background task that reads JSON-RPC messages from the server's
    /// stdout and dispatches them (responses → pending map, diagnostics → store).
    fn spawn_reader(
        stdout: tokio::process::ChildStdout,
        state: Arc<SharedState>,
        diagnostics_tx: tokio::sync::mpsc::UnboundedSender<()>,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            loop {
                let msg = match read_message(&mut reader).await {
                    Ok(msg) => msg,
                    Err(e) => {
                        error!("LSP stdout reader error: {e}");
                        break;
                    }
                };

                let has_id = msg.get("id").is_some();
                let has_method = msg.get("method").is_some();

                match (has_id, has_method) {
                    // ── Response ────────────────────────────────────────
                    (true, false) => {
                        let id = msg["id"].as_u64().unwrap_or(0);
                        let result = if let Some(err_val) = msg.get("error") {
                            let code = err_val["code"].as_i64().unwrap_or(-1);
                            let message = err_val["message"]
                                .as_str()
                                .unwrap_or("unknown error")
                                .to_string();
                            Err(AirisError::Lsp(format!(
                                "JSON-RPC error {code}: {message}"
                            )))
                        } else {
                            Ok(msg.get("result").cloned().unwrap_or(Value::Null))
                        };

                        let sender = state.pending.lock().await.remove(&id);
                        if let Some(sender) = sender {
                            let _ = sender.send(result);
                        }
                    }
                    // ── Notification ────────────────────────────────────
                    (false, true) => {
                        let method = msg["method"].as_str().unwrap_or("").to_string();
                        if method == "textDocument/publishDiagnostics" {
                            if let Some(params) = msg.get("params") {
                                if let Ok(diag) = serde_json::from_value::<
                                    lsp_types::PublishDiagnosticsParams,
                                >(params.clone())
                                {
                                    let path = uri_to_path(&diag.uri);
                                    let mut store = state.diagnostics.write().await;
                                    store.insert(
                                        path,
                                        diag.diagnostics
                                            .into_iter()
                                            .map(|d| lsp_diagnostic_to_core(&diag.uri, &d))
                                            .collect(),
                                    );
                                }
                            }
                        }
                        // Other notifications are silently ignored.
                    }
                    // ── Server request (rare for client) ────────────────
                    (true, true) => {
                        debug!(
                            "Ignoring unexpected server request: {}",
                            msg["method"].as_str().unwrap_or("?")
                        );
                    }
                    // ── Invalid ─────────────────────────────────────────
                    (false, false) => {
                        warn!("Received JSON-RPC message with no id or method");
                    }
                }
            }

            let _ = diagnostics_tx.send(());
            info!("LSP stdout reader task exited");
        })
    }
}

// ─── LspClient trait implementation ──────────────────────────────────────

#[async_trait]
impl LspClient for LspClientImpl {
    async fn start(&self, language: &str, root: &Path) -> AirisResult<()> {
        let config = self.config_for(language)?.clone();

        // If already running, kill the existing server.
        {
            let mut servers = self.servers.write().await;
            if let Some(mut existing) = servers.remove(language) {
                drop(servers);
                // Abort reader and let kill_on_drop clean up the process.
                existing._reader_handle.abort();
                drop(existing);
            }
        }

        // ── Spawn process ──────────────────────────────────────────────
        info!("Starting LSP server for {language}: {} {:?}", config.command, config.args);
        let mut child = Command::new(&config.command)
            .args(&config.args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                AirisError::Lsp(format!(
                    "Failed to spawn LSP server '{}': {e}",
                    config.command
                ))
            })?;

        let mut stdin = child.stdin.take().ok_or_else(|| {
            AirisError::Lsp("Failed to capture LSP server stdin".into())
        })?;
        let stdout = child.stdout.take().ok_or_else(|| {
            AirisError::Lsp("Failed to capture LSP server stdout".into())
        })?;

        let root_uri = path_to_uri(root)?;
        let state = self.state.clone();

        // ── Spawn background reader ────────────────────────────────────
        let (_diagnostics_tx, _diagnostics_rx) =
            tokio::sync::mpsc::unbounded_channel::<()>();
        let reader_handle = Self::spawn_reader(stdout, state.clone(), _diagnostics_tx);

        // ── Initialize handshake ───────────────────────────────────────
        let init_params = lsp_types::InitializeParams {
            process_id: Some(std::process::id()),
            client_info: Some(lsp_types::ClientInfo {
                name: "airis-cli".into(),
                version: Some("0.1.0".into()),
            }),
            root_uri: Some(root_uri.clone()),
            capabilities: lsp_types::ClientCapabilities {
                text_document: Some(lsp_types::TextDocumentClientCapabilities {
                    completion: Some(lsp_types::CompletionClientCapabilities {
                        completion_item: Some(lsp_types::CompletionItemCapabilities {
                            snippet_support: Some(false),
                            ..Default::default()
                        }),
                        ..Default::default()
                    }),
                    hover: Some(lsp_types::HoverClientCapabilities {
                        content_format: Some(vec![
                            lsp_types::MarkupKind::Markdown,
                            lsp_types::MarkupKind::PlainText,
                        ]),
                        ..Default::default()
                    }),
                    formatting: Some(lsp_types::FormattingClientCapabilities {
                        dynamic_registration: Some(false),
                    }),
                    rename: Some(lsp_types::RenameClientCapabilities {
                        dynamic_registration: Some(false),
                        prepare_support: Some(false),
                        ..Default::default()
                    }),
                    definition: Some(lsp_types::GotoDefinitionClientCapabilities {
                        dynamic_registration: Some(false),
                        ..Default::default()
                    }),
                    references: Some(lsp_types::ReferenceClientCapabilities {
                        dynamic_registration: Some(false),
                    }),
                    ..Default::default()
                }),
                workspace: Some(lsp_types::WorkspaceClientCapabilities {
                    ..Default::default()
                }),
                ..Default::default()
            },
            initialization_options: None,
            ..Default::default()
        };

        let init_result = {
            let init_id = self.next_id.fetch_add(1, Ordering::SeqCst);
            let (tx, rx) = oneshot::channel::<AirisResult<Value>>();
            self.state.pending.lock().await.insert(init_id, tx);

            let init_msg = serde_json::json!({
                "jsonrpc": "2.0",
                "id": init_id,
                "method": "initialize",
                "params": serde_json::to_value(&init_params)?,
            });
            write_message(&mut stdin, &init_msg).await?;

            const INIT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);
            match tokio::time::timeout(INIT_TIMEOUT, rx).await {
                Ok(Ok(result)) => result,
                Ok(Err(_)) => Err(AirisError::Lsp(
                    "LSP server initialization failed — reader task died".into(),
                ))?,
                Err(_) => {
                    self.state.pending.lock().await.remove(&init_id);
                    Err(AirisError::Lsp("LSP initialization timed out".into()))?;
                }
            }
        };

        // Parse capabilities from init result.
        let capabilities: lsp_types::ServerCapabilities =
            serde_json::from_value(init_result).map_err(|e| {
                AirisError::Lsp(format!("Invalid InitializeResult: {e}"))
            })?;

        // ── Send initialized notification ──────────────────────────────
        let initialized_msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {},
        });
        write_message(&mut stdin, &initialized_msg).await?;

        // ── Store running server ───────────────────────────────────────
        let server = RunningServer {
            child: Some(child),
            stdin,
            _reader_handle: reader_handle,
            capabilities,
            root_uri,
            open_files: HashSet::new(),
        };

        self.servers.write().await.insert(language.to_string(), server);
        info!("LSP server for {language} started successfully");
        Ok(())
    }

    async fn stop(&self, language: &str) -> AirisResult<()> {
        // Remove from map (drops RunningServer if this is the last reference).
        let server = self.servers.write().await.remove(language);
        let mut server = match server {
            Some(s) => s,
            None => return Err(AirisError::LspNotRunning(language.to_string())),
        };

        info!("Stopping LSP server for {language}");

        // ── Send shutdown request ──────────────────────────────────────
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel::<AirisResult<Value>>();
        self.state.pending.lock().await.insert(id, tx);

        let shutdown_msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "shutdown",
            "params": {},
        });
        // Ignore write errors — server might already be dead.
        let _ = write_message(&mut server.stdin, &shutdown_msg).await;

        // Wait briefly for shutdown response, but don't block long.
        let _ = tokio::time::timeout(std::time::Duration::from_secs(5), rx).await;

        // ── Send exit notification ─────────────────────────────────────
        let exit_msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "exit",
            "params": {},
        });
        let _ = write_message(&mut server.stdin, &exit_msg).await;

        // Abort the reader task.
        server._reader_handle.abort();

        // Drop the server struct, which kills the child via `kill_on_drop`.
        drop(server);
        info!("LSP server for {language} stopped");
        Ok(())
    }

    async fn diagnostics(&self, file: &Path) -> AirisResult<Vec<LspDiagnostic>> {
        let store = self.state.diagnostics.read().await;
        Ok(store.get(file).cloned().unwrap_or_default())
    }

    async fn completions(
        &self,
        file: &Path,
        line: usize,
        column: usize,
    ) -> AirisResult<Vec<String>> {
        let mut servers = self.servers.write().await;
        // Find the server for any language that can handle this file.
        // We iterate to find the right one — in practice there's usually one.
        let (_lang, server) = match servers.iter_mut().find(|(_, s)| {
            s.open_files.contains(file)
                || file.starts_with(s.root_uri.to_file_path().unwrap_or_default())
        }) {
            Some(pair) => pair,
            None => {
                return Err(AirisError::Lsp(format!(
                    "No running LSP server for {}",
                    file.display()
                )))
            }
        };

        self.ensure_open(server, file).await?;

        let uri = path_to_uri(file)?;
        let params = lsp_types::CompletionParams {
            text_document_position: lsp_types::TextDocumentPositionParams {
                text_document: lsp_types::TextDocumentIdentifier { uri },
                position: lsp_types::Position {
                    line: line as u32,
                    character: column as u32,
                },
            },
            work_done_progress_params: lsp_types::WorkDoneProgressParams::default(),
            partial_result_params: lsp_types::PartialResultParams::default(),
            context: None,
        };

        let result = self
            .request(server, "textDocument/completion", serde_json::to_value(params)?)
            .await?;

        // The response can be `CompletionList`, `Vec<CompletionItem>`, or `null`.
        // Extract labels.
        let mut labels = Vec::new();

        // Try CompletionList first.
        if let Some(is_incomplete) = result.get("isIncomplete") {
            if let Some(items) = result.get("items").and_then(|v| v.as_array()) {
                for item in items {
                    if let Some(label) = item.get("label").and_then(|v| v.as_str()) {
                        labels.push(label.to_string());
                    }
                }
            }
        } else if let Some(items) = result.as_array() {
            for item in items {
                if let Some(label) = item.get("label").and_then(|v| v.as_str()) {
                    labels.push(label.to_string());
                }
            }
        }

        Ok(labels)
    }

    async fn goto_definition(
        &self,
        file: &Path,
        line: usize,
        column: usize,
    ) -> AirisResult<Vec<PathBuf>> {
        let mut servers = self.servers.write().await;
        let (_lang, server) = match servers.iter_mut().find(|(_, s)| {
            s.open_files.contains(file)
                || file.starts_with(s.root_uri.to_file_path().unwrap_or_default())
        }) {
            Some(pair) => pair,
            None => return Err(AirisError::Lsp(format!("No running LSP server for {}", file.display()))),
        };

        self.ensure_open(server, file).await?;

        let uri = path_to_uri(file)?;
        let params = lsp_types::GotoDefinitionParams {
            text_document_position_params: lsp_types::TextDocumentPositionParams {
                text_document: lsp_types::TextDocumentIdentifier { uri },
                position: lsp_types::Position {
                    line: line as u32,
                    character: column as u32,
                },
            },
            work_done_progress_params: lsp_types::WorkDoneProgressParams::default(),
            partial_result_params: lsp_types::PartialResultParams::default(),
        };

        let result = self
            .request(
                server,
                "textDocument/definition",
                serde_json::to_value(params)?,
            )
            .await?;

        // Response can be `Location`, `Vec<Location>`, `Vec<LocationLink>`, or null.
        let mut paths = Vec::new();

        // Single Location?
        if let Some(uri_val) = result.get("uri") {
            if let Some(uri_str) = uri_val.as_str() {
                if let Ok(url) = Url::parse(uri_str) {
                    paths.push(uri_to_path(&url));
                }
            }
        }
        // Array of Locations or LocationLinks.
        if let Some(arr) = result.as_array() {
            for item in arr {
                if let Some(uri_str) = item.get("uri").and_then(|v| v.as_str()) {
                    if let Ok(url) = Url::parse(uri_str) {
                        paths.push(uri_to_path(&url));
                    }
                } else if let Some(target_uri) = item.get("targetUri").and_then(|v| v.as_str()) {
                    if let Ok(url) = Url::parse(target_uri) {
                        paths.push(uri_to_path(&url));
                    }
                }
            }
        }

        Ok(paths)
    }

    async fn find_references(
        &self,
        file: &Path,
        line: usize,
        column: usize,
    ) -> AirisResult<Vec<Location>> {
        let mut servers = self.servers.write().await;
        let (_lang, server) = match servers.iter_mut().find(|(_, s)| {
            s.open_files.contains(file)
                || file.starts_with(s.root_uri.to_file_path().unwrap_or_default())
        }) {
            Some(pair) => pair,
            None => return Err(AirisError::Lsp(format!("No running LSP server for {}", file.display()))),
        };

        self.ensure_open(server, file).await?;

        let uri = path_to_uri(file)?;
        let params = lsp_types::ReferenceParams {
            text_document_position: lsp_types::TextDocumentPositionParams {
                text_document: lsp_types::TextDocumentIdentifier { uri },
                position: lsp_types::Position {
                    line: line as u32,
                    character: column as u32,
                },
            },
            work_done_progress_params: lsp_types::WorkDoneProgressParams::default(),
            partial_result_params: lsp_types::PartialResultParams::default(),
            context: lsp_types::ReferenceContext { include_declaration: true },
        };

        let result = self
            .request(
                server,
                "textDocument/references",
                serde_json::to_value(params)?,
            )
            .await?;

        let mut locations = Vec::new();
        if let Some(arr) = result.as_array() {
            for item in arr {
                if let (Some(uri_str), Some(range)) = (
                    item.get("uri").and_then(|v| v.as_str()),
                    item.get("range"),
                ) {
                    if let Ok(url) = Url::parse(uri_str) {
                        let path = uri_to_path(&url);
                        let line = range
                            .get("start")
                            .and_then(|s| s.get("line"))
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0) as usize;
                        let col = range
                            .get("start")
                            .and_then(|s| s.get("character"))
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0) as usize;
                        locations.push(Location { file: path, line, column: col });
                    }
                }
            }
        }

        Ok(locations)
    }

    async fn format(&self, file: &Path) -> AirisResult<String> {
        let mut servers = self.servers.write().await;
        let (_lang, server) = match servers.iter_mut().find(|(_, s)| {
            s.open_files.contains(file)
                || file.starts_with(s.root_uri.to_file_path().unwrap_or_default())
        }) {
            Some(pair) => pair,
            None => return Err(AirisError::Lsp(format!("No running LSP server for {}", file.display()))),
        };

        self.ensure_open(server, file).await?;

        let uri = path_to_uri(file)?;
        let params = lsp_types::DocumentFormattingParams {
            text_document: lsp_types::TextDocumentIdentifier { uri },
            options: lsp_types::FormattingOptions {
                tab_size: 4,
                insert_spaces: true,
                properties: HashMap::new(),
                ..Default::default()
            },
            work_done_progress_params: lsp_types::WorkDoneProgressParams::default(),
        };

        let result = self
            .request(
                server,
                "textDocument/formatting",
                serde_json::to_value(params)?,
            )
            .await?;

        // Response is `Vec<TextEdit>` or null.
        let edits: Vec<lsp_types::TextEdit> =
            serde_json::from_value(result).unwrap_or_default();

        if edits.is_empty() {
            // No edits — return original content.
            return tokio::fs::read_to_string(file).await.map_err(AirisError::Io);
        }

        // Apply edits in reverse order (bottom to top) to preserve positions.
        let mut content = tokio::fs::read_to_string(file).await.map_err(AirisError::Io)?;
        // We need a mutable representation. Use lines that we can edit.
        // To properly apply TextEdits, convert to a vector of characters/lines
        // and apply edits from last to first.

        // Represent the document as lines for editing.
        let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
        // Handle trailing newline.
        let has_trailing_newline = content.ends_with('\n');

        // Collect (line, character, new_text) sorted in descending order.
        struct EditOp {
            line: usize,
            character: usize,
            end_line: usize,
            end_character: usize,
            new_text: String,
        }

        let mut edit_ops: Vec<EditOp> = edits
            .into_iter()
            .map(|e| EditOp {
                line: e.range.start.line as usize,
                character: e.range.start.character as usize,
                end_line: e.range.end.line as usize,
                end_character: e.range.end.character as usize,
                new_text: e.new_text,
            })
            .collect();

        // Sort descending by start position (line, then character).
        edit_ops.sort_by(|a, b| {
            b.line
                .cmp(&a.line)
                .then_with(|| b.character.cmp(&a.character))
        });

        for op in edit_ops {
            // Ensure lines vector is large enough.
            while lines.len() <= op.end_line {
                lines.push(String::new());
            }

            if op.line == op.end_line {
                // Replace within a single line.
                let line = &mut lines[op.line];
                let mut chars: Vec<char> = line.chars().collect();
                // Clamp positions to valid range.
                let start = op.character.min(chars.len());
                let end = op.end_character.min(chars.len()).max(start);
                chars.splice(start..end, op.new_text.chars());
                *line = chars.into_iter().collect();
            } else {
                // Multi-line replacement.
                let mut new_content = String::new();

                // First line: keep up to `character`, then append new_text start.
                if op.line < lines.len() {
                    let line = &lines[op.line];
                    let prefix: String = line.chars().take(op.character).collect();
                    new_content.push_str(&prefix);
                }
                new_content.push_str(&op.new_text);

                // Last line: keep from `end_character` onward.
                if op.end_line < lines.len() {
                    let last_line = &lines[op.end_line];
                    let suffix: String = last_line.chars().skip(op.end_character).collect();
                    new_content.push_str(&suffix);
                }

                // Replace the range of lines with the single new line.
                let end = (op.end_line + 1).min(lines.len());
                lines.splice(op.line..end, [new_content]);
            }
        }

        let mut result = lines.join("\n");
        if has_trailing_newline {
            result.push('\n');
        }

        Ok(result)
    }

    async fn hover(
        &self,
        file: &Path,
        line: usize,
        column: usize,
    ) -> AirisResult<Option<String>> {
        let mut servers = self.servers.write().await;
        let (_lang, server) = match servers.iter_mut().find(|(_, s)| {
            s.open_files.contains(file)
                || file.starts_with(s.root_uri.to_file_path().unwrap_or_default())
        }) {
            Some(pair) => pair,
            None => {
                return Err(AirisError::Lsp(format!(
                    "No running LSP server for {}",
                    file.display()
                )))
            }
        };

        self.ensure_open(server, file).await?;

        let uri = path_to_uri(file)?;
        let params = lsp_types::HoverParams {
            text_document_position_params: lsp_types::TextDocumentPositionParams {
                text_document: lsp_types::TextDocumentIdentifier { uri },
                position: lsp_types::Position {
                    line: line as u32,
                    character: column as u32,
                },
            },
            work_done_progress_params: lsp_types::WorkDoneProgressParams::default(),
        };

        let result = self
            .request(server, "textDocument/hover", serde_json::to_value(params)?)
            .await?;

        if result.is_null() {
            return Ok(None);
        }

        // Parse the Hover object to extract readable text.
        let hover: lsp_types::Hover = serde_json::from_value(result).map_err(|e| {
            AirisError::Lsp(format!("Failed to parse Hover response: {e}"))
        })?;

        let text = hover_contents_to_string(&hover.contents);
        Ok(Some(text))
    }

    async fn rename(
        &self,
        file: &Path,
        line: usize,
        column: usize,
        new_name: &str,
    ) -> AirisResult<()> {
        let mut servers = self.servers.write().await;
        let (_lang, server) = match servers.iter_mut().find(|(_, s)| {
            s.open_files.contains(file)
                || file.starts_with(s.root_uri.to_file_path().unwrap_or_default())
        }) {
            Some(pair) => pair,
            None => {
                return Err(AirisError::Lsp(format!(
                    "No running LSP server for {}",
                    file.display()
                )))
            }
        };

        self.ensure_open(server, file).await?;

        let uri = path_to_uri(file)?;
        let params = lsp_types::RenameParams {
            text_document_position: lsp_types::TextDocumentPositionParams {
                text_document: lsp_types::TextDocumentIdentifier { uri },
                position: lsp_types::Position {
                    line: line as u32,
                    character: column as u32,
                },
            },
            new_name: new_name.to_string(),
            work_done_progress_params: lsp_types::WorkDoneProgressParams::default(),
        };

        let result = self
            .request(server, "textDocument/rename", serde_json::to_value(params)?)
            .await?;

        if result.is_null() {
            return Err(AirisError::Lsp("Rename returned no changes".into()));
        }

        // Parse WorkspaceEdit and apply all edits.
        let edit: lsp_types::WorkspaceEdit = serde_json::from_value(result).map_err(|e| {
            AirisError::Lsp(format!("Failed to parse WorkspaceEdit: {e}"))
        })?;

        apply_workspace_edit(&edit).await
    }
}

// ─── LSP type conversion helpers ──────────────────────────────────────────

/// Convert an `lsp_types::HoverContents` to a plain string for display.
fn hover_contents_to_string(contents: &lsp_types::HoverContents) -> String {
    match contents {
        lsp_types::HoverContents::Scalar(marked) => match marked {
            lsp_types::MarkedString::String(s) => s.clone(),
            lsp_types::MarkedString::LanguageString(ls) => {
                format!("```{}\n{}\n```", ls.language, ls.value)
            }
        },
        lsp_types::HoverContents::Array(arr) => arr
            .iter()
            .map(|m| match m {
                lsp_types::MarkedString::String(s) => s.clone(),
                lsp_types::MarkedString::LanguageString(ls) => {
                    format!("```{}\n{}\n```", ls.language, ls.value)
                }
            })
            .collect::<Vec<_>>()
            .join("\n\n"),
        lsp_types::HoverContents::Markup(markup) => markup.value.clone(),
    }
}

/// Convert an `lsp_types::Diagnostic` to our core `LspDiagnostic`.
fn lsp_diagnostic_to_core(uri: &Url, d: &lsp_types::Diagnostic) -> LspDiagnostic {
    LspDiagnostic {
        file: uri_to_path(uri),
        line: d.range.start.line as usize,
        column: d.range.start.character as usize,
        severity: match d.severity {
            Some(lsp_types::DiagnosticSeverity::ERROR) => LspSeverity::Error,
            Some(lsp_types::DiagnosticSeverity::WARNING) => LspSeverity::Warning,
            Some(lsp_types::DiagnosticSeverity::INFORMATION) => LspSeverity::Info,
            Some(lsp_types::DiagnosticSeverity::HINT) => LspSeverity::Hint,
            None => LspSeverity::Warning,
        },
        message: d.message.clone(),
        code: d.code.as_ref().map(|c| match c {
            lsp_types::NumberOrString::Number(n) => n.to_string(),
            lsp_types::NumberOrString::String(s) => s.clone(),
        }),
    }
}

// ─── WorkspaceEdit application ───────────────────────────────────────────

/// Apply a `WorkspaceEdit` to the filesystem.
///
/// Edits are applied file-by-file, with each file's edits applied in reverse
/// order (bottom-to-top) to preserve position stability.
async fn apply_workspace_edit(edit: &lsp_types::WorkspaceEdit) -> AirisResult<()> {
    // Process `changes` (the simpler form).
    if let Some(changes) = &edit.changes {
        for (uri, text_edits) in changes {
            let path = uri_to_path(uri);
            apply_text_edits_to_file(&path, text_edits).await?;
        }
    }

    // Process `document_changes` if present (more complex form).
    if let Some(doc_changes) = &edit.document_changes {
        match doc_changes {
            lsp_types::DocumentChanges::Edits(edits) => {
                for change in edits {
                    let path = uri_to_path(&change.text_document.uri);
                    apply_text_edits_to_file(&path, &change.edits).await?;
                }
            }
            lsp_types::DocumentChanges::Operations(ops) => {
                for op in ops {
                    match op {
                        lsp_types::DocumentChange::Op(_resource_op) => {
                            // Resource operations (create/rename/delete files) are
                            // not yet supported.
                            warn!("WorkspaceEdit resource operations are not supported yet");
                        }
                        lsp_types::DocumentChange::Edit(change) => {
                            let path = uri_to_path(&change.text_document.uri);
                            apply_text_edits_to_file(&path, &change.edits).await?;
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// Apply a list of `TextEdit`s to a file, sorted bottom-to-top.
async fn apply_text_edits_to_file(path: &Path, edits: &[lsp_types::TextEdit]) -> AirisResult<()> {
    if edits.is_empty() {
        return Ok(());
    }

    let content = tokio::fs::read_to_string(path).await.map_err(AirisError::Io)?;
    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let has_trailing_newline = content.ends_with('\n');

    // Sort by descending start position.
    let mut sorted_edits: Vec<&lsp_types::TextEdit> = edits.iter().collect();
    sorted_edits.sort_by(|a, b| {
        b.range
            .start
            .line
            .cmp(&a.range.start.line)
            .then_with(|| b.range.start.character.cmp(&a.range.start.character))
    });

    for edit in &sorted_edits {
        let start_line = edit.range.start.line as usize;
        let start_char = edit.range.start.character as usize;
        let end_line = edit.range.end.line as usize;
        let end_char = edit.range.end.character as usize;

        // Ensure lines buffer is large enough.
        while lines.len() <= end_line {
            lines.push(String::new());
        }

        if start_line == end_line {
            // Single-line edit.
            let line = &mut lines[start_line];
            let mut chars: Vec<char> = line.chars().collect();
            let start = start_char.min(chars.len());
            let end = end_char.min(chars.len()).max(start);
            chars.splice(start..end, edit.new_text.chars());
            *line = chars.into_iter().collect();
        } else {
            // Multi-line edit: concatenate prefix + new_text + suffix.
            let prefix: String = lines[start_line].chars().take(start_char).collect();
            let suffix: String = lines[end_line].chars().skip(end_char).collect();
            let replacement = format!("{}{}{}", prefix, edit.new_text, suffix);
            let end = (end_line + 1).min(lines.len());
            lines.splice(start_line..end, [replacement]);
        }
    }

    let mut result = lines.join("\n");
    if has_trailing_newline {
        result.push('\n');
    }

    tokio::fs::write(path, &result).await.map_err(AirisError::Io)?;
    Ok(())
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_hover_contents_to_string() {
        use lsp_types::MarkedString;

        let s = hover_contents_to_string(&lsp_types::HoverContents::Scalar(
            MarkedString::String("hello".into()),
        ));
        assert_eq!(s, "hello");

        let s = hover_contents_to_string(&lsp_types::HoverContents::Scalar(
            MarkedString::LanguageString(lsp_types::LanguageString {
                language: "rust".into(),
                value: "fn main()".into(),
            }),
        ));
        assert_eq!(s, "```rust\nfn main()\n```");

        let s = hover_contents_to_string(&lsp_types::HoverContents::Markup(
            lsp_types::MarkupContent {
                kind: lsp_types::MarkupKind::Markdown,
                value: "# Title".into(),
            },
        ));
        assert_eq!(s, "# Title");
    }

    #[test]
    fn test_uri_roundtrip() {
        let path = PathBuf::from("/home/user/project/src/lib.rs");
        let uri = path_to_uri(&path).unwrap();
        let roundtrip = uri_to_path(&uri);
        assert_eq!(roundtrip, path);
    }

    #[test]
    fn test_lsp_severity_conversion() {
        let make_diag = |sev: Option<lsp_types::DiagnosticSeverity>| lsp_types::Diagnostic {
            range: lsp_types::Range {
                start: lsp_types::Position {
                    line: 0,
                    character: 0,
                },
                end: lsp_types::Position {
                    line: 1,
                    character: 1,
                },
            },
            severity: sev,
            message: "test".into(),
            ..Default::default()
        };
        let uri = Url::parse("file:///test.rs").unwrap();

        assert_eq!(
            lsp_diagnostic_to_core(&uri, &make_diag(Some(lsp_types::DiagnosticSeverity::ERROR))).severity,
            LspSeverity::Error
        );
        assert_eq!(
            lsp_diagnostic_to_core(&uri, &make_diag(Some(lsp_types::DiagnosticSeverity::WARNING))).severity,
            LspSeverity::Warning
        );
        assert_eq!(
            lsp_diagnostic_to_core(&uri, &make_diag(None)).severity,
            LspSeverity::Warning
        );
        assert_eq!(
            lsp_diagnostic_to_core(&uri, &make_diag(Some(lsp_types::DiagnosticSeverity::HINT))).severity,
            LspSeverity::Hint
        );
    }
}
