//! Task planning, decomposition, dependency resolution, and execution.
//!
//! Core task system for AIRIS-CLI. Breaks goals into executable steps,
//! resolves dependencies, manages priorities, retries, and rollback.
//! Original Rust implementation inspired by Oh My Pi's planner architecture.

use crate::error::{AirisError, AirisResult};
use crate::traits::*;
use crate::types::*;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

// ─── Task Types ─────────────────────────────────────────────────────

/// Unique task identifier.
#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskId(pub Uuid);

impl TaskId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl std::fmt::Display for TaskId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Priority level for task scheduling.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
pub enum TaskPriority {
    Critical = 0,
    High = 1,
    Normal = 2,
    Low = 3,
    Background = 4,
}

impl TaskPriority {
    pub fn from_usize(n: usize) -> Self {
        match n {
            0 => Self::Critical,
            1 => Self::High,
            2 => Self::Normal,
            3 => Self::Low,
            _ => Self::Background,
        }
    }
}

/// Current status of a task.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskStatus {
    Pending,
    Ready,
    Running,
    Completed,
    Failed(String),
    Cancelled,
    Blocked(Vec<TaskId>),
    Retrying { attempt: u32, max_attempts: u32 },
    RolledBack,
}

/// A single task in the execution plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: TaskId,
    pub name: String,
    pub description: String,
    pub priority: TaskPriority,
    pub status: TaskStatus,
    pub dependencies: Vec<TaskId>,
    pub dependents: Vec<TaskId>,
    pub subtasks: Vec<TaskId>,
    pub parent: Option<TaskId>,
    pub agent_type: SubAgentType,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub max_retries: u32,
    pub retry_count: u32,
    pub timeout_seconds: u64,
    pub metadata: HashMap<String, String>,
    pub error: Option<String>,
    pub progress: f64,
}

impl Task {
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            id: TaskId::new(),
            name: name.into(),
            description: description.into(),
            priority: TaskPriority::Normal,
            status: TaskStatus::Pending,
            dependencies: Vec::new(),
            dependents: Vec::new(),
            subtasks: Vec::new(),
            parent: None,
            agent_type: SubAgentType::Coder,
            input: serde_json::Value::Null,
            output: None,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            max_retries: 3,
            retry_count: 0,
            timeout_seconds: 300,
            metadata: HashMap::new(),
            error: None,
            progress: 0.0,
        }
    }

    /// Check if all dependencies are satisfied.
    pub fn dependencies_satisfied(&self, completed: &HashSet<TaskId>) -> bool {
        self.dependencies.iter().all(|dep| completed.contains(dep))
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self.status, TaskStatus::Completed | TaskStatus::Failed(_) | TaskStatus::Cancelled | TaskStatus::RolledBack)
    }

    pub fn can_execute(&self) -> bool {
        self.status == TaskStatus::Ready
    }
}

// ─── Plan ──────────────────────────────────────────────────────────

/// Execution plan consisting of ordered tasks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub id: Uuid,
    pub goal: String,
    pub tasks: Vec<Task>,
    pub created_at: DateTime<Utc>,
    pub status: PlanStatus,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlanStatus {
    Draft,
    Ready,
    Running,
    Completed,
    Failed(String),
    Cancelled,
}

