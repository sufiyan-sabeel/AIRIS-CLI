/**
 * Built-in Sandbox Extension - Basic filesystem sandboxing
 *
 * Provides opt-in filesystem sandboxing for bash, read, edit, and write tools.
 * Uses config files to define deny rules for file access.
 *
 * Config files (merged, project takes precedence):
 * - ~/.airis/agent/sandbox.json (global)
 * - <cwd>/.airis/sandbox.json (project-local)
 *
 * Example .airis/sandbox.json:
 * ```json
 * {
 *   "enabled": true,
 *   "denyRead": ["~/.ssh", "~/.aws"],
 *   "denyWrite": [".env", ".env.*", "*.pem", "*.key"]
 * }
 * ```
 *
 * Usage:
 * - Loaded at startup but disabled by default
 * - `/sandbox enable` - enable sandboxing
 * - `/sandbox disable` - disable sandboxing
 * - `/sandbox status` - show current sandbox configuration
 * - `airis --sandbox` - enable sandbox at startup
 *
 * Features:
 * - No external dependencies (uses path matching only)
 * - Glob-pattern deny lists for read and write operations
 * - Intercepts tool_call events for bash, read, edit, write
 * - Configurable via JSON files with project-local overrides
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, normalize, relative, resolve } from "node:path";
import type {
	AutocompleteItem,
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	ToolCallEvent,
} from "./extensions/types.ts";
import { getAgentDir } from "../config.ts";

// ============================================================================
// Types
// ============================================================================

interface SandboxConfig {
	enabled?: boolean;
	denyRead?: string[];
	denyWrite?: string[];
	allowRead?: string[];
	allowWrite?: string[];
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_CONFIG: SandboxConfig = {
	enabled: false,
	denyRead: ["~/.ssh", "~/.aws", "~/.gnupg"],
	denyWrite: [".env", ".env.*", "*.pem", "*.key", "*.p12", "*.cert"],
	allowRead: [],
	allowWrite: [".", "/tmp"],
};

// ============================================================================
// Secret Patterns (regex-based detection)
// ============================================================================

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
	{ name: "AWS Access Key", regex: /(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}/ },
	{ name: "AWS Secret Key", regex: /(?:(?i)aws_secret_access_key|(?i)aws_secret_key)["'\s]*[:=]["'\s]*[A-Za-z0-9\/+=]{40}/ },
	{ name: "GitHub Token", regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/ },
	{ name: "GitHub Fine-Grained Token", regex: /github_pat_[A-Za-z0-9_]{82,}/ },
	{ name: "OpenAI API Key", regex: /sk-[A-Za-z0-9]{32,}/ },
	{ name: "Anthropic API Key", regex: /sk-ant-[A-Za-z0-9]{32,}/ },
	{ name: "Slack Token", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
	{ name: "Google API Key", regex: /AIza[A-Za-z0-9_\\-]{35}/ },
	{ name: "SSH Private Key", regex: /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----/ },
	{ name: "JWT Token", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
	{ name: "npm Token", regex: /npm_[A-Za-z0-9]{36,}/ },
	{ name: "Generic Secret", regex: /(?:(?i)api[_-]?key|(?i)secret|(?i)password|(?i)token)["'\s]*[:=]["'\s]*[A-Za-z0-9_\\-]{16,}/ },
];

/** Detect secrets in a string. Returns array of {name, match} for each found secret. */
export function detectSecrets(input: string): Array<{ name: string; match: string }> {
	const found: Array<{ name: string; match: string }> = [];
	for (const pattern of SECRET_PATTERNS) {
		const match = input.match(pattern.regex);
		if (match) {
			found.push({ name: pattern.name, match: match[0].slice(0, 20) + "..." });
		}
	}
	return found;
}

// ============================================================================
// Glob Matching (minimal, pattern-only)
// ============================================================================

export function globMatch(pattern: string, filePath: string): boolean {
	// Convert glob pattern to regex
	let regexStr = "^";
	let i = 0;
	while (i < pattern.length) {
		const ch = pattern[i];
		if (ch === "*") {
			// ** matches everything across segments; * matches within a path segment
			if (i + 1 < pattern.length && pattern[i + 1] === "*") {
				regexStr += ".*";
				i++; // skip next *
			} else {
				// Match within one path segment (no separator)
				regexStr += "[^/\\\\]*";
			}
		} else if (ch === "?") {
			regexStr += "[^/\\\\]";
		} else if (ch === ".") {
			regexStr += "\\.";
		} else if (ch === "\\" || ch === "/") {
			regexStr += "[/\\\\]";
		} else {
			regexStr += ch;
		}
		i++;
	}
	regexStr += "$";

	const re = (() => {
		try {
			return new RegExp(regexStr, "i");
		} catch {
			return null;
		}
	})();
	if (!re) return false;

	// Match against full path
	if (re.test(filePath)) return true;

	// Match against basename (last path segment) for filename patterns like *.pem, .env
	const lastSep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
	if (lastSep >= 0) {
		const basename = filePath.slice(lastSep + 1);
		return re.test(basename);
	}

	return false;
}

