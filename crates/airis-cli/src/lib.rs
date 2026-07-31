//! AIRIS-CLI command definitions and routing.

pub mod commands;

use airis_core::prelude::*;
use airis_ui::tui::TuiApp;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::info;

/// AIRIS-CLI: Next-generation AI coding assistant by KageOS.
///
/// A modular, cross-platform AI CLI with agent mode, task planning,
/// tool execution, and rich terminal UI.
#[derive(Parser, Debug)]
#[command(name = "airis")]
#[command(author = "KageOS")]
#[command(version = "0.1.0")]
#[command(about = "Next-gen AI coding assistant", long_about = None)]
#[command(propagate_version = true)]
pub struct AirisCli {
    #[command(subcommand)]
    pub command: Option<AirisCommands>,

    /// Path to config file
    #[arg(short, long, global = true)]
    pub config: Option<PathBuf>,

    /// Enable verbose output
    #[arg(short, long, global = true, default_value_t = false)]
    pub verbose: bool,

    /// Disable animations
    #[arg(long, global = true)]
    pub no_animations: bool,

    /// Model to use
    #[arg(short, long, global = true)]
    pub model: Option<String>,

    /// Provider to use
    #[arg(short = 'P', long, global = true)]
    pub provider: Option<String>,

    /// Workspace directory
    #[arg(short = 'C', long, global = true)]
    pub directory: Option<PathBuf>,
}

#[derive(Subcommand, Debug)]
pub enum AirisCommands {
    /// Start interactive chat session
    Chat {
        /// Initial message / prompt
        prompt: Option<String>,

        /// Session file to resume
        #[arg(short, long)]
        session: Option<String>,

        /// Use the TUI interface
        #[arg(short, long)]
        tui: bool,
    },

    /// Autonomous coding agent mode
    Code {
        /// Task description
        task: String,

        /// Max agent steps
        #[arg(short, long, default_value_t = 25)]
        steps: usize,
    },

    /// Fix code issues (lint errors, type errors, bugs)
    Fix {
        /// File or directory to fix
        target: Option<String>,

        /// Automatically apply fixes
        #[arg(short, long)]
        yes: bool,
    },

    /// Explain code or concept
    Explain {
        /// Code or path to explain
        target: String,

        /// Detail level (brief, normal, detailed)
        #[arg(short, long, default_value = "normal")]
        detail: String,
    },

    /// Generate a commit message from current changes
    Commit {
        /// Commit message (skip AI generation)
        message: Option<String>,

        /// Files to stage before committing
        #[arg(short, long)]
        add: Vec<String>,

        /// Automatically commit (skip confirmation)
        #[arg(short, long)]
        yes: bool,
    },

    /// Review code for issues
    Review {
        /// File or directory to review
        target: Option<String>,

        /// Review severity (all, critical, warning)
        #[arg(short, long, default_value = "all")]
        severity: String,
    },

    /// Search codebase or web
    Search {
        /// Search query
        query: String,

        /// Search codebase instead of web
        #[arg(short, long)]
        code: bool,

        /// Max results
        #[arg(short, long, default_value_t = 10)]
        limit: usize,
    },

    /// Run a shell command with AI assistance
    Run {
        /// Command to run (optional — AI can generate it)
        command: Option<String>,

        /// Let AI generate the command from description
        #[arg(short, long)]
        describe: Option<String>,
    },

    /// Diagnose and fix issues
    Doctor {
        /// Auto-fix detected issues
        #[arg(short, long)]
        fix: bool,
    },

    /// Initialize AIRIS-CLI in current directory
    Init {
        /// Force re-initialization
        #[arg(short, long)]
        force: bool,

        /// Template type
        #[arg(short, long, default_value = "default")]
        template: String,
    },

    /// Update AIRIS-CLI to latest version
    Update {
        /// Check for updates only
        #[arg(short, long)]
        check: bool,
    },

    /// View or modify configuration
    Config {
        /// Config key to get (dotted path)
        get: Option<String>,

        /// Config key=value to set
        #[arg(short, long)]
        set: Option<String>,

        /// Show entire config
        #[arg(short, long)]
        list: bool,

        /// Edit config in editor
        #[arg(short, long)]
        edit: bool,
    },

    /// View or search memory
    Memory {
        /// Query memory
        query: Option<String>,

        /// List recent memories
        #[arg(short, long)]
        list: bool,

        /// Clear memory
        #[arg(short, long)]
        clear: bool,

        /// Show memory stats
        #[arg(short, long)]
        stats: bool,

        /// Memory type filter
        #[arg(short, long)]
        memory_type: Option<String>,
    },

    /// Manage plugins
    Plugin {
        /// Plugin subcommand
        #[command(subcommand)]
        action: Option<PluginActions>,

        /// Plugin name
        name: Option<String>,
    },

    /// List available models
    Models {
        /// Provider filter
        #[arg(short, long)]
        provider: Option<String>,

        /// Refresh model cache
        #[arg(short, long)]
        refresh: bool,
    },