impl ExecutionPlan {
    pub fn new(goal: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            goal: goal.into(),
            tasks: Vec::new(),
            created_at: Utc::now(),
            status: PlanStatus::Draft,
            metadata: HashMap::new(),
        }
    }

    /// Topological sort of tasks based on dependencies.
    pub fn sorted_tasks(&self) -> AirisResult<Vec<&Task>> {
        let mut in_degree: HashMap<&TaskId, usize> = HashMap::new();
        let mut adj: HashMap<&TaskId, Vec<&TaskId>> = HashMap::new();

        for task in &self.tasks {
            in_degree.entry(&task.id).or_insert(0);
            adj.entry(&task.id).or_default();
        }

        for task in &self.tasks {
            for dep in &task.dependencies {
                adj.entry(dep).or_default().push(&task.id);
                *in_degree.entry(&task.id).or_insert(0) += 1;
            }
        }

        // Kahn's algorithm
        let mut queue: VecDeque<&TaskId> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(id, _)| *id)
            .collect();

        let mut sorted = Vec::new();
        let task_map: HashMap<&TaskId, &Task> = self.tasks.iter().map(|t| (&t.id, t)).collect();

        while let Some(id) = queue.pop_front() {
            if let Some(task) = task_map.get(id) {
                sorted.push(*task);
            }
            if let Some(neighbors) = adj.get(id) {
                for neighbor in neighbors {
                    if let Some(deg) = in_degree.get_mut(neighbor) {
                        *deg -= 1;
                        if *deg == 0 {
                            queue.push_back(neighbor);
                        }
                    }
                }
            }
        }

        if sorted.len() != self.tasks.len() {
            return Err(AirisError::Custom(
                "Circular dependency detected in task plan".into(),
            ));
        }

        Ok(sorted)
    }

    /// Get tasks that are ready to execute (dependencies satisfied + not started).
    pub fn ready_tasks(&self, completed: &HashSet<TaskId>) -> Vec<&Task> {
        self.tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Pending && t.dependencies_satisfied(completed))
            .collect()
    }
}

// ─── Task Planner ──────────────────────────────────────────────────

/// Breaks down goals into executable task plans.
pub struct TaskPlanner {
    max_tasks_per_plan: usize,
}

impl TaskPlanner {
    pub fn new() -> Self {
        Self {
            max_tasks_per_plan: 50,
        }
    }

    /// Decompose a goal into an execution plan.
    pub fn plan(&self, goal: &str, context: &str) -> AirisResult<ExecutionPlan> {
        let mut plan = ExecutionPlan::new(goal);

        // Parse goal and decompose into tasks
        let tasks = self.decompose_goal(goal, context)?;

        if tasks.is_empty() {
            return Err(AirisError::Custom("Failed to decompose goal into tasks".into()));
        }

        if tasks.len() > self.max_tasks_per_plan {
            return Err(AirisError::Custom(format!(
                "Goal decomposition exceeds max tasks ({} > {})",
                tasks.len(),
                self.max_tasks_per_plan
            )));
        }

        plan.tasks = tasks;
        plan.status = PlanStatus::Ready;

        // Validate no circular dependencies
        plan.sorted_tasks()?;

        Ok(plan)
    }

