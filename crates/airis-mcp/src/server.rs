//! MCP server lifecycle management.
//!
//! Manages the lifecycle of a single MCP server, including initialization,
//! capability discovery, and graceful shutdown.

use crate::transport::{create_transport, Transport, TransportKind};
use crate::types::*;
use airis_core::prelude::*;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Current state of an MCP server.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerState {
    Created,
    Initializing,
    Initialized,
    Failed(String),
    Shutdown,
}

impl std::fmt::Display for ServerState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Created => write!(f, "created"),
            Self::Initializing => write!(f, "initializing"),
            Self::Initialized => write!(f, "initialized"),
            Self::Failed(e) => write!(f, "failed: {}", e),
            Self::Shutdown => write!(f, "shutdown"),
        }
    }
}

/// Handle to a running MCP server.
pub struct McpServerHandle {
    /// Server configuration.
    pub config: McpServerConfig,
    /// Transport for communication.
    transport: Box<dyn Transport>,
    /// Current server state.
    state: RwLock<ServerState>,
    /// Server info from initialization.
    server_info: RwLock<Option<Implementation>>,
    /// Server capabilities from initialization.
    capabilities: RwLock<Option<ServerCapabilities>>,
    /// Protocol version negotiated.
    protocol_version: RwLock<Option<String>>,
}

impl McpServerHandle {
    /// Create a new server handle by spawning the process and initializing.
    pub async fn start(config: McpServerConfig) -> AirisResult<Arc<Self>> {
        let name = config.name.clone();
        let transport = create_transport(&config).await?;

        let handle = Arc::new(Self {
            config,
            transport,
            state: RwLock::new(ServerState::Created),
            server_info: RwLock::new(None),
            capabilities: RwLock::new(None),
            protocol_version: RwLock::new(None),
        });

        // Perform initialization handshake
        handle.initialize().await?;

        info!(target: "airis_mcp", "MCP server '{}' initialized successfully", name);
        Ok(handle)
    }

    /// Perform the MCP initialization handshake.
    async fn initialize(self: &Arc<Self>) -> AirisResult<()> {
        {
            let mut state = self.state.write().await;
            *state = ServerState::Initializing;
        }

        // Send initialize request
        let init_params = InitializeParams {
            protocol_version: Some("2025-03-26".to_string()),
            capabilities: ClientCapabilities::default(),
            client_info: Implementation {
                name: "airis-cli".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
        };

        let request = JsonRpcMessage::Request(JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: JsonRpcId::Number(1),
            method: "initialize".to_string(),
            params: Some(serde_json::to_value(init_params)?),
        });

        let response = self.transport.send(&request).await?;

        match response {
            JsonRpcMessage::Response(resp) => {
                let init_result: InitializeResult = serde_json::from_value(resp.result)?;

                {
                    let mut sv = self.server_info.write().await;
                    *sv = Some(init_result.server_info);
                }
                {
                    let mut caps = self.capabilities.write().await;
                    *caps = Some(init_result.capabilities);
                }
                {
                    let mut pv = self.protocol_version.write().await;
                    *pv = Some(init_result.protocol_version);
                }
            }
            JsonRpcMessage::ErrorResponse(err) => {
                let msg = format!(
                    "MCP server '{}' initialization failed: {} (code {})",
                    self.config.name, err.error.message, err.error.code
                );
                {
                    let mut state = self.state.write().await;
                    *state = ServerState::Failed(msg.clone());
                }
                return Err(AirisError::Internal(msg));
            }
            _ => {
                let msg = format!(
                    "MCP server '{}' returned unexpected message during init",
                    self.config.name
                );
                {
                    let mut state = self.state.write().await;
                    *state = ServerState::Failed(msg.clone());
                }
                return Err(AirisError::Internal(msg));
            }
        }

        // Send initialized notification
        self.transport
            .send_notification("notifications/initialized", None)
            .await?;

        {
            let mut state = self.state.write().await;
            *state = ServerState::Initialized;
        }

        Ok(())
    }

    /// Get current server state.
    pub async fn state(&self) -> ServerState {
        *self.state.read().await
    }

    /// Get server info.
    pub async fn server_info(&self) -> Option<Implementation> {
        self.server_info.read().await.clone()
    }