    /// Run benchmarks
    Benchmark {
        /// Benchmark suite (all, startup, codegen, planning)
        #[arg(default_value = "all")]
        suite: String,

        /// Warmup iterations
        #[arg(long, default_value_t = 3)]
        warmup: usize,

        /// Measure iterations
        #[arg(long, default_value_t = 10)]
        iterations: usize,
    },

    /// Index workspace for search
    Index {
        /// Path to index
        path: Option<PathBuf>,

        /// Re-index from scratch
        #[arg(short, long)]
        refresh: bool,

        /// Show index stats
        #[arg(short, long)]
        stats: bool,
    },

    /// Plan a task
    Plan {
        /// Task description
        task: String,

        /// Output plan to file
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Execute the plan
        #[arg(short, long)]
        execute: bool,
    },

    /// Run a task from a plan
    Task {
        /// Plan file or task description
        input: String,
    },

    /// Build and compile code
    Build {
        /// Build command (e.g., cargo build, npm run build)
        command: Option<String>,

        /// Watch mode
        #[arg(short, long)]
        watch: bool,
    },
}

#[derive(Subcommand, Debug)]
pub enum PluginActions {
    /// Install a plugin
    Install { source: String },
    /// Remove a plugin
    Remove { name: String },
    /// List installed plugins
    List,
    /// Enable a plugin
    Enable { name: String },
    /// Disable a plugin
    Disable { name: String },
}

impl AirisCli {
    /// Run the appropriate command based on parsed arguments.
    pub async fn run(&self) -> AirisResult<()> {
        let command = self.command.as_ref().ok_or_else(|| {
            AirisError::Custom("No command specified. Use `airis chat` or `airis --help` for usage.".into())
        })?;

        // Initialize core systems
        let config = airis_config::ConfigManager::new().await?;
        let registry = airis_models::ModelRegistryImpl::new();
        let workspace = airis_workspace::WorkspaceManagerImpl::new();
        let agent = airis_agent::AgentImpl::new();
        let tool_registry = airis_tools::ToolRegistryImpl::new();
        let git = airis_git::GitImpl::new();
        let editor = airis_editor::EditorImpl::new();
        let terminal = airis_terminal::TerminalImpl::new();
        let memory = airis_memory::MemoryStoreImpl::new().await?;
        let indexer = airis_indexer::IndexerImpl::new();
        let lsp = airis_lsp::LspClientImpl::new();
        let plugin_loader = airis_plugins::PluginLoaderImpl::new();
        let mcp = airis_mcp::McpManagerImpl::new();
        let telemetry = airis_telemetry::TelemetryImpl::new();
        let cache = airis_cache::CacheLayer::new().await?;

        match command {
            AirisCommands::Chat { prompt, session, tui } => {
                commands::chat::execute(prompt, session, *tui, &config, &agent, &tool_registry).await
            }
            AirisCommands::Code { task, steps } => {
                commands::code::execute(task, *steps, &config, &agent, &tool_registry, &workspace).await
            }
            AirisCommands::Fix { target, yes } => {
                commands::fix::execute(target, *yes, &config, &agent, &tool_registry).await
            }
            AirisCommands::Explain { target, detail } => {
                commands::explain::execute(target, detail, &config, &agent).await
            }
            AirisCommands::Commit { message, add, yes } => {
                commands::commit::execute(message, add, *yes, &config, &agent, &git).await
            }
            AirisCommands::Review { target, severity } => {
                commands::review::execute(target, severity, &config, &agent, &workspace, &indexer).await
            }
            AirisCommands::Search { query, code, limit } => {
                commands::search::execute(query, *code, *limit, &config, &indexer).await
            }
            AirisCommands::Run { command, describe } => {
                commands::run::execute(command, describe, &config, &agent, &terminal).await
            }
            AirisCommands::Doctor { fix } => {
                commands::doctor::execute(*fix, &config, &tool_registry, &terminal).await
            }
            AirisCommands::Init { force, template } => {
                commands::init::execute(*force, template, &config).await
            }
            AirisCommands::Update { check } => {
                commands::update::execute(*check).await
            }
            AirisCommands::Config { get, set, list, edit } => {
                commands::config::execute(get, set, *list, *edit, &config).await
            }
            AirisCommands::Memory { query, list, clear, stats, memory_type } => {
                commands::memory::execute(query, *list, *clear, *stats, memory_type, &memory).await
            }
            AirisCommands::Plugin { action, name: _ } => {
                commands::plugin::execute(action, &plugin_loader).await
            }
            AirisCommands::Models { provider, refresh } => {
                commands::models::execute(provider, *refresh, &registry).await
            }
            AirisCommands::Benchmark { suite, warmup, iterations } => {
                commands::benchmark::execute(suite, *warmup, *iterations).await
            }
            AirisCommands::Index { path, refresh, stats } => {
                commands::index::execute(path, *refresh, *stats, &indexer, &workspace).await
            }
            AirisCommands::Plan { task, output, execute } => {
                commands::plan::execute(task, output, *execute, &config, &agent, &workspace).await
            }
            AirisCommands::Task { input } => {
                commands::task::execute(input, &config, &agent, &tool_registry, &workspace).await
            }
            AirisCommands::Build { command, watch } => {
                commands::build::execute(command, *watch, &config, &terminal).await
            }
        }
    }
}