export function matchesAny(patternList: string[], filePath: string): boolean {
	return patternList.some((pattern) => globMatch(pattern, filePath));
}

/** Resolve ~ to home directory */
export function resolvePathWithTilde(filePath: string): string {
	if (filePath.startsWith("~")) {
		return join(homedir(), filePath.slice(1));
	}
	return filePath;
}

// ============================================================================
// Config Loading
// ============================================================================

export function deepMergeConfig(base: SandboxConfig, overrides: Partial<SandboxConfig>): SandboxConfig {
	const result: SandboxConfig = { ...base };

	if (overrides.enabled !== undefined) result.enabled = overrides.enabled;
	if (overrides.denyRead) result.denyRead = [...(base.denyRead ?? []), ...overrides.denyRead];
	if (overrides.denyWrite) result.denyWrite = [...(base.denyWrite ?? []), ...overrides.denyWrite];
	if (overrides.allowRead) result.allowRead = [...(base.allowRead ?? []), ...overrides.allowRead];
	if (overrides.allowWrite) result.allowWrite = [...(base.allowWrite ?? []), ...overrides.allowWrite];

	return result;
}

function loadSandboxConfig(agentDir: string, cwd: string): SandboxConfig {
	const globalConfigPath = join(agentDir, "sandbox.json");
	const projectConfigPath = join(cwd, ".airis", "sandbox.json");

	let globalConfig: Partial<SandboxConfig> = {};
	let projectConfig: Partial<SandboxConfig> = {};

	if (existsSync(globalConfigPath)) {
		try {
			globalConfig = JSON.parse(readFileSync(globalConfigPath, "utf-8")) as Partial<SandboxConfig>;
		} catch {
			// Ignore parse errors
		}
	}

	if (existsSync(projectConfigPath)) {
		try {
			projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf-8")) as Partial<SandboxConfig>;
		} catch {
			// Ignore parse errors
		}
	}

	// Merge: global → project (project takes precedence)
	const merged = deepMergeConfig(DEFAULT_CONFIG, globalConfig);
	return deepMergeConfig(merged, projectConfig);
}

// ============================================================================
// Path Checking
// ============================================================================

export function normalizeAndResolve(workingDir: string, rawPath: string): string {
	const resolved = resolvePathWithTilde(rawPath);
	if (resolved.startsWith("/") || resolved.startsWith("\\") || resolved.match(/^[A-Za-z]:[/\\]/)) {
		return normalize(resolved);
	}
	// Resolve relative paths against the working directory
	return normalize(join(workingDir, resolved));
}

export function isPathAllowed(
	filePath: string,
	operation: "read" | "write",
	config: SandboxConfig,
	workingDir: string,
): { allowed: boolean; reason?: string } {
	const normalized = normalizeAndResolve(workingDir, filePath);

	// Check allow lists first (explicit allow overrides deny)
	const allowList = operation === "read" ? (config.allowRead ?? []) : (config.allowWrite ?? []);
	if (allowList.length > 0 && matchesAny(allowList, normalized)) {
		return { allowed: true };
	}

	// Check deny lists
	const denyList = operation === "read" ? (config.denyRead ?? []) : (config.denyWrite ?? []);
	if (denyList.length > 0 && matchesAny(denyList, normalized)) {
		return {
			allowed: false,
			reason: `Access denied: ${filePath} matches sandbox ${operation}-deny pattern`,
		};
	}

	return { allowed: true };
}

// ============================================================================
// Extension
// ============================================================================

type SandboxBlockResult = { block: true; reason: string };

