import { APP_NAME } from "../config.ts";
import type { SourceInfo } from "./source-info.ts";

export type SlashCommandSource = "extension" | "prompt" | "skill";

export interface SlashCommandInfo {
	name: string;
	description?: string;
	source: SlashCommandSource;
	sourceInfo: SourceInfo;
}

export interface BuiltinSlashCommand {
	name: string;
	description: string;
	argumentHint?: string;
}

export const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand> = [
	{ name: "settings", description: "Open settings menu" },
	{ name: "model", description: "Select model (opens selector UI)", argumentHint: "<provider/model>" },
	{ name: "scoped-models", description: "Enable/disable models for Ctrl+P cycling" },
	{ name: "export", description: "Export session (HTML default, or specify path: .html/.jsonl)" },
	{ name: "import", description: "Import and resume a session from a JSONL file" },
	{ name: "share", description: "Share session as a secret GitHub gist" },
	{ name: "copy", description: "Copy last agent message to clipboard" },
	{ name: "name", description: "Set session display name" },
	{ name: "session", description: "Show session info and stats" },
	{ name: "cache-report", description: "Show cache statistics and waste report" },
	{ name: "changelog", description: "Show changelog entries" },
	{ name: "hotkeys", description: "Show all keyboard shortcuts" },
	{ name: "doctor", description: "Inspect project health, including Go and R support" },
	{ name: "fork", description: "Create a new fork from a previous user message" },
	{ name: "clone", description: "Duplicate the current session at the current position" },
	{ name: "tree", description: "Navigate session tree (switch branches)" },
	{ name: "trust", description: "Save project trust decision for future sessions" },
	{ name: "login", description: "Configure provider authentication", argumentHint: "<provider>" },
	{ name: "logout", description: "Remove provider authentication" },
	{ name: "new", description: "Start a new session" },
	{ name: "compact", description: "Manually compact the session context" },
	{ name: "resume", description: "Resume a different session" },
	{ name: "reload", description: "Reload keybindings, extensions, skills, prompts, and themes" },
	{ name: "quit", description: `Quit ${APP_NAME}` },
	// New adaptive brain commands
	{ name: "help", description: "Show help and available commands" },
	{ name: "hooks", description: "View hook configurations for tool events" },
	{ name: "audit", description: "Audit log: status, export, clear" },
	{ name: "ide", description: "Manage IDE integrations and show status" },
	{ name: "keybindings", description: "Open your keyboard shortcuts file" },
	{ name: "brain", description: "Show adaptive brain status and TODO list" },
	{ name: "project", description: "Show project profile and learned patterns" },
	{ name: "stats", description: "Show session statistics and performance" },
	{ name: "tools", description: "Show tool execution statistics" },
	{ name: "plan", description: "Enable plan mode or view the current plan" },
	{ name: "plugin", description: "Manage extensions and plugins" },
	{ name: "powerup", description: "Discover features through quick tips" },
	{ name: "recap", description: "Generate a one-line session recap" },
	{ name: "release-notes", description: "View release notes" },
	{ name: "reload-extensions", description: "Activate pending extension changes" },
	{ name: "reload-skills", description: "Pick up skills added or changed on disk" },
	{ name: "search", description: "Search past conversations by query" },
	{ name: "rename", description: "Rename the current conversation" },
	{ name: "rewind", description: "Restore code and/or conversation to a previous point" },
	{ name: "sandbox", description: "Sandbox configuration status" },
	{ name: "skills", description: "List available skills" },
	{ name: "status", description: "Show status including version, model, and features" },
	{ name: "stickers", description: "Get a fun surprise" },
	{ name: "tasks", description: "View and manage background tasks" },
	{ name: "health", description: "Run system health checks" },
	{ name: "diagnostics", description: "Show system diagnostics and configuration" },
	{ name: "security", description: "Run security audit and configuration checks" },
	{ name: "deps-audit", description: "Audit project dependencies for version safety" },
	{ name: "provider-health", description: "Show provider health scores and call history" },
	{ name: "models", description: "List available models and provider mappings" },
];