    /// Decompose a goal string into structured tasks.
    fn decompose_goal(&self, goal: &str, _context: &str) -> AirisResult<Vec<Task>> {
        let mut tasks = Vec::new();

        // Analyze goal and create appropriate task breakdown
        let goal_lower = goal.to_lowercase();

        // Determine primary task type from goal keywords
        if goal_lower.contains("fix") || goal_lower.contains("bug") || goal_lower.contains("error") {
            // Bug fix workflow
            let mut debug_task = Task::new("Debug & Diagnose", "Identify root cause of the issue");
            debug_task.agent_type = SubAgentType::Debugger;
            debug_task.priority = TaskPriority::Critical;
            let debug_id = debug_task.id.clone();
            tasks.push(debug_task);

            let mut fix_task = Task::new("Implement Fix", "Apply the fix for the identified issue");
            fix_task.agent_type = SubAgentType::Coder;
            fix_task.dependencies.push(debug_id);
            fix_task.priority = TaskPriority::Critical;
            tasks.push(fix_task);

            let mut review_task = Task::new("Review Fix", "Review the fix for correctness and safety");
            review_task.agent_type = SubAgentType::Reviewer;
            review_task.dependencies.push(fix_task.id.clone());
            tasks.push(review_task);

            let mut test_task = Task::new("Test Fix", "Verify the fix works and doesn't break existing tests");
            test_task.agent_type = SubAgentType::Testing;
            test_task.dependencies.push(fix_task.id.clone());
            tasks.push(test_task);
        } else if goal_lower.contains("review") || goal_lower.contains("audit") {
            // Code review workflow
            let mut analyze_task = Task::new("Analyze Codebase", "Analyze code for issues and improvements");
            analyze_task.agent_type = SubAgentType::Reviewer;
            analyze_task.priority = TaskPriority::High;
            let analyze_id = analyze_task.id.clone();
            tasks.push(analyze_task);

            let mut security_task = Task::new("Security Review", "Check for security vulnerabilities");
            security_task.agent_type = SubAgentType::Security;
            security_task.dependencies.push(analyze_id.clone());
            tasks.push(security_task);

            let mut docs_task = Task::new("Documentation Review", "Review documentation quality");
            docs_task.agent_type = SubAgentType::Documentation;
            docs_task.dependencies.push(analyze_id);
            tasks.push(docs_task);

            let mut report_task = Task::new("Generate Report", "Compile review findings into report");
            report_task.agent_type = SubAgentType::Documentation;
            report_task.dependencies.push(security_task.id.clone());
            report_task.dependencies.push(docs_task.id.clone());
            tasks.push(report_task);
        } else if goal_lower.contains("refactor") || goal_lower.contains("clean") || goal_lower.contains("improve") {
            // Refactoring workflow
            let mut analyze_task = Task::new("Analyze Code", "Analyze code structure and quality");
            analyze_task.agent_type = SubAgentType::Reviewer;
            let analyze_id = analyze_task.id.clone();
            tasks.push(analyze_task);

            let mut plan_task = Task::new("Plan Refactoring", "Create refactoring plan");
            plan_task.agent_type = SubAgentType::Planner;
            plan_task.dependencies.push(analyze_id.clone());
            let plan_id = plan_task.id.clone();
            tasks.push(plan_task);

            let mut refactor_task = Task::new("Execute Refactoring", "Apply refactoring changes");
            refactor_task.agent_type = SubAgentType::Refactoring;
            refactor_task.dependencies.push(plan_id.clone());
            let refactor_id = refactor_task.id.clone();
            tasks.push(refactor_task);

            let mut test_task = Task::new("Verify Refactoring", "Run tests to verify behavior preserved");
            test_task.agent_type = SubAgentType::Testing;
            test_task.dependencies.push(refactor_id);
            tasks.push(test_task);
        } else if goal_lower.contains("search") || goal_lower.contains("find") || goal_lower.contains("research") {
            // Research workflow
            let mut search_task = Task::new("Search", "Search codebase and resources");
            search_task.agent_type = SubAgentType::Researcher;
            let search_id = search_task.id.clone();
            tasks.push(search_task);

            let mut analyze_task = Task::new("Analyze Findings", "Analyze search results");
            analyze_task.agent_type = SubAgentType::Researcher;
            analyze_task.dependencies.push(search_id);
            tasks.push(analyze_task);
        } else if goal_lower.contains("test") || goal_lower.contains("coverage") {
            // Testing workflow
            let mut analyze_task = Task::new("Analyze Test Coverage", "Review current test coverage");
            analyze_task.agent_type = SubAgentType::Testing;
            let analyze_id = analyze_task.id.clone();
            tasks.push(analyze_task);

            let mut write_task = Task::new("Write Tests", "Create new tests");
            write_task.agent_type = SubAgentType::Testing;
            write_task.dependencies.push(analyze_id.clone());
            let write_id = write_task.id.clone();
            tasks.push(write_task);

            let mut run_task = Task::new("Run Tests", "Execute test suite");
            run_task.agent_type = SubAgentType::Testing;
            run_task.dependencies.push(write_id);
            tasks.push(run_task);
        } else if goal_lower.contains("doc") || goal_lower.contains("comment") {
            // Documentation workflow
            let mut analyze_task = Task::new("Analyze Documentation", "Identify documentation gaps");
            analyze_task.agent_type = SubAgentType::Documentation;
            let analyze_id = analyze_task.id.clone();
            tasks.push(analyze_task);

            let mut write_task = Task::new("Write Documentation", "Create and update docs");
            write_task.agent_type = SubAgentType::Documentation;
            write_task.dependencies.push(analyze_id);
            let write_id = write_task.id.clone();
            tasks.push(write_task);

            let mut review_task = Task::new("Review Documentation", "Review documentation quality");
            review_task.agent_type = SubAgentType::Reviewer;
            review_task.dependencies.push(write_id);
            tasks.push(review_task);
        } else if goal_lower.contains("deploy") || goal_lower.contains("release") {
            // Deployment workflow
            let mut build_task = Task::new("Build", "Build the project");
            build_task.agent_type = SubAgentType::Coder;
            let build_id = build_task.id.clone();
            tasks.push(build_task);

            let mut test_task = Task::new("Test", "Run tests before deploy");
            test_task.agent_type = SubAgentType::Testing;
            test_task.dependencies.push(build_id.clone());
            tasks.push(test_task);

            let mut security_task = Task::new("Security Check", "Security verification");
            security_task.agent_type = SubAgentType::Security;
            security_task.dependencies.push(build_id);
            tasks.push(security_task);

            let mut deploy_task = Task::new("Deploy", "Execute deployment");
            deploy_task.agent_type = SubAgentType::Coder;
            deploy_task.dependencies.push(test_task.id.clone());
            deploy_task.dependencies.push(security_task.id.clone());
            tasks.push(deploy_task);
        } else {
            // General task: plan -> implement -> review
            let mut plan_task = Task::new("Plan", "Create execution plan");
            plan_task.agent_type = SubAgentType::Planner;
            let plan_id = plan_task.id.clone();
            tasks.push(plan_task);

            let mut research_task = Task::new("Research", "Gather necessary information");
            research_task.agent_type = SubAgentType::Researcher;
            research_task.dependencies.push(plan_id.clone());
            let research_id = research_task.id.clone();
            tasks.push(research_task);

            let mut implement_task = Task::new("Implement", "Implement the solution");
            implement_task.agent_type = SubAgentType::Coder;
            implement_task.dependencies.push(research_id.clone());
            let implement_id = implement_task.id.clone();
            tasks.push(implement_task);

            let mut review_task = Task::new("Review", "Review implementation");
            review_task.agent_type = SubAgentType::Reviewer;
            review_task.dependencies.push(implement_id.clone());
            tasks.push(review_task);

            let mut test_task = Task::new("Test", "Test the implementation");
            test_task.agent_type = SubAgentType::Testing;
            test_task.dependencies.push(implement_id);
            tasks.push(test_task);
        }

        Ok(tasks)
    }

