//! Transport abstraction for MCP server communication.
//!
//! Supports stdio (child process stdin/stdout) and TCP transports.

use crate::types::*;
use airis_core::prelude::*;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use tracing::{trace, warn};

/// Transport type identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportKind {
    Stdio,
    Tcp,
}

impl std::fmt::Display for TransportKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Stdio => write!(f, "stdio"),
            Self::Tcp => write!(f, "tcp"),
        }
    }
}

/// A generic transport for sending JSON-RPC messages to an MCP server and
/// receiving responses.
#[async_trait]
pub trait Transport: Send + Sync {
    /// Send a message and receive the matching response.
    async fn send(&self, msg: &JsonRpcMessage) -> AirisResult<JsonRpcMessage>;

    /// Send a notification (fire-and-forget, no response).
    async fn send_notification(&self, method: &str, params: Option<serde_json::Value>) -> AirisResult<()>;

    /// Close the transport cleanly.
    async fn close(&self) -> AirisResult<()>;

    /// Return the transport kind.
    fn kind(&self) -> TransportKind;
}

/// Stdio-based transport: spawns a child process and communicates over
/// its stdin/stdout using newline-delimited JSON.
pub struct StdioTransport {
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    stdout: Arc<Mutex<Option<tokio::io::Lines<BufReader<ChildStdout>>>>>,
    next_id: Arc<Mutex<u64>>,
    config_name: String,
}

impl StdioTransport {
    /// Create and spawn a new stdio transport.
    pub async fn spawn(
        name: &str,
        command: &str,
        args: &[String],
        env: Option<&std::collections::HashMap<String, String>>,
        cwd: Option<&std::path::Path>,
    ) -> AirisResult<Self> {
        let mut cmd = Command::new(command);
        cmd.args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit()); // forward stderr for debugging

        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }

        if let Some(env_map) = env {
            cmd.envs(env_map);
        }

        let mut child = cmd.spawn().map_err(|e| {
            AirisError::Internal(format!("Failed to spawn MCP server '{}': {}", name, e))
        })?;

        let stdin = child.stdin.take().ok_or_else(|| {
            AirisError::Internal(format!("Failed to open stdin for MCP server '{}'", name))
        })?;

        let stdout = child.stdout.take().ok_or_else(|| {
            AirisError::Internal(format!("Failed to open stdout for MCP server '{}'", name))
        })?;

        let reader = BufReader::new(stdout).lines();

        Ok(Self {
            child: Arc::new(Mutex::new(Some(child))),
            stdin: Arc::new(Mutex::new(Some(stdin))),
            stdout: Arc::new(Mutex::new(Some(reader))),
            next_id: Arc::new(Mutex::new(1)),
            config_name: name.to_string(),
        })
    }

    /// Generate the next request ID.
    #[allow(dead_code)]
    async fn next_id(&self) -> u64 {
        let mut id = self.next_id.lock().await;
        let current = *id;
        *id += 1;
        current
    }

    /// Read the next JSON-RPC message from stdout.
    async fn read_message(&self) -> AirisResult<JsonRpcMessage> {
        let mut stdout_guard = self.stdout.lock().await;
        let reader = stdout_guard.as_mut().ok_or_else(|| {
            AirisError::Internal("MCP transport stdout already closed".to_string())
        })?;

        loop {
            let mut line = String::new();
            // Tokio's Lines reader returns None on EOF
            let n = reader
                .next_line()
                .await
                .map_err(|e| AirisError::Internal(format!("MCP read error: {}", e)))?;

            match n {
                Some(text) => {
                    line = text;
                }
                None => {
                    return Err(AirisError::Internal(
                        "MCP server closed stdout connection".to_string(),
                    ));
                }
            }

            // Skip empty lines (some servers send them as separators)
            if line.trim().is_empty() {
                continue;
            }

            trace!(target: "airis_mcp", "RECV {}: {}", self.config_name, line);

            match serde_json::from_str::<JsonRpcMessage>(&line) {
                Ok(msg) => return Ok(msg),
                Err(e) => {
                    warn!(
                        target: "airis_mcp",
                        "Failed to parse JSON-RPC message from '{}': {} — raw: {}",
                        self.config_name,
                        e,
                        line
                    );
                    // Try to recover by reading the next line
                    continue;
                }
            }
        }
    }

    /// Write a JSON-RPC message to stdin.
    async fn write_message(&self, msg: &JsonRpcMessage) -> AirisResult<()> {
        let json = serde_json::to_string(msg)?;
        trace!(target: "airis_mcp", "SEND {}: {}", self.config_name, json);

        let mut stdin_guard = self.stdin.lock().await;
        let stdin = stdin_guard.as_mut().ok_or_else(|| {
            AirisError::Internal("MCP transport stdin already closed".to_string())
        })?;

        stdin.write_all(json.as_bytes()).await.map_err(|e| {
            AirisError::Internal(format!("MCP write error: {}", e))
        })?;
        stdin.write_all(b"\n").await.map_err(|e| {
            AirisError::Internal(format!("MCP write error (newline): {}", e))
        })?;
        stdin.flush().await.map_err(|e| {
            AirisError::Internal(format!("MCP flush error: {}", e))
        })?;

        Ok(())
    }
}

