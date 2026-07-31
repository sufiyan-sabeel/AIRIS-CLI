//! # airis-mcp
//!
//! MCP (Model Context Protocol) integration for AIRIS-CLI.
//!
//! This crate provides a full implementation of the MCP client, enabling
//! communication with MCP servers that expose tools and resources via the
//! JSON-RPC 2.0 based protocol.
//!
//! ## Architecture
//!
//! - [`McpManagerImpl`] — top-level manager implementing the [`McpManager`] trait.
//! - [`McpServerHandle`] — lifecycle handle for a single MCP server instance.
//! - [`Transport`] — abstraction over stdio and TCP transports.
//!
//! ## Usage
//!
//! ```rust,no_run
//! use airis_core::prelude::*;
//! use airis_mcp::McpManagerImpl;
//!
//! # async fn example() -> AirisResult<()> {
//! let manager = McpManagerImpl::new();
//!
//! let config = McpServerConfig {
//!     name: "my-server".into(),
//!     command: "npx".into(),
//!     args: vec!["-y".into(), "@modelcontextprotocol/server-filesystem".into(), "/tmp".into()],
//!     transport: "stdio".into(),
//!     ..Default::default()
//! };
//!
//! manager.start_server(&config).await?;
//!
//! let tools = manager.list_tools().await?;
//! for tool in tools {
//!     println!("Tool: {} - {}", tool.name, tool.description);
//! }
//!
//! manager.stop_server("my-server").await?;
//! # Ok(())
//! # }
//! ```

pub mod manager;
pub mod server;
pub mod transport;
pub mod types;

// Re-exports for convenience
pub use manager::McpManagerImpl;
pub use server::McpServerHandle;
pub use transport::{Transport, TransportKind, StdioTransport, TcpTransport};
pub use types::{
    InitializeParams, InitializeResult, Implementation, ClientCapabilities,
    ServerCapabilities, ResourcesCapability,
    McpTool, ToolResultContent, CallToolParams, CallToolResult,
    Resource, ResourceContents, ListToolsResult, ListResourcesResult,
    ReadResourceParams, ReadResourceResult,
    JsonRpcId, JsonRpcRequest, JsonRpcResponse, JsonRpcErrorResponse,
    JsonRpcError, JsonRpcNotification, JsonRpcMessage,
};

/// The MCP protocol version supported by this implementation.
pub const MCP_PROTOCOL_VERSION: &str = "2025-03-26";