    /// Create a git workflow plan.
    pub fn create_git_plan(&self, task: &str) -> AirisResult<ExecutionPlan> {
        let mut plan = ExecutionPlan::new(task);

        let mut status = Task::new("Check Git Status", "Review current git state");
        status.agent_type = SubAgentType::Git;
        let status_id = status.id.clone();
        plan.tasks.push(status);

        let mut diff = Task::new("Review Diff", "Review code changes");
        diff.agent_type = SubAgentType::Reviewer;
        diff.dependencies.push(status_id.clone());
        let diff_id = diff.id.clone();
        plan.tasks.push(diff);

        let mut commit = Task::new("Create Commit", "Commit changes with message");
        commit.agent_type = SubAgentType::Git;
        commit.dependencies.push(diff_id);
        plan.tasks.push(commit);

        plan.status = PlanStatus::Ready;
        Ok(plan)
    }
}

impl Default for TaskPlanner {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Task Queue ────────────────────────────────────────────────────

/// Persistent task queue with priority scheduling.
pub struct TaskQueue {
    tasks: Arc<Mutex<Vec<Task>>>,
    completed: Arc<Mutex<HashSet<TaskId>>>,
    counter: AtomicU64,
}

impl TaskQueue {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(Vec::new())),
            completed: Arc::new(Mutex::new(HashSet::new())),
            counter: AtomicU64::new(0),
        }
    }

    /// Enqueue a task.
    pub async fn enqueue(&self, task: Task) -> TaskId {
        let id = task.id.clone();
        let mut tasks = self.tasks.lock().await;
        tasks.push(task);
        self.counter.fetch_add(1, Ordering::SeqCst);
        id
    }

    /// Enqueue multiple tasks.
    pub async fn enqueue_all(&self, plan: ExecutionPlan) -> Vec<TaskId> {
        let mut ids = Vec::new();
        let mut tasks = self.tasks.lock().await;
        for task in plan.tasks {
            let id = task.id.clone();
            ids.push(id);
            tasks.push(task);
        }
        self.counter.fetch_add(ids.len() as u64, Ordering::SeqCst);
        ids
    }

    /// Dequeue the highest priority ready task.
    pub async fn dequeue(&self) -> Option<Task> {
        let completed = self.completed.lock().await;
        let mut tasks = self.tasks.lock().await;

        // Find ready tasks (dependencies satisfied)
        let ready_indices: Vec<usize> = tasks
            .iter()
            .enumerate()
            .filter(|(_, t)| {
                t.status == TaskStatus::Pending
                    || t.status == TaskStatus::Ready
                    || matches!(t.status, TaskStatus::Retrying { .. })
            })
            .filter(|(_, t)| t.dependencies_satisfied(&completed))
            .map(|(i, _)| i)
            .collect();

        if ready_indices.is_empty() {
            return None;
        }

        // Pick highest priority (lowest numeric value = highest priority)
        let best_idx = ready_indices
            .into_iter()
            .min_by_key(|&i| {
                let t = &tasks[i];
                (t.priority as u8, t.created_at)
            })?;

        let mut task = tasks.remove(best_idx);
        task.status = TaskStatus::Running;
        task.started_at = Some(Utc::now());
        Some(task)
    }

    /// Mark a task as completed.
    pub async fn complete(&self, id: &TaskId, output: serde_json::Value) -> AirisResult<()> {
        let mut tasks = self.tasks.lock().await;
        if let Some(task) = tasks.iter_mut().find(|t| t.id == *id) {
            task.status = TaskStatus::Completed;
            task.output = Some(output);
            task.completed_at = Some(Utc::now());
            task.progress = 1.0;
        }
        self.completed.lock().await.insert(id.clone());
        self.counter.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    /// Mark a task as failed with retry logic.
    pub async fn fail(&self, id: &TaskId, error: String) -> AirisResult<()> {
        let mut tasks = self.tasks.lock().await;
        if let Some(task) = tasks.iter_mut().find(|t| t.id == *id) {
            task.retry_count += 1;
            if task.retry_count < task.max_retries {
                task.status = TaskStatus::Retrying {
                    attempt: task.retry_count,
                    max_attempts: task.max_retries,
                };
                task.error = Some(format!("Attempt {} failed: {}", task.retry_count, error));
            } else {
                task.status = TaskStatus::Failed(error.clone());
                task.error = Some(error);
            }
        }
        self.counter.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    /// Cancel a task and all its dependents.
    pub async fn cancel(&self, id: &TaskId) -> AirisResult<()> {
        let mut tasks = self.tasks.lock().await;

        // Find all dependents recursively
        let mut to_cancel = vec![id.clone()];
        let mut idx = 0;
        while idx < to_cancel.len() {
            let current = &to_cancel[idx];
            let deps: Vec<TaskId> = tasks
                .iter()
                .filter(|t| t.dependencies.contains(current))
                .map(|t| t.id.clone())
                .collect();
            to_cancel.extend(deps);
            idx += 1;
        }

        for task in tasks.iter_mut() {
            if to_cancel.contains(&task.id) {
                if !task.is_terminal() {
                    task.status = TaskStatus::Cancelled;
                }
            }
        }

        self.counter.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    /// Get all pending tasks (for display).
    pub async fn pending_tasks(&self) -> Vec<Task> {
        let tasks = self.tasks.lock().await;
        tasks
            .iter()
            .filter(|t| !t.is_terminal())
            .cloned()
            .collect()
    }

    /// Get all tasks.
    pub async fn all_tasks(&self) -> Vec<Task> {
        let tasks = self.tasks.lock().await;
        tasks.clone()
    }

    /// Get a task by ID.
    pub async fn get_task(&self, id: &TaskId) -> Option<Task> {
        let tasks = self.tasks.lock().await;
        tasks.iter().find(|t| t.id == *id).cloned()
    }

    /// Count of pending tasks.
    pub async fn pending_count(&self) -> usize {
        let tasks = self.tasks.lock().await;
        tasks.iter().filter(|t| !t.is_terminal()).count()
    }

    /// Get queue statistics.
    pub async fn stats(&self) -> TaskQueueStats {
        let tasks = self.tasks.lock().await;
        let completed = self.completed.lock().await;

        TaskQueueStats {
            total: tasks.len() + completed.len(),
            pending: tasks.iter().filter(|t| !t.is_terminal()).count(),
            running: tasks.iter().filter(|t| t.status == TaskStatus::Running).count(),
            completed: completed.len(),
            failed: tasks.iter().filter(|t| matches!(t.status, TaskStatus::Failed(_))).count(),
            total_ops: self.counter.load(Ordering::SeqCst),
        }
    }
}

impl Default for TaskQueue {
    fn default() -> Self {
        Self::new()
    }
}

/// Task queue statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskQueueStats {
    pub total: usize,
    pub pending: usize,
    pub running: usize,
    pub completed: usize,
    pub failed: usize,
    pub total_ops: u64,
}

// ─── Sub-Agent Types ──────────────────────────────────────────────

/// Specialized agent types for task execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SubAgentType {
    /// General coding tasks
    Coder,
    /// Code review and quality analysis
    Reviewer,
    /// Task decomposition and planning
    Planner,
    /// Research and information gathering
    Researcher,
    /// Debugging and root cause analysis
    Debugger,
    /// Security vulnerability scanning
    Security,
    /// Documentation generation
    Documentation,
    /// Test writing and execution
    Testing,
    /// Code refactoring
    Refactoring,
    /// Git operations
    Git,
    /// Custom user-defined agent
    Custom(String),
}

