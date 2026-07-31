//! Agent orchestrator - manages sub-agent lifecycle, communication, and task execution.
//!
//! Spawns specialized sub-agents (Coder, Reviewer, Planner, etc.),
//! handles agent-to-agent communication, and executes task plans.
//! Original Rust implementation inspired by Oh My Pi's agent orchestration.

use airis_core::prelude::*;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{info, warn, error};
use uuid::Uuid;

// ─── Agent Messages ────────────────────────────────────────────────

/// Message sent between agents.
#[derive(Debug, Clone)]
pub struct AgentMessage {
    pub from: String,
    pub to: String,
    pub content: String,
    pub msg_type: MessageType,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub correlation_id: Option<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub enum MessageType {
    Request,
    Response,
    Broadcast,
    Error,
    Status,
    TaskResult { task_id: TaskId, success: bool },
    Coordination { action: String },
    Heartbeat,
}

/// A subscription to receive messages from specific agents.
#[derive(Debug)]
pub struct AgentSubscription {
    pub agent_id: String,
    pub topics: Vec<String>,
    pub tx: mpsc::UnboundedSender<AgentMessage>,
}

// ─── Sub-Agent Instance ────────────────────────────────────────────

/// A running sub-agent instance.
pub struct SubAgentInstance {
    pub id: String,
    pub agent_type: SubAgentType,
    pub task_id: Option<TaskId>,
    pub status: AgentStatus,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub heartbeat: chrono::DateTime<chrono::Utc>,
    pub message_rx: mpsc::UnboundedReceiver<AgentMessage>,
    pub inner_tx: mpsc::UnboundedSender<AgentMessage>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentStatus {
    Idle,
    Running,
    Waiting(Vec<TaskId>),
    Completed,
    Failed(String),
    Terminated,
}

// ─── Agent Orchestrator ─────────────────────────────────────────────

/// Manages sub-agent lifecycle and task distribution.
pub struct AgentOrchestrator {
    agents: Arc<RwLock<HashMap<String, SubAgentHandle>>>,
    task_queue: Arc<TaskQueue>,
    workspace_memory: Arc<WorkspaceMemory>,
    message_bus: Arc<MessageBus>,
    next_agent_id: AtomicU64,
    config: OrchestratorConfig,
}

/// Handle to a sub-agent for external control.
#[derive(Clone)]
pub struct SubAgentHandle {
    pub id: String,
    pub agent_type: SubAgentType,
    pub status: Arc<RwLock<AgentStatus>>,
    pub tx: mpsc::UnboundedSender<AgentMessage>,
}

/// Orchestrator configuration.
#[derive(Debug, Clone)]
pub struct OrchestratorConfig {
    pub max_concurrent_agents: usize,
    pub default_timeout_seconds: u64,
    pub heartbeat_interval_ms: u64,
    pub enable_agent_communication: bool,
    pub log_agent_activity: bool,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            max_concurrent_agents: 10,
            default_timeout_seconds: 300,
            heartbeat_interval_ms: 5000,
            enable_agent_communication: true,
            log_agent_activity: true,
        }
    }
}

/// Central message bus for agent-to-agent communication.
pub struct MessageBus {
    subscriptions: Arc<RwLock<Vec<AgentSubscription>>>,
    message_log: Arc<Mutex<Vec<AgentMessage>>>,
    max_log_entries: usize,
}

impl MessageBus {
    pub fn new() -> Self {
        Self {
            subscriptions: Arc::new(RwLock::new(Vec::new())),
            message_log: Arc::new(Mutex::new(Vec::new())),
            max_log_entries: 1000,
        }
    }

    /// Subscribe to messages from an agent.
    pub async fn subscribe(&self, agent_id: String, tx: mpsc::UnboundedSender<AgentMessage>) {
        let mut subs = self.subscriptions.write().await;
        subs.push(AgentSubscription {
            agent_id,
            topics: vec!["*".into()],
            tx,
        });
    }

    /// Unsubscribe an agent.
    pub async fn unsubscribe(&self, agent_id: &str) {
        let mut subs = self.subscriptions.write().await;
        subs.retain(|s| s.agent_id != agent_id);
    }

