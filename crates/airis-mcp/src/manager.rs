//! McpManager implementation — the top-level MCP server manager.
//!
//! Manages multiple MCP server instances, providing discovery, invocation,
//! and lifecycle control.

use crate::server::{McpServerHandle, ServerState};
use airis_core::prelude::*;
use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Implementation of the [`McpManager`] trait.
///
/// Manages a collection of MCP servers, each identified by a unique name.
/// Servers can be started from config, stopped, and queried for tools/resources.
pub struct McpManagerImpl {
    servers: DashMap<String, Arc<McpServerHandle>>,
}

impl McpManagerImpl {
    /// Create a new, empty MCP manager.
    pub fn new() -> Self {
        Self {
            servers: DashMap::new(),
        }
    }

    /// Get the handle for a named server.
    pub fn get_server(&self, name: &str) -> Option<Arc<McpServerHandle>> {
        self.servers.get(name).map(|s| Arc::clone(&s))
    }

    /// List all running server names and their states.
    pub async fn list_servers(&self) -> Vec<(String, ServerState)> {
        // Collect handles first to avoid holding shard locks across await
        let handles: Vec<(String, Arc<McpServerHandle>)> = self.servers
            .iter()
            .map(|entry| (entry.key().clone(), Arc::clone(entry.value())))
            .collect();

        let mut result: Vec<(String, ServerState)> = Vec::with_capacity(handles.len());
        for (name, handle) in &handles {
            let state = handle.state().await;
            result.push((name.clone(), state));
        }
        result.sort_by(|a, b| a.0.cmp(&b.0));
        result
    }

    /// Check if a server is running and initialized.
    pub async fn is_running(&self, name: &str) -> bool {
        let handle = self.servers.get(name).map(|s| Arc::clone(&s));
        match handle {
            Some(h) => h.state().await == ServerState::Initialized,
            None => false,
        }
    }

    /// Helper: ensure the server is initialized before operations.
    #[allow(dead_code)]
    async fn require_initialized(&self, name: &str) -> AirisResult<Arc<McpServerHandle>> {
        self.servers
            .get(name)
            .map(|s| Arc::clone(&s))
            .ok_or_else(|| {
                AirisError::LspNotRunning(format!("MCP server '{}' is not running", name))
            })
    }
}

#[async_trait]
impl McpManager for McpManagerImpl {
    async fn start_server(&self, config: &McpServerConfig) -> AirisResult<()> {
        let name = config.name.clone();

        // Check if already running (drop the ref before await)
        let already_running = self.servers
            .get(&name)
            .map(|s| Arc::clone(&s));

        if let Some(handle) = already_running {
            if handle.state().await == ServerState::Initialized {
                info!(target: "airis_mcp", "MCP server '{}' already running", name);
                return Ok(());
            }
            // Remove stale entry
            self.servers.remove(&name);
        }

        info!(target: "airis_mcp", "Starting MCP server '{}' ({} {})", name, config.command, config.args.join(" "));

        let handle = McpServerHandle::start(config.clone()).await?;
        self.servers.insert(name.clone(), handle);

        debug!(
            target: "airis_mcp",
            "MCP server '{}' started successfully", name
        );
        Ok(())
    }

    async fn stop_server(&self, name: &str) -> AirisResult<()> {
        let handle = self.servers.remove(name).map(|(_, h)| h).ok_or_else(|| {
            AirisError::LspNotRunning(format!("MCP server '{}' is not running", name))
        })?;

        handle.shutdown().await?;
        Ok(())
    }

    async fn list_tools(&self) -> AirisResult<Vec<McpToolDefinition>> {
        // Collect handles first to avoid holding shard locks across await
        let handles: Vec<Arc<McpServerHandle>> = self.servers
            .iter()
            .map(|entry| Arc::clone(entry.value()))
            .collect();

        let mut all_tools = Vec::new();
        for handle in &handles {
            if handle.state().await != ServerState::Initialized {
                continue;
            }

            if !handle.has_tools().await {
                continue;
            }

            match handle.list_tools().await {
                Ok(tools) => all_tools.extend(tools),
                Err(e) => {
                    warn!(
                        target: "airis_mcp",
                        "Failed to list tools from '{}': {}",
                        handle.config.name,
                        e
                    );
                }
            }
        }

        Ok(all_tools)
    }

    async fn list_resources(&self) -> AirisResult<Vec<McpResource>> {
        // Collect handles first to avoid holding shard locks across await
        let handles: Vec<Arc<McpServerHandle>> = self.servers
            .iter()
            .map(|entry| Arc::clone(entry.value()))
            .collect();

        let mut all_resources = Vec::new();
        for handle in &handles {
            if handle.state().await != ServerState::Initialized {
                continue;
            }

            if !handle.has_resources().await {
                continue;
            }

            match handle.list_resources().await {
                Ok(resources) => all_resources.extend(resources),
                Err(e) => {
                    warn!(
                        target: "airis_mcp",
                        "Failed to list resources from '{}': {}",
                        handle.config.name,
                        e
                    );
                }
            }
        }

        Ok(all_resources)
    }

    async fn call_tool(&self, name: &str, args: serde_json::Value) -> AirisResult<String> {
        // Collect handles first to avoid holding shard locks across await
        let handles: Vec<Arc<McpServerHandle>> = self.servers
            .iter()
            .map(|entry| Arc::clone(entry.value()))
            .collect();

        // Find which server provides this tool by scanning all servers
        for handle in &handles {
            if handle.state().await != ServerState::Initialized {
                continue;
            }

            let tools = handle.list_tools().await?;
            if tools.iter().any(|t| t.name == name) {
                return handle.call_tool(name, args).await;
            }
        }

        Err(AirisError::ToolNotFound(format!(
            "MCP tool '{}' not found in any running server",
            name
        )))
    }

    async fn read_resource(&self, uri: &str) -> AirisResult<String> {
        // Collect handles first to avoid holding shard locks across await
        let handles: Vec<Arc<McpServerHandle>> = self.servers
            .iter()
            .map(|entry| Arc::clone(entry.value()))
            .collect();

        // Find which server serves this resource by scanning
        for handle in &handles {
            if handle.state().await != ServerState::Initialized {
                continue;
            }

            let resources = handle.list_resources().await?;
            if resources.iter().any(|r| r.uri == uri) {
                return handle.read_resource(uri).await;
            }
        }

        Err(AirisError::ToolNotFound(format!(
            "MCP resource '{}' not found in any running server",
            uri
        )))
    }
}

impl Default for McpManagerImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_new_manager_is_empty() {
        let manager = McpManagerImpl::new();
        let servers = manager.list_servers().await;
        assert!(servers.is_empty());
    }

    #[tokio::test]
    async fn test_default() {
        let manager = McpManagerImpl::default();
        let servers = manager.list_servers().await;
        assert!(servers.is_empty());
    }
}