    /// Get server capabilities.
    pub async fn capabilities(&self) -> Option<ServerCapabilities> {
        self.capabilities.read().await.clone()
    }

    /// Check if the server supports tools.
    pub async fn has_tools(&self) -> bool {
        self.capabilities.read().await
            .as_ref()
            .and_then(|c| c.tools.as_ref())
            .is_some()
    }

    /// Check if the server supports resources.
    pub async fn has_resources(&self) -> bool {
        self.capabilities.read().await
            .as_ref()
            .and_then(|c| c.resources.as_ref())
            .is_some()
    }

    /// Ping the server to check liveness.
    pub async fn ping(&self) -> AirisResult<()> {
        let request = JsonRpcMessage::Request(JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: JsonRpcId::Number(u64::MAX),
            method: "ping".to_string(),
            params: None,
        });

        let response = self.transport.send(&request).await?;
        match response {
            JsonRpcMessage::Response(_) => Ok(()),
            JsonRpcMessage::ErrorResponse(err) => {
                Err(AirisError::Internal(format!("Ping failed: {}", err.message)))
            }
            _ => Err(AirisError::Internal("Unexpected ping response".to_string())),
        }
    }

    /// List available tools from this server.
    pub async fn list_tools(&self) -> AirisResult<Vec<McpToolDefinition>> {
        let request = JsonRpcMessage::Request(JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: JsonRpcId::Number(2),
            method: "tools/list".to_string(),
            params: None,
        });

        let response = self.transport.send(&request).await?;
        match response {
            JsonRpcMessage::Response(resp) => {
                let tools_result: ListToolsResult = serde_json::from_value(resp.result)?;
                Ok(tools_result
                    .tools
                    .into_iter()
                    .map(|t| McpToolDefinition {
                        name: t.name,
                        description: t.description.unwrap_or_default(),
                        input_schema: t.input_schema.unwrap_or(serde_json::Value::Null),
                        server_name: self.config.name.clone(),
                    })
                    .collect())
            }
            JsonRpcMessage::ErrorResponse(err) => {
                Err(AirisError::ToolExecution(format!(
                    "tools/list failed: {} (code {})",
                    err.error.message, err.error.code
                )))
            }
            _ => Err(AirisError::ToolExecution(
                "Unexpected response to tools/list".to_string(),
            )),
        }
    }

    /// List available resources from this server.
    pub async fn list_resources(&self) -> AirisResult<Vec<McpResource>> {
        let request = JsonRpcMessage::Request(JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: JsonRpcId::Number(3),
            method: "resources/list".to_string(),
            params: None,
        });

        let response = self.transport.send(&request).await?;
        match response {
            JsonRpcMessage::Response(resp) => {
                let resources_result: ListResourcesResult =
                    serde_json::from_value(resp.result)?;
                Ok(resources_result
                    .resources
                    .into_iter()
                    .map(|r| McpResource {
                        uri: r.uri,
                        name: r.name,
                        description: r.description,
                        mime_type: r.mime_type,
                        server_name: self.config.name.clone(),
                    })
                    .collect())
            }
            JsonRpcMessage::ErrorResponse(err) => {
                Err(AirisError::ToolExecution(format!(
                    "resources/list failed: {} (code {})",
                    err.error.message, err.error.code
                )))
            }
            _ => Err(AirisError::ToolExecution(
                "Unexpected response to resources/list".to_string(),
            )),
        }
    }

    /// Call a tool on this server.
    pub async fn call_tool(
        &self,
        name: &str,
        args: serde_json::Value,
    ) -> AirisResult<String> {
        let call_params = CallToolParams {
            name: name.to_string(),
            arguments: if args.is_null() { None } else { Some(args) },
        };

        let request = JsonRpcMessage::Request(JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: JsonRpcId::Number(4),
            method: "tools/call".to_string(),
            params: Some(serde_json::to_value(call_params)?),
        });

        let response = self.transport.send(&request).await?;
        match response {
            JsonRpcMessage::Response(resp) => {
                let call_result: CallToolResult = serde_json::from_value(resp.result)?;
                // Concatenate all text content pieces
                let mut output = String::new();
                for content in &call_result.content {
                    match content {
                        ToolResultContent::Text { text } => output.push_str(text),
                        ToolResultContent::Image { data, mime_type } => {
                            output.push_str(&format!(
                                "[Image: {} ({} bytes)]",
                                mime_type,
                                data.len()
                            ));
                        }
                        ToolResultContent::Resource { resource } => match resource {
                            ResourceContents::Text { uri, text, .. } => {
                                output.push_str(&format!("[Resource {}]: {}", uri, text));
                            }
                            ResourceContents::Blob { uri, mime_type, .. } => {
                                output.push_str(&format!(
                                    "[Blob {}: {} ({} bytes)]",
                                    uri,
                                    mime_type.as_deref().unwrap_or("unknown"),
                                    data_len_info(resource),
                                ));
                            }
                        },
                    }
                }

                if call_result.is_error.unwrap_or(false) && output.is_empty() {
                    return Err(AirisError::ToolExecution(format!(
                        "Tool '{}' returned an error without text content",
                        name
                    )));
                }

                Ok(output)
            }
            JsonRpcMessage::ErrorResponse(err) => {
                Err(AirisError::ToolExecution(format!(
                    "Tool '{}' call failed: {} (code {})",
                    name, err.error.message, err.error.code
                )))
            }
            _ => Err(AirisError::ToolExecution(format!(
                "Unexpected response to tools/call '{}'",
                name
            ))),
        }
    }

    /// Read a resource from this server.
    pub async fn read_resource(&self, uri: &str) -> AirisResult<String> {
        let read_params = ReadResourceParams {
            uri: uri.to_string(),
        };

        let request = JsonRpcMessage::Request(JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: JsonRpcId::Number(5),
            method: "resources/read".to_string(),
            params: Some(serde_json::to_value(read_params)?),
        });

        let response = self.transport.send(&request).await?;
        match response {
            JsonRpcMessage::Response(resp) => {
                let read_result: ReadResourceResult = serde_json::from_value(resp.result)?;
                let mut output = String::new();
                for content in &read_result.contents {
                    match content {
                        ResourceContents::Text { text, .. } => output.push_str(text),
                        ResourceContents::Blob { blob, mime_type, .. } => {
                            output.push_str(&format!(
                                "[Binary blob: {} ({} bytes)]",
                                mime_type.as_deref().unwrap_or("unknown"),
                                blob.len()
                            ));
                        }
                    }
                }
                Ok(output)
            }
            JsonRpcMessage::ErrorResponse(err) => {
                Err(AirisError::ToolExecution(format!(
                    "Resource '{}' read failed: {} (code {})",
                    uri, err.error.message, err.error.code
                )))
            }
            _ => Err(AirisError::ToolExecution(format!(
                "Unexpected response to resources/read '{}'",
                uri
            ))),
        }
    }

    /// Gracefully shutdown this server.
    pub async fn shutdown(self: &Arc<Self>) -> AirisResult<()> {
        let mut state = self.state.write().await;
        match *state {
            ServerState::Shutdown => return Ok(()),
            ServerState::Failed(_) => {
                *state = ServerState::Shutdown;
                return Ok(());
            }
            _ => {}
        }

        let result = self.transport.close().await;
        *state = ServerState::Shutdown;

        info!(target: "airis_mcp", "MCP server '{}' shut down", self.config.name);
        result
    }
}

/// Helper to get data length info from a ResourceContents for display.
fn data_len_info(resource: &ResourceContents) -> usize {
    match resource {
        ResourceContents::Blob { blob, .. } => blob.len(),
        ResourceContents::Text { text, .. } => text.len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_server_state_display() {
        assert_eq!(format!("{}", ServerState::Created), "created");
        assert_eq!(format!("{}", ServerState::Initializing), "initializing");
        assert_eq!(format!("{}", ServerState::Initialized), "initialized");
        assert_eq!(
            format!("{}", ServerState::Failed("oops".to_string())),
            "failed: oops"
        );
        assert_eq!(format!("{}", ServerState::Shutdown), "shutdown");
    }

    #[test]
    fn test_transport_kind_display() {
        assert_eq!(format!("{}", TransportKind::Stdio), "stdio");
        assert_eq!(format!("{}", TransportKind::Tcp), "tcp");
    }
}