    /// Publish a message to subscribers.
    pub async fn publish(&self, msg: AgentMessage) {
        // Log message
        {
            let mut log = self.message_log.lock().await;
            log.push(msg.clone());
            if log.len() > self.max_log_entries {
                log.remove(0);
            }
        }

        // Deliver to subscribers
        let subs = self.subscriptions.read().await;
        for sub in subs.iter() {
            if sub.agent_id != msg.from || msg.msg_type == MessageType::Broadcast {
                let _ = sub.tx.send(msg.clone());
            }
        }
    }

    /// Get message log.
    pub async fn get_log(&self, limit: usize) -> Vec<AgentMessage> {
        let log = self.message_log.lock().await;
        log.iter().rev().take(limit).cloned().collect()
    }

    /// Clear message log.
    pub async fn clear_log(&self) {
        let mut log = self.message_log.lock().await;
        log.clear();
    }
}

impl Default for MessageBus {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentOrchestrator {
    pub fn new(config: OrchestratorConfig) -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            task_queue: Arc::new(TaskQueue::new()),
            workspace_memory: Arc::new(WorkspaceMemory::new(200)),
            message_bus: Arc::new(MessageBus::new()),
            next_agent_id: AtomicU64::new(1),
            config,
        }
    }

    /// Get a reference to the task queue.
    pub fn task_queue(&self) -> &Arc<TaskQueue> {
        &self.task_queue
    }

    /// Get a reference to workspace memory.
    pub fn workspace_memory(&self) -> &Arc<WorkspaceMemory> {
        &self.workspace_memory
    }

    /// Get a reference to the message bus.
    pub fn message_bus(&self) -> &Arc<MessageBus> {
        &self.message_bus
    }

    /// Create a unique agent ID.
    fn generate_agent_id(&self, agent_type: &SubAgentType) -> String {
        let n = self.next_agent_id.fetch_add(1, Ordering::SeqCst);
        format!("{}-{}", agent_type.name().to_lowercase(), n)
    }

    /// Spawn a sub-agent for a specific task.
    pub async fn spawn_agent(
        &self,
        agent_type: SubAgentType,
        _task_id: Option<TaskId>,
        _goal: &str,
    ) -> AirisResult<SubAgentHandle> {
        let agent_id = self.generate_agent_id(&agent_type);
        let (tx, rx) = mpsc::unbounded_channel();

        // Subscribe to message bus
        self.message_bus.subscribe(agent_id.clone(), tx.clone()).await;

        let handle = SubAgentHandle {
            id: agent_id.clone(),
            agent_type,
            status: Arc::new(RwLock::new(AgentStatus::Idle)),
            tx: tx.clone(),
        };

        // Register agent
        {
            let mut agents = self.agents.write().await;
            agents.insert(agent_id.clone(), handle.clone());
        }

        // Spawn agent execution runner
        let config = self.config.clone();
        let task_queue = self.task_queue.clone();
        let workspace_memory = self.workspace_memory.clone();
        let message_bus = self.message_bus.clone();
        let agents = self.agents.clone();

        tokio::spawn(async move {
            Self::run_agent_loop(
                config,
                agents,
                message_bus,
                agent_id,
                agent_type,
                rx,
            ).await;
        });

        if self.config.log_agent_activity {
            info!("Spawned {} agent '{}' for task: {}", handle.agent_type, handle.id, goal);
        }

        Ok(handle)
    }

    /// Run an agent's execution loop (standalone function for spawned tasks).
    async fn run_agent_loop(
        config: OrchestratorConfig,
        agents: Arc<RwLock<HashMap<String, SubAgentHandle>>>,
        message_bus: Arc<MessageBus>,
        agent_id: String,
        agent_type: SubAgentType,
        mut rx: mpsc::UnboundedReceiver<AgentMessage>,
    ) {
        let timeout = std::time::Duration::from_secs(
            config.default_timeout_seconds,
        );

        // Update status to Running
        {
            let agents_lock = agents.read().await;
            if let Some(handle) = agents_lock.get(&agent_id) {
                *handle.status.write().await = AgentStatus::Running;
            }
        }

        // Agent message loop
        loop {
            tokio::select! {
                Some(msg) = rx.recv() => {
                    if config.log_agent_activity {
                        info!("Agent {} received: {}", agent_id, msg.content);
                    }
                }
                _ = tokio::time::sleep(timeout) => {
                    warn!("Agent {} timed out after {}s", agent_id, timeout.as_secs());
                    break;
                }
                else => break,
            }
        }

        // Update status to Completed
        {
            let agents_lock = agents.read().await;
            if let Some(handle) = agents_lock.get(&agent_id) {
                *handle.status.write().await = AgentStatus::Completed;
            }
        }
    }

    /// Execute a complete task plan.
    pub async fn execute_plan(&self, plan: ExecutionPlan) -> AirisResult<Vec<TaskResult>> {
        let mut results = Vec::new();
        let sorted = plan.sorted_tasks()?;

        for task in &sorted {
            let result = self.execute_single_task(task).await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Execute a single task.
    async fn execute_single_task(&self, task: &Task) -> AirisResult<TaskResult> {
        info!("Executing task: {} ({})", task.name, task.agent_type);

        // Spawn appropriate sub-agent
        let goal = format!("{}\n\nContext: {}", task.description, task.input);

        let handle = self.spawn_agent(
            task.agent_type,
            Some(task.id.clone()),
            &goal,
        ).await?;

        // Wait for agent to complete
        let start = std::time::Instant::now();
        let mut last_status = AgentStatus::Running;

        loop {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;

            let status = {
                let agents = self.agents.read().await;
                agents.get(&handle.id)
                    .map(|h| h.status.read().await.clone())
                    .unwrap_or(AgentStatus::Terminated)
            };

            match status {
                AgentStatus::Completed => {
                    let duration = start.elapsed();
                    return Ok(TaskResult {
                        task_id: task.id.clone(),
                        task_name: task.name.clone(),
                        success: true,
                        output: serde_json::json!({"status": "completed", "duration_ms": duration.as_millis() as u64}),
                        duration_ms: duration.as_millis() as u64,
                        error: None,
                    });
                }
                AgentStatus::Failed(ref e) => {
                    return Ok(TaskResult {
                        task_id: task.id.clone(),
                        task_name: task.name.clone(),
                        success: false,
                        output: serde_json::Value::Null,
                        duration_ms: start.elapsed().as_millis() as u64,
                        error: Some(e.clone()),
                    });
                }
                _ if last_status != status => {
                    last_status = status.clone();
                }
                _ => {}
            }

            // Timeout check
            if start.elapsed().as_secs() > task.timeout_seconds {
                return Ok(TaskResult {
                    task_id: task.id.clone(),
                    task_name: task.name.clone(),
                    success: false,
                    output: serde_json::Value::Null,
                    duration_ms: start.elapsed().as_millis() as u64,
                    error: Some(format!("Timeout after {}s", task.timeout_seconds)),
                });
            }
        }
    }

    /// Get the list of running agents.
    pub async fn list_agents(&self) -> Vec<AgentInfo> {
        let agents = self.agents.read().await;
        agents
            .values()
            .map(|h| AgentInfo {
                id: h.id.clone(),
                agent_type: h.agent_type,
                status: h.status.read().await.clone(),
            })
            .collect()
    }

    /// Get the number of running agents.
    pub async fn agent_count(&self) -> usize {
        let agents = self.agents.read().await;
        agents.len()
    }

    /// Terminate an agent.
    pub async fn terminate_agent(&self, agent_id: &str) -> AirisResult<()> {
        let mut agents = self.agents.write().await;
        if let Some(handle) = agents.remove(agent_id) {
            *handle.status.write().await = AgentStatus::Terminated;
            self.message_bus.unsubscribe(agent_id).await;
            info!("Terminated agent: {}", agent_id);
        }
        Ok(())
    }

    /// Terminate all agents.
    pub async fn terminate_all(&self) {
        let agent_ids: Vec<String> = {
            let agents = self.agents.read().await;
            agents.keys().cloned().collect()
        };

        for id in agent_ids {
            self.terminate_agent(&id).await.ok();
        }

        info!("Terminated all agents");
    }

    /// Get orchestrator configuration.
    pub fn config(&self) -> &OrchestratorConfig {
        &self.config
    }

    /// Get queue stats.
    pub async fn queue_stats(&self) -> TaskQueueStats {
        self.task_queue.stats().await
    }
}

/// Information about a running agent.
#[derive(Debug, Clone)]
pub struct AgentInfo {
    pub id: String,
    pub agent_type: SubAgentType,
    pub status: AgentStatus,
}

/// Result of task execution.
#[derive(Debug, Clone)]
pub struct TaskResult {
    pub task_id: TaskId,
    pub task_name: String,
    pub success: bool,
    pub output: serde_json::Value,
    pub duration_ms: u64,
    pub error: Option<String>,
}