impl SubAgentType {
    pub fn name(&self) -> &str {
        match self {
            Self::Coder => "Coder",
            Self::Reviewer => "Reviewer",
            Self::Planner => "Planner",
            Self::Researcher => "Researcher",
            Self::Debugger => "Debugger",
            Self::Security => "Security",
            Self::Documentation => "Documentation",
            Self::Testing => "Testing",
            Self::Refactoring => "Refactoring",
            Self::Git => "Git",
            Self::Custom(name) => name.as_str(),
        }
    }

    pub fn description(&self) -> &str {
        match self {
            Self::Coder => "Handles code implementation and modification",
            Self::Reviewer => "Reviews code for quality, correctness, and style",
            Self::Planner => "Breaks down complex tasks into actionable steps",
            Self::Researcher => "Searches codebase and resources for information",
            Self::Debugger => "Diagnoses and debugs software issues",
            Self::Security => "Analyzes code for security vulnerabilities",
            Self::Documentation => "Generates and updates documentation",
            Self::Testing => "Writes and runs tests",
            Self::Refactoring => "Restructures code without changing behavior",
            Self::Git => "Handles git operations and version control",
            Self::Custom(_) => "User-defined agent type",
        }
    }

    pub fn system_prompt(&self) -> &str {
        match self {
            Self::Coder => "You are an expert software engineer. Write clean, efficient, well-documented code.",
            Self::Reviewer => "You are a meticulous code reviewer. Focus on correctness, security, performance, and style.",
            Self::Planner => "You are a strategic planner. Break down complex goals into clear, actionable steps.",
            Self::Researcher => "You are a thorough researcher. Search deeply and provide comprehensive findings.",
            Self::Debugger => "You are an expert debugger. Systematically identify root causes of issues.",
            Self::Security => "You are a security expert. Identify vulnerabilities and recommend fixes.",
            Self::Documentation => "You are a technical writer. Create clear, comprehensive documentation.",
            Self::Testing => "You are a QA engineer. Write thorough tests and verify correctness.",
            Self::Refactoring => "You are a code architect. Improve code structure without changing behavior.",
            Self::Git => "You are a version control expert. Manage git workflow efficiently.",
            Self::Custom(_) => "You are an AI assistant. Complete the assigned task effectively.",
        }
    }