#[async_trait]
impl Transport for StdioTransport {
    async fn send(&self, msg: &JsonRpcMessage) -> AirisResult<JsonRpcMessage> {
        // Extract request ID if present (for notifications we don't expect a response)
        let request_id = match msg {
            JsonRpcMessage::Request(req) => Some(req.id.clone()),
            _ => None,
        };

        self.write_message(msg).await?;

        if request_id.is_none() {
            // Notifications don't get a response
            return Ok(JsonRpcMessage::Response(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: JsonRpcId::Number(0),
                result: serde_json::Value::Null,
            }));
        }

        // Read responses until we get the matching one
        let expected_id = request_id.unwrap();
        loop {
            let response = self.read_message().await?;

            match &response {
                JsonRpcMessage::Response(resp) if resp.id == expected_id => {
                    return Ok(response);
                }
                JsonRpcMessage::ErrorResponse(err) if err.id == expected_id => {
                    return Ok(response);
                }
                // Handle non-initialization messages (tools/resources) during init
                JsonRpcMessage::Response(_) | JsonRpcMessage::ErrorResponse(_) => {
                    // Wrong ID — might be a stale response from a previous request
                    // or a concurrent request. In practice, we serialize requests,
                    // so this should not happen unless the server reuses IDs.
                    warn!(
                        target: "airis_mcp",
                        "Mismatched response ID for '{}': expected {:?}",
                        self.config_name,
                        expected_id
                    );
                    continue;
                }
                // Notifications are unexpected in response to a request
                JsonRpcMessage::Notification(_) => {
                    // Some servers send notifications interleaved; we ignore them
                    continue;
                }
                JsonRpcMessage::Request(_) => {
                    // Server sent us a request (e.g., sampling/createMessage or roots/list)
                    // This would be handled in a full duplex scenario
                    warn!(
                        target: "airis_mcp",
                        "Unexpected server request during send for '{}'",
                        self.config_name
                    );
                    continue;
                }
            }
        }
    }

    async fn send_notification(&self, method: &str, params: Option<serde_json::Value>) -> AirisResult<()> {
        let notification = JsonRpcMessage::Notification(JsonRpcNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        });
        self.write_message(&notification).await
    }

    async fn close(&self) -> AirisResult<()> {
        // Close stdin to signal the server
        {
            let mut stdin_guard = self.stdin.lock().await;
            if let Some(mut stdin) = stdin_guard.take() {
                if let Err(e) = stdin.shutdown().await {
                    warn!(target: "airis_mcp", "Error shutting down MCP stdin: {}", e);
                }
            }
        }

        // Kill the child process
        let mut child_guard = self.child.lock().await;
        if let Some(mut child) = child_guard.take() {
            // Give it a moment to exit gracefully
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            let _ = child.kill().await;
            let _ = child.wait().await;
        }

        Ok(())
    }

    fn kind(&self) -> TransportKind {
        TransportKind::Stdio
    }
}

impl Drop for StdioTransport {
    fn drop(&mut self) {
        // Best-effort cleanup in case async close wasn't called.
        // try_lock is non-blocking; if the lock is contended we spawn
        // an async task to handle cleanup later.
        if let Ok(mut child_guard) = self.child.try_lock() {
            if let Some(mut child) = child_guard.take() {
                let _ = child.start_kill();
            }
        } else {
            let child = Arc::clone(&self.child);
            tokio::spawn(async move {
                let mut guard = child.lock().await;
                if let Some(mut c) = guard.take() {
                    let _ = c.kill().await;
                    let _ = c.wait().await;
                }
            });
        }
    }
}

/// TCP-based transport: connects to an MCP server via TCP socket.
pub struct TcpTransport {
    reader: Arc<Mutex<tokio::io::Lines<BufReader<tokio::net::tcp::OwnedReadHalf>>>>,
    writer: Arc<Mutex<tokio::net::tcp::OwnedWriteHalf>>,
    next_id: Arc<Mutex<u64>>,
    config_name: String,
}

