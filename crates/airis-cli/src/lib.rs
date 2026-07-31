//! AIRIS-CLI command definitions and routing.

pub mod commands;

use airis_core::prelude::*;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::sync::Arc;
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

    /// Interactive premium installer with wizard
    Install {
        /// Install directory (skip interactive prompts)
        #[arg(short, long)]
        dir: Option<PathBuf>,

        /// Non-interactive mode
        #[arg(short, long)]
        yes: bool,
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

/// CommandContext carries subsystem references to all command modules.
pub struct CommandContext {
    pub config: airis_config::ConfigManager,
    pub registry: Arc<dyn ModelRegistry>,
    pub agent: Arc<airis_agent::AgentImpl>,
    pub runner: airis_agent::AgentRunner,
    pub workspace: Arc<dyn WorkspaceManager>,
    pub tools: Arc<dyn ToolRegistry>,
    pub git: Arc<dyn GitOps>,
    pub editor: Arc<dyn Editor>,
    pub terminal: Arc<dyn Terminal>,
    pub memory: Arc<dyn MemoryStore>,
    pub indexer: Arc<dyn Indexer>,
    pub lsp: Arc<dyn LspClient>,
    pub plugin_loader: Arc<dyn PluginLoader>,
    pub mcp: Arc<dyn McpManager>,
    pub telemetry: Arc<dyn Telemetry>,
    pub cache: Arc<dyn CacheStore>,
}

impl AirisCli {
    /// Run the appropriate command based on parsed arguments.
    pub async fn run(&self) -> AirisResult<()> {
        let command = self.command.as_ref().ok_or_else(|| {
            AirisError::Custom(
                "No command specified. Use `airis chat` or `airis --help` for usage.".into(),
            )
        })?;

        // Initialize core systems
        let config = airis_config::ConfigManager::new().await?;

        // Create subsystem instances (order: workspace first so tools can depend on them)
        let workspace =
            Arc::new(airis_workspace::WorkspaceManagerImpl::new()) as Arc<dyn WorkspaceManager>;
        let editor = Arc::new(airis_editor::EditorImpl::new()) as Arc<dyn Editor>;
        let terminal = Arc::new(airis_terminal::TerminalImpl::new()) as Arc<dyn Terminal>;
        let git = Arc::new(airis_git::GitImpl::new()) as Arc<dyn GitOps>;
        let memory =
            Arc::new(airis_memory::MemoryStoreImpl::new().await?) as Arc<dyn MemoryStore>;
        let indexer = Arc::new(airis_indexer::IndexerImpl::new()) as Arc<dyn Indexer>;
        let lsp = Arc::new(airis_lsp::LspClientImpl::new()) as Arc<dyn LspClient>;
        let plugin_loader =
            Arc::new(airis_plugins::PluginLoaderImpl::new()) as Arc<dyn PluginLoader>;
        let mcp = Arc::new(airis_mcp::McpManagerImpl::new()) as Arc<dyn McpManager>;
        let telemetry = Arc::new(airis_telemetry::TelemetryImpl::new()) as Arc<dyn Telemetry>;
        let cache = Arc::new(airis_cache::CacheLayer::new().await?) as Arc<dyn CacheStore>;

        // Initialize model registry with provider instances
        let registry =
            Arc::new(airis_models::ModelRegistryImpl::new()) as Arc<dyn ModelRegistry>;

        // Create tool registry and register built-in tools
        let tool_registry_impl = airis_tools::ToolRegistryImpl::new();
        tool_registry_impl.register_defaults(&workspace, &editor, &terminal, &git);
        let tools: Arc<dyn ToolRegistry> = Arc::new(tool_registry_impl);

        // Create agent wired with registry, tools, and memory
        let agent = Arc::new(
            airis_agent::AgentImpl::new()
                .with_registry(registry.clone())
                .with_tools(tools.clone())
                .with_memory(memory.clone()),
        );

        // Create high-level agent runner (wires agent + registry + tools)
        let runner = airis_agent::AgentRunner::new(agent.clone(), registry.clone(), tools.clone());

        // Build shared context
        let ctx = CommandContext {
            config,
            registry,
            agent,
            runner,
            workspace,
            tools,
            git,
            editor,
            terminal,
            memory,
            indexer,
            lsp,
            plugin_loader,
            mcp,
            telemetry,
            cache,
        };

        match command {
            AirisCommands::Chat {
                prompt,
                session,
                tui,
            } => commands::chat::execute(prompt, session, *tui, &ctx).await,
            AirisCommands::Code { task, steps } => {
                commands::code::execute(task, *steps, &ctx).await
            }
            AirisCommands::Fix { target, yes } => {
                commands::fix::execute(target, *yes, &ctx).await
            }
            AirisCommands::Explain { target, detail } => {
                commands::explain::execute(target, detail, &ctx).await
            }
            AirisCommands::Commit {
                message,
                add,
                yes,
            } => commands::commit::execute(message, add, *yes, &ctx).await,
            AirisCommands::Review {
                target,
                severity,
            } => commands::review::execute(target, severity, &ctx).await,
            AirisCommands::Search { query, code, limit } => {
                commands::search::execute(query, *code, *limit, &ctx).await
            }
            AirisCommands::Run {
                command,
                describe,
            } => commands::run::execute(command, describe, &ctx).await,
            AirisCommands::Doctor { fix } => commands::doctor::execute(*fix, &ctx).await,
            AirisCommands::Init { force, template } => {
                commands::init::execute(*force, template, &ctx).await
            }
            AirisCommands::Update { check } => commands::update::execute(*check, &ctx).await,
            AirisCommands::Config {
                get,
                set,
                list,
                edit,
            } => commands::config::execute(get, set, *list, *edit, &ctx).await,
            AirisCommands::Memory {
                query,
                list,
                clear,
                stats,
                memory_type,
            } => commands::memory::execute(query, *list, *clear, *stats, memory_type, &ctx).await,
            AirisCommands::Plugin { action, name: _ } => {
                commands::plugin::execute(action, &ctx).await
            }
            AirisCommands::Models {
                provider,
                refresh,
            } => commands::models::execute(provider, *refresh, &ctx).await,
            AirisCommands::Benchmark {
                suite,
                warmup,
                iterations,
            } => commands::benchmark::execute(suite, *warmup, *iterations, &ctx).await,
            AirisCommands::Index {
                path,
                refresh,
                stats,
            } => commands::index::execute(path, *refresh, *stats, &ctx).await,
            AirisCommands::Plan {
                task,
                output,
                execute,
            } => commands::plan::execute(task, output, *execute, &ctx).await,
            AirisCommands::Task { input } => commands::task::execute(input, &ctx).await,
            AirisCommands::Build { command, watch } => {
                commands::build::execute(command, *watch, &ctx).await
            }
            AirisCommands::Install { .. } => {
                commands::install::execute(&ctx).await
            }
        }
    }
}