    pub fn all() -> Vec<Self> {
        vec![
            Self::Coder,
            Self::Reviewer,
            Self::Planner,
            Self::Researcher,
            Self::Debugger,
            Self::Security,
            Self::Documentation,
            Self::Testing,
            Self::Refactoring,
            Self::Git,
        ]
    }
}

impl std::fmt::Display for SubAgentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

// ─── Workspace Memory ─────────────────────────────────────────────

/// Persistent workspace memory for cross-session knowledge.
pub struct WorkspaceMemory {
    entries: Arc<Mutex<Vec<MemoryEntry>>>,
    max_entries: usize,
}

impl WorkspaceMemory {
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: Arc::new(Mutex::new(Vec::new())),
            max_entries,
        }
    }

    /// Store a memory entry.
    pub async fn store(&self, key: String, content: String, importance: f64) {
        let mut entries = self.entries.lock().await;
        if entries.len() >= self.max_entries {
            // Evict lowest importance entry
            if let Some(min_idx) = entries
                .iter()
                .enumerate()
                .min_by(|(_, a), (_, b)| a.importance.partial_cmp(&b.importance).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(i, _)| i)
            {
                entries.remove(min_idx);
            }
        }

        entries.push(MemoryEntry {
            id: uuid::Uuid::new_v4(),
            key,
            content,
            entry_type: MemoryType::Semantic,
            importance,
            timestamp: Utc::now(),
            expires_at: Some(Utc::now() + chrono::Duration::days(30)),
            embedding: None,
            metadata: HashMap::new(),
        });
    }

    /// Retrieve memory by key.
    pub async fn recall(&self, query: &str) -> Vec<MemoryEntry> {
        let entries = self.entries.lock().await;
        let query_lower = query.to_lowercase();

        entries
            .iter()
            .filter(|e| {
                e.key.to_lowercase().contains(&query_lower)
                    || e.content.to_lowercase().contains(&query_lower)
            })
            .cloned()
            .collect()
    }

    /// Get all entries.
    pub async fn all(&self) -> Vec<MemoryEntry> {
        let entries = self.entries.lock().await;
        entries.clone()
    }

    /// Clear workspace memory.
    pub async fn clear(&self) {
        let mut entries = self.entries.lock().await;
        entries.clear();
    }

    /// Number of entries.
    pub async fn len(&self) -> usize {
        let entries = self.entries.lock().await;
        entries.len()
    }
}