impl TcpTransport {
    /// Connect to an MCP server at the given host:port.
    pub async fn connect(name: &str, host: &str, port: u16) -> AirisResult<Self> {
        let addr = format!("{}:{}", host, port);
        let stream = tokio::net::TcpStream::connect(&addr)
            .await
            .map_err(|e| {
                AirisError::Internal(format!(
                    "Failed to connect to MCP server '{}' at {}: {}",
                    name, addr, e
                ))
            })?;

        let (read_half, write_half) = stream.into_split();
        let reader = BufReader::new(read_half).lines();

        Ok(Self {
            reader: Arc::new(Mutex::new(reader)),
            writer: Arc::new(Mutex::new(write_half)),
            next_id: Arc::new(Mutex::new(1)),
            config_name: name.to_string(),
        })
    }

    /// Generate the next request ID.
    #[allow(dead_code)]
    async fn next_id(&self) -> u64 {
        let mut id = self.next_id.lock().await;
        let current = *id;
        *id += 1;
        current
    }

    /// Read the next JSON-RPC message.
    async fn read_message(&self) -> AirisResult<JsonRpcMessage> {
        let mut reader_guard = self.reader.lock().await;

        loop {
            let line = reader_guard
                .next_line()
                .await
                .map_err(|e| AirisError::Internal(format!("MCP TCP read error: {}", e)))?
                .ok_or_else(|| {
                    AirisError::Internal("MCP server closed TCP connection".to_string())
                })?;

            if line.trim().is_empty() {
                continue;
            }

            trace!(target: "airis_mcp", "RECV TCP {}: {}", self.config_name, line);

            match serde_json::from_str::<JsonRpcMessage>(&line) {
                Ok(msg) => return Ok(msg),
                Err(e) => {
                    warn!(
                        target: "airis_mcp",
                        "Failed to parse JSON-RPC message from TCP '{}': {}",
                        self.config_name,
                        e
                    );
                    continue;
                }
            }
        }
    }

    /// Write a JSON-RPC message.
    async fn write_message(&self, msg: &JsonRpcMessage) -> AirisResult<()> {
        let json = serde_json::to_string(msg)?;
        trace!(target: "airis_mcp", "SEND TCP {}: {}", self.config_name, json);

        let mut writer_guard = self.writer.lock().await;
        writer_guard.write_all(json.as_bytes()).await.map_err(|e| {
            AirisError::Internal(format!("MCP TCP write error: {}", e))
        })?;
        writer_guard.write_all(b"\n").await.map_err(|e| {
            AirisError::Internal(format!("MCP TCP write error (newline): {}", e))
        })?;
        writer_guard.flush().await.map_err(|e| {
            AirisError::Internal(format!("MCP TCP flush error: {}", e))
        })?;

        Ok(())
    }
}

#[async_trait]
impl Transport for TcpTransport {
    async fn send(&self, msg: &JsonRpcMessage) -> AirisResult<JsonRpcMessage> {
        let request_id = match msg {
            JsonRpcMessage::Request(req) => Some(req.id.clone()),
            _ => None,
        };

        self.write_message(msg).await?;

        if request_id.is_none() {
            return Ok(JsonRpcMessage::Response(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: JsonRpcId::Number(0),
                result: serde_json::Value::Null,
            }));
        }

        let expected_id = request_id.unwrap();
        loop {
            let response = self.read_message().await?;

            match &response {
                JsonRpcMessage::Response(resp) if resp.id == expected_id => {
                    return Ok(response);
                }
                JsonRpcMessage::ErrorResponse(err) if err.id == expected_id => {
                    return Ok(response);
                }
                _ => continue,
            }
        }
    }

    async fn send_notification(&self, method: &str, params: Option<serde_json::Value>) -> AirisResult<()> {
        let notification = JsonRpcMessage::Notification(JsonRpcNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        });
        self.write_message(&notification).await
    }

    async fn close(&self) -> AirisResult<()> {
        // Closing the writer half will signal EOF to the server
        // The transport doesn't own the stream; the drop handles it.
        Ok(())
    }

    fn kind(&self) -> TransportKind {
        TransportKind::Tcp
    }
}

/// Create a transport from an MCP server config.
pub async fn create_transport(config: &McpServerConfig) -> AirisResult<Box<dyn Transport>> {
    match config.transport.as_str() {
        "tcp" => {
            let host = config.host.as_deref().unwrap_or("127.0.0.1");
            let port = config.port.ok_or_else(|| {
                AirisError::Config("TCP transport requires a port".to_string())
            })?;
            let transport = TcpTransport::connect(&config.name, host, port).await?;
            Ok(Box::new(transport))
        }
        "stdio" | _ => {
            let cwd = config.cwd.as_deref();
            let env = config.env.as_ref();
            let transport = StdioTransport::spawn(
                &config.name,
                &config.command,
                &config.args,
                env,
                cwd,
            )
            .await?;
            Ok(Box::new(transport))
        }
    }
}