export default function sandboxExtension(airis: ExtensionAPI) {
	const agentDir = getAgentDir();
	const localCwd = process.cwd();

	let enabled = false;
	let config: SandboxConfig = loadSandboxConfig(agentDir, localCwd);

	// Check CLI flag
	airis.registerFlag("sandbox", {
		description: "Enable filesystem sandboxing",
		type: "boolean",
		default: false,
	});

	// Enable at startup if CLI flag is set or config says enabled
	const sandboxFlag = airis.getFlag("sandbox");
	if (sandboxFlag === true || config.enabled === true) {
		enabled = true;
	}

	// =====================================================================
	// Tool call interception
	// =====================================================================

	airis.on("tool_call", (event: ToolCallEvent, ctx: ExtensionContext) => {
		if (!enabled) return undefined;

		// Only intercept file-accessing tools
		if (event.toolName !== "bash" && event.toolName !== "read" && event.toolName !== "edit" && event.toolName !== "write") {
			return undefined;
		}

		const cwd = ctx.cwd;

		if (event.toolName === "bash") {
			const cmd = (event.input as { command?: string }).command ?? "";
			// Check for destructive commands
			const destructivePatterns = [
				/\brm\s+-rf\b/i, /\brm\s+--recursive\b/i,
				/\bchmod\b/i, /\bchown\b/i,
				/\bdd\s+if=/i, /\bmkfs\b/i, /\bformat\b/i,
				/\b>:|>>\s+.*(?:\.env|\.key|\.pem|\.p12|\.cert)\b/i,
			];
			for (const pattern of destructivePatterns) {
				if (pattern.test(cmd)) {
					const blockResult: SandboxBlockResult = { block: true, reason: `Sandbox blocked destructive command: ${cmd.slice(0, 100)}` };
					return blockResult;
				}
			}
			// Check for secrets leaked in commands
			const secrets = detectSecrets(cmd);
			if (secrets.length > 0) {
				const secretNames = secrets.map((s) => s.name).join(", ");
				const blockResult: SandboxBlockResult = {
					block: true,
					reason: `Sandbox blocked command containing potential secrets: ${secretNames}. Use environment variables instead of hardcoding credentials.`,
				};
				return blockResult;
			}
			// File-level path checking for bash commands that write to files
			const writeCmds = cmd.match(/(?:\b(?:>|>>|cat|echo|printf)\s+)([\w./\\~-]+)/gi);
			if (writeCmds) {
				for (const match of writeCmds) {
					const parts = match.split(/\s+/);
					const targetPath = parts[parts.length - 1];
					if (targetPath && !targetPath.startsWith("/dev/")) {
						const pathCheck = isPathAllowed(targetPath, "write", config, cwd);
						if (!pathCheck.allowed) {
							const blockResult: SandboxBlockResult = { block: true, reason: pathCheck.reason };
							return blockResult;
						}
					}
				}
			}
			return undefined;
		}

		if (event.toolName === "read") {
			const filePath = (event.input as { filePath?: string }).filePath ?? "";
			if (filePath) {
				const pathCheck = isPathAllowed(filePath, "read", config, cwd);
				if (!pathCheck.allowed) {
					const blockResult: SandboxBlockResult = { block: true, reason: pathCheck.reason };
					return blockResult;
				}
			}
			return undefined;
		}

		if (event.toolName === "edit") {
			const filePath = (event.input as { filePath?: string }).filePath ?? "";
			if (filePath) {
				const pathCheck = isPathAllowed(filePath, "write", config, cwd);
				if (!pathCheck.allowed) {
					const blockResult: SandboxBlockResult = { block: true, reason: pathCheck.reason };
					return blockResult;
				}
			}
			return undefined;
		}

		if (event.toolName === "write") {
			const filePath = resolvePathWithTilde((event.input as { path?: string }).path ?? "");
			if (filePath) {
				const pathCheck = isPathAllowed(
					filePath.startsWith(homedir()) ? filePath : filePath,
					"write",
					config,
					cwd,
				);
				if (!pathCheck.allowed) {
					const blockResult: SandboxBlockResult = { block: true, reason: pathCheck.reason };
					return blockResult;
				}
			}
			return undefined;
		}

		return undefined;
	});

	// =====================================================================
	// Sandbox command
	// =====================================================================

	airis.registerCommand("sandbox", {
		description: "Manage sandbox configuration",
		getArgumentCompletions: (prefix: string): AutocompleteItem[] => {
			const subcommands = ["enable", "disable", "status", "reload"];
			if (!prefix) return subcommands.map((s) => ({ label: s } as AutocompleteItem));
			return subcommands.filter((s) => s.startsWith(prefix)).map((s) => ({ label: s } as AutocompleteItem));
		},
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const parts = args.trim().split(/\s+/);
			const subcommand = parts[0]?.toLowerCase();

			switch (subcommand) {
				case "enable": {
					enabled = true;
					ctx.ui.notify("Sandbox enabled - file access restrictions active", "info");
					break;
				}
				case "disable": {
					enabled = false;
					ctx.ui.notify("Sandbox disabled", "info");
					break;
				}
				case "reload": {
					config = loadSandboxConfig(agentDir, localCwd);
					enabled = config.enabled ?? false;
					const status = enabled ? "enabled" : "disabled";
					ctx.ui.notify(`Sandbox config reloaded (${status})`, "info");
					break;
				}
				case "status":
				default: {
					const lines = [
						`Sandbox: ${enabled ? "✅ enabled" : "❌ disabled"}`,
						`Config: global=${join(agentDir, "sandbox.json")}, project=${join(localCwd, ".airis", "sandbox.json")}`,
						"",
						"Deny read:",
						...(config.denyRead?.length ? config.denyRead.map((p) => `  - ${p}`) : ["  (none)"]),
						"",
						"Deny write:",
						...(config.denyWrite?.length ? config.denyWrite.map((p) => `  - ${p}`) : ["  (none)"]),
					];
					ctx.ui.notify(lines.join("\n"), "info");
					break;
				}
			}
		},
	});
}