// ─── Context Compressor ───────────────────────────────────────────

/// Compresses conversation context to fit within token budgets.
pub struct ContextCompressor {
    max_tokens: usize,
}

impl ContextCompressor {
    pub fn new(max_tokens: usize) -> Self {
        Self { max_tokens }
    }

    /// Compress a conversation by summarizing oldest messages.
    pub fn compress(&self, conversation: &mut Conversation) {
        let mut total: usize = conversation
            .messages
            .iter()
            .map(|m| m.tokens.unwrap_or(m.text().len() / 4))
            .sum();

        while total > self.max_tokens && conversation.messages.len() > 4 {
            // Find oldest non-system message
            let remove_idx = conversation
                .messages
                .iter()
                .position(|m| m.role != MessageRole::System);

            if let Some(idx) = remove_idx {
                let removed = conversation.messages.remove(idx);
                total -= removed.tokens.unwrap_or(removed.text().len() / 4);
            } else {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_task_creation() {
        let task = Task::new("Test", "A test task");
        assert_eq!(task.name, "Test");
        assert_eq!(task.status, TaskStatus::Pending);
        assert_eq!(task.max_retries, 3);
    }

    #[tokio::test]
    async fn test_task_planner_general() {
        let planner = TaskPlanner::new();
        let plan = planner.plan("Build a new feature", "Context").unwrap();
        assert!(!plan.tasks.is_empty());
        assert_eq!(plan.status, PlanStatus::Ready);
    }

    #[tokio::test]
    async fn test_task_planner_bug_fix() {
        let planner = TaskPlanner::new();
        let plan = planner.plan("Fix the login bug", "Context").unwrap();
        assert!(!plan.tasks.is_empty());
        // Bug fix should create diagnostic tasks
        assert!(plan.tasks.iter().any(|t| t.agent_type == SubAgentType::Debugger));
    }

    #[tokio::test]
    async fn test_task_queue() {
        let queue = TaskQueue::new();
        let task = Task::new("Test", "Queue test");
        let id = task.id.clone();
        queue.enqueue(task).await;

        let dequeued = queue.dequeue().await;
        assert!(dequeued.is_some());
        assert_eq!(dequeued.unwrap().id, id);
    }

    #[tokio::test]
    async fn test_dependency_resolution() {
        let queue = TaskQueue::new();

        let task1 = Task::new("Task 1", "First");
        let id1 = task1.id.clone();

        let mut task2 = Task::new("Task 2", "Depends on 1");
        task2.dependencies.push(id1.clone());

        queue.enqueue(task1).await;
        queue.enqueue(task2).await;

        // First dequeue should get task1 (no deps)
        let first = queue.dequeue().await;
        assert!(first.is_some());
        assert_eq!(first.unwrap().name, "Task 1");

        // Task2 not yet ready - dequeue should return None
        let second = queue.dequeue().await;
        assert!(second.is_none());

        // Complete task1
        queue.complete(&id1, serde_json::json!({"result": "done"})).await.unwrap();

        // Now task2 should be ready
        let third = queue.dequeue().await;
        assert!(third.is_some());
        assert_eq!(third.unwrap().name, "Task 2");
    }

    #[tokio::test]
    async fn test_retry_logic() {
        let queue = TaskQueue::new();
        let mut task = Task::new("Retry task", "Tests retries");
        task.max_retries = 2;
        let id = task.id.clone();
        queue.enqueue(task).await;

        // Fail once
        queue.fail(&id, "Temporary error".into()).await.unwrap();

        // Should show retrying status
        let t = queue.get_task(&id).await.unwrap();
        assert!(matches!(t.status, TaskStatus::Retrying { .. }));

        // Fail again (exhausts retries)
        queue.fail(&id, "Final error".into()).await.unwrap();

        let t = queue.get_task(&id).await.unwrap();
        assert!(matches!(t.status, TaskStatus::Failed(_)));
    }

    #[tokio::test]
    async fn test_cancellation() {
        let queue = TaskQueue::new();

        let task1 = Task::new("Parent", "Root");
        let id1 = task1.id.clone();

        let mut task2 = Task::new("Child", "Depends on parent");
        task2.dependencies.push(id1.clone());

        queue.enqueue(task1).await;
        queue.enqueue(task2).await;

        queue.cancel(&id1).await.unwrap();

        let all = queue.all_tasks().await;
        assert!(all.iter().all(|t| matches!(t.status, TaskStatus::Cancelled)));
    }

    #[tokio::test]
    async fn test_workspace_memory() {
        let mem = WorkspaceMemory::new(100);
        mem.store("test_key".into(), "important info".into(), 0.8).await;

        let results = mem.recall("test_key").await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "important info");
    }

    #[test]
    fn test_sub_agent_types() {
        let all = SubAgentType::all();
        assert_eq!(all.len(), 10);
        assert!(all.iter().any(|t| t.name() == "Coder"));
        assert!(all.iter().any(|t| t.name() == "Security"));
        assert!(all.iter().any(|t| t.name() == "Documentation"));
    }
}
