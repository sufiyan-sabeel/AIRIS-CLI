import { accessSync, constants, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import chalk from "chalk";
import { handleAutomationCommand } from "../automation/androidAutomationCli.ts";
import {
	APP_NAME,
	CONFIG_DIR_NAME,
	detectInstallMethod,
	ENV_AGENT_DIR,
	ENV_SESSION_DIR,
	getAgentDir,
	getAuthPath,
	getChangelogPath,
	getPackageDir,
	getSettingsPath,
	getUpdateInstruction,
	PACKAGE_NAME,
	VERSION,
} from "../config.ts";
import { getAirisLogPath, getErrorsLogPath, getSessionsLogPath, logSessionEvent } from "../core/cli-logs.ts";
import { type SessionInfo, SessionManager } from "../core/session-manager.ts";
import { type DefaultProjectTrust, SettingsManager } from "../core/settings-manager.ts";
import { ProjectTrustStore } from "../core/trust-manager.ts";
import { handleVerifiedAutonomyCommand } from "../core/verified-autonomy/cli.ts";
import { getAvailableThemesWithPaths, getThemeByName } from "../modes/interactive/theme/theme.ts";
import { parseChangelog } from "../utils/changelog.ts";
import { spawnProcessSync } from "../utils/child-process.ts";
import { handleImageCommand, printImageHelp } from "../vision/image-command.ts";
import { printHelp } from "./args.ts";
import { box, keyValue, section, status } from "./ui.ts";

const READ_ONLY_TOOLS = new Set(["read", "grep", "find", "ls"]);
const TRUST_REQUIRED_TOOLS = new Set(["bash", "edit", "write"]);
const TOOL_NAMES = [
	"aider",
	"opencode",
	"kilo",
	"codex",
	"kiro-cli",
	"cline",
	"gemini",
	"qwen",
	"goose",
	"node",
	"npm",
	"git",
	"python",
] as const;
const API_KEY_ENV_NAMES = [
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_OAUTH_TOKEN",
	"OPENAI_API_KEY",
	"GEMINI_API_KEY",
	"GROQ_API_KEY",
	"MISTRAL_API_KEY",
	"DEEPSEEK_API_KEY",
	"OPENROUTER_API_KEY",
	"AI_GATEWAY_API_KEY",
	"OPENCODE_API_KEY",
	"AWS_ACCESS_KEY_ID",
	"AWS_BEARER_TOKEN_BEDROCK",
	"AZURE_OPENAI_API_KEY",
] as const;

interface ToolStatus {
	name: string;
	installed: boolean;
	path?: string;
	version?: string;
	error?: string;
}

interface CheckResult {
	name: string;
	status: "ok" | "warn" | "fail";
	detail: string;
	fix?: string;
}

export function normalizeAirisCommandAliases(args: string[]): string[] {
	if (args[0] === "session" && args[1] === "resume") {
		if (args[2] && !args[2].startsWith("-")) {
			return ["--session", args[2], ...args.slice(3)];
		}
		return ["--resume", ...args.slice(2)];
	}
	return args;
}

export function commandNeedsProjectTrustForMutation(args: readonly string[]): boolean {
	if (args.includes("--help") || args.includes("-h") || args.includes("--version") || args.includes("-v")) {
		return false;
	}
	if (args.includes("--list-models")) {
		return false;
	}
	if (
		args.includes("--no-tools") ||
		args.includes("-nt") ||
		args.includes("--no-builtin-tools") ||
		args.includes("-nbt")
	) {
		return false;
	}
	const toolsValue = getOptionValue(args, "--tools", "-t");
	if (toolsValue !== undefined) {
		const value = toolsValue;
		if (!value) return false;
		const tools = value
			.split(",")
			.map((tool) => tool.trim())
			.filter((tool) => tool.length > 0);
		return tools.some((tool) => TRUST_REQUIRED_TOOLS.has(tool));
	}
	const excludeToolsValue = getOptionValue(args, "--exclude-tools", "-xt");
	if (excludeToolsValue !== undefined) {
		const value = excludeToolsValue;
		const excluded = new Set(
			value
				.split(",")
				.map((tool) => tool.trim())
				.filter((tool) => tool.length > 0),
		);
		return Array.from(TRUST_REQUIRED_TOOLS).some((tool) => !excluded.has(tool));
	}
	return true;
}

function getOptionValue(args: readonly string[], longName: string, shortName: string): string | undefined {
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg.startsWith(`${longName}=`)) {
			return arg.slice(longName.length + 1);
		}
		if (arg === longName || arg === shortName) {
			return args[index + 1] ?? "";
		}
	}
	return undefined;
}

function hasHelp(args: readonly string[]): boolean {
	return args.includes("--help") || args.includes("-h");
}

function header(title: string): void {
	console.log(section(title));
}

function printCommandHelp(command?: string): void {
	switch (command) {
		case "doctor":
			console.log(`Usage: ${APP_NAME} doctor\n\nCheck local AIRIS runtime health and print fix suggestions.`);
			return;
		case "automation":
		case "droid":
			console.log(
				`Usage:\n  ${APP_NAME} droid open settings\n  ${APP_NAME} droid read screen\n  ${APP_NAME} automation tap 360 800\n\nRun Android automation through the local ADB bridge.`,
			);
			return;
		case "tools":
			console.log(
				`Usage:\n  ${APP_NAME} tools list\n  ${APP_NAME} tools doctor\n\nDetect companion CLI tools and print paths and versions.`,
			);
			return;
		case "config":
			console.log(
				`Usage:\n  ${APP_NAME} config show\n  ${APP_NAME} config get <key>\n  ${APP_NAME} config set <key> <value>\n  ${APP_NAME} config path\n\nKeys: provider, defaultModel, theme, editor, safeMode, telemetry, projectTrust, sessionPath`,
			);
			return;
		case "session":
			console.log(
				`Usage:\n  ${APP_NAME} session list [--all]\n  ${APP_NAME} session resume <id>\n  ${APP_NAME} session current\n  ${APP_NAME} session clear [--all] [--yes]`,
			);
			return;
		case "trust":
			console.log(
				`Usage:\n  ${APP_NAME} trust\n  ${APP_NAME} trust list\n  ${APP_NAME} trust revoke <path>\n\nTrust controls whether AIRIS can use project-local resources and mutation tools.`,
			);
			return;
		case "theme":
			console.log(
				`Usage:\n  ${APP_NAME} theme list\n  ${APP_NAME} theme set graphite\n  ${APP_NAME} theme preview [name]\n\nRecommended themes: graphite, minimal, amoled, classic, amber`,
			);
			return;
		case "version":
			console.log(`Usage: ${APP_NAME} version`);
			return;
		case "changelog":
			console.log(`Usage: ${APP_NAME} changelog`);
			return;
		case "mission":
			console.log(
				`Usage:\n  ${APP_NAME} mission "<request>" --verified\n  ${APP_NAME} mission create "<request>"\n  ${APP_NAME} mission approve <id>\n  ${APP_NAME} mission run <id>\n  ${APP_NAME} mission status <id>`,
			);
			return;
		case "evidence":
			console.log(`Usage: ${APP_NAME} evidence show <mission-id>`);
			return;
		case "lease":
			console.log(`Usage:\n  ${APP_NAME} lease list\n  ${APP_NAME} lease revoke <id>`);
			return;
		case "failures":
			console.log(`Usage: ${APP_NAME} failures search "<error>"`);
			return;
		case "image":
			printImageHelp();
			return;
		default:
			printHelp();
	}
}

export async function handleAirisCommand(args: string[]): Promise<boolean> {
	const command = args[0];
	if (!command) return false;

	if (command === "help") {
		printCommandHelp(args[1]);
		return true;
	}

	if (hasHelp(args)) {
		if (
			[
				"doctor",
				"automation",
				"droid",
				"tools",
				"config",
				"session",
				"trust",
				"theme",
				"version",
				"changelog",
				"mission",
				"evidence",
				"lease",
				"failures",
				"ship",
				"image",
			].includes(command)
		) {
			printCommandHelp(command);
			return true;
		}
	}

	if (await handleAutomationCommand(args)) {
		return true;
	}

	if (await handleImageCommand(args)) {
		return true;
	}

	switch (command) {
		case "version":
			printVersion();
			return true;
		case "doctor":
			runDoctor();
			return true;
		case "tools":
			handleToolsCommand(args.slice(1));
			return true;
		case "config":
			if (!args[1]) return false;
			await handleConfigSubcommand(args.slice(1));
			return true;
		case "session":
			await handleSessionCommand(args.slice(1));
			return true;
		case "trust":
			handleTrustCommand(args.slice(1));
			return true;
		case "theme":
			await handleThemeCommand(args.slice(1));
			return true;
		case "changelog":
			printChangelog();
			return true;
		case "mission":
		case "evidence":
		case "lease":
		case "failures":
			await handleVerifiedAutonomyCommand(args);
			return true;
		default:
			return false;
	}
}

function printVersion(): void {
	console.log(
		box("AIRIS", [
			keyValue("Version", VERSION),
			keyValue("System", "Artificial Intelligence Responsive Integrated System"),
			keyValue("Brand", "KageOS"),
			keyValue("Creator", "Umaiz Sufiyan"),
			keyValue("Package", PACKAGE_NAME),
		]),
	);
}

function findExecutable(name: string): string | undefined {
	const pathValue = process.env.PATH ?? "";
	const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
	for (const dir of pathValue.split(delimiter)) {
		if (!dir) continue;
		for (const ext of extensions) {
			const candidate = join(dir, process.platform === "win32" ? `${name}${ext}` : name);
			try {
				accessSync(candidate, constants.X_OK);
				return candidate;
			} catch {
				// Try next candidate.
			}
		}
	}
	return undefined;
}

function getVersion(path: string, args: string[] = ["--version"]): string | undefined {
	const result = spawnProcessSync(path, args, {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 3000,
	});
	if (result.status !== 0 && !result.stdout && !result.stderr) return undefined;
	return (result.stdout || result.stderr).split("\n")[0]?.trim() || undefined;
}

function detectTool(name: string): ToolStatus {
	const executableName = name === "python" ? (findExecutable("python") ? "python" : "python3") : name;
	const path = findExecutable(executableName);
	if (!path) return { name, installed: false };
	return {
		name,
		installed: true,
		path,
		version: getVersion(path),
	};
}

function detectTools(): ToolStatus[] {
	return TOOL_NAMES.map((name) => detectTool(name));
}

function printToolTable(tools: readonly ToolStatus[]): void {
	console.log(`${chalk.dim("Tool".padEnd(12))}${chalk.dim("Status".padEnd(12))}${chalk.dim("Location / Version")}`);
	for (const tool of tools) {
		const marker = tool.installed ? chalk.green("installed") : chalk.yellow("missing");
		const path = tool.path ? chalk.dim(tool.path) : chalk.dim("not found in PATH");
		const version = tool.version ? ` ${chalk.dim(tool.version)}` : "";
		console.log(`${tool.name.padEnd(12)}${marker.padEnd(21)}${path}${version}`);
	}
}

function handleToolsCommand(args: string[]): void {
	const subcommand = args[0] ?? "list";
	if (subcommand !== "list" && subcommand !== "doctor") {
		console.error(status("error", `Unknown tools command: ${subcommand}`));
		console.error(status("info", `Run ${APP_NAME} tools --help`));
		process.exitCode = 1;
		return;
	}
	header(subcommand === "doctor" ? "AIRIS Tool Doctor" : "AIRIS Tools");
	printToolTable(detectTools());
	if (subcommand === "doctor") {
		console.log();
		console.log(chalk.dim("Missing optional AI tools are not fatal. Install only the integrations you use."));
	}
}

function readStoredAuthProviderCount(): number {
	const authPath = getAuthPath();
	if (!existsSync(authPath)) return 0;
	try {
		const parsed = JSON.parse(readFileSync(authPath, "utf-8")) as Record<string, unknown>;
		return Object.keys(parsed).length;
	} catch {
		return 0;
	}
}

function checkWritableDirectory(path: string): boolean {
	try {
		mkdirSync(path, { recursive: true });
		accessSync(path, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

function runDoctor(): void {
	const agentDir = getAgentDir();
	const settingsManager = SettingsManager.create(process.cwd(), agentDir, { projectTrusted: false });
	const sessionDir = settingsManager.getSessionDir() ?? join(agentDir, "sessions");
	const logsDir = dirname(getAirisLogPath());
	const tools = detectTools();
	const toolByName = new Map(tools.map((tool) => [tool.name, tool]));
	const envKeys = API_KEY_ENV_NAMES.filter((name) => !!process.env[name]);
	const storedAuthCount = readStoredAuthProviderCount();
	const packageJsonPath = join(getPackageDir(), "package.json");
	const checks: CheckResult[] = [
		{
			name: "AIRIS version",
			status: "ok",
			detail: VERSION,
		},
		{
			name: "Node.js",
			status: process.versions.node ? "ok" : "fail",
			detail: process.versions.node ? `v${process.versions.node}` : "not available",
			fix: "Install Node.js 22.19 or newer.",
		},
		{
			name: "Python",
			status: toolByName.get("python")?.installed ? "ok" : "warn",
			detail: toolByName.get("python")?.version ?? "not found",
			fix: "Install python or python3 if Python integrations are needed.",
		},
		{
			name: "npm",
			status: toolByName.get("npm")?.installed ? "ok" : "fail",
			detail: toolByName.get("npm")?.version ?? "not found",
			fix: "Install npm or use a Node distribution that includes npm.",
		},
		{
			name: "Git",
			status: toolByName.get("git")?.installed ? "ok" : "warn",
			detail: toolByName.get("git")?.version ?? "not found",
			fix: "Install git for source updates and project metadata.",
		},
		{
			name: "PATH",
			status: process.env.PATH ? "ok" : "fail",
			detail: process.env.PATH ? "configured" : "empty",
			fix: "Set PATH so airis, node, npm, and git can be discovered.",
		},
		{
			name: "Package files",
			status: existsSync(packageJsonPath) ? "ok" : "fail",
			detail: existsSync(packageJsonPath) ? packageJsonPath : "package.json not found",
			fix: "Reinstall AIRIS or run from a complete source checkout.",
		},
		{
			name: "Config directory",
			status: checkWritableDirectory(agentDir) ? "ok" : "fail",
			detail: agentDir,
			fix: `Set ${ENV_AGENT_DIR} to a writable directory.`,
		},
		{
			name: "Settings file",
			status: existsSync(getSettingsPath()) ? "ok" : "warn",
			detail: existsSync(getSettingsPath()) ? getSettingsPath() : "not created yet",
			fix: `Run ${APP_NAME} config set theme graphite to create settings.`,
		},
		{
			name: "API keys",
			status: envKeys.length > 0 || storedAuthCount > 0 ? "ok" : "warn",
			detail: `${envKeys.length} environment key(s), ${storedAuthCount} stored provider(s)`,
			fix: "Set a provider API key such as GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.",
		},
		{
			name: "Session storage",
			status: checkWritableDirectory(sessionDir) ? "ok" : "fail",
			detail: sessionDir,
			fix: `Run ${APP_NAME} config set sessionPath <writable-dir>.`,
		},
		{
			name: "Logs",
			status: checkWritableDirectory(logsDir) ? "ok" : "fail",
			detail: logsDir,
			fix: `Set ${ENV_AGENT_DIR} to a writable directory.`,
		},
		{
			name: "Database",
			status: "ok",
			detail: "JSONL session store available; no external database required",
		},
	];

	header("AIRIS Doctor");
	console.log(chalk.dim("Artificial Intelligence Responsive Integrated System | KageOS"));
	console.log();
	console.log(`${chalk.dim("Check".padEnd(20))}${chalk.dim("Status".padEnd(10))}${chalk.dim("Details")}`);
	for (const check of checks) {
		const marker =
			check.status === "ok"
				? chalk.green("[OK]")
				: check.status === "warn"
					? chalk.yellow("[WARN]")
					: chalk.red("[FAIL]");
		console.log(`${check.name.padEnd(20)}${marker.padEnd(19)}${check.detail}`);
		if (check.status !== "ok" && check.fix) {
			console.log(`  ${status("info", `Fix: ${check.fix}`)}`);
		}
	}
	console.log();
	header("Optional Tools");
	printToolTable(tools);
	const failed = checks.filter((check) => check.status === "fail").length;
	const warnings = checks.filter((check) => check.status === "warn").length;
	console.log();
	console.log(
		failed > 0
			? status("error", `${failed} required check(s) failed; ${warnings} warning(s).`)
			: warnings > 0
				? status("warn", `All required checks passed; ${warnings} warning(s).`)
				: status("ok", "All runtime checks passed."),
	);
	if (failed > 0) {
		process.exitCode = 1;
	}
}

function settingsManagerForGlobalConfig(): SettingsManager {
	return SettingsManager.create(process.cwd(), getAgentDir(), { projectTrusted: false });
}

function parseBooleanConfig(value: string): boolean | undefined {
	const normalized = value.toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return undefined;
}

function normalizeConfigKey(key: string): string {
	const normalized = key.replace(/[._-]/g, "").toLowerCase();
	switch (normalized) {
		case "provider":
		case "modelprovider":
		case "defaultprovider":
			return "provider";
		case "model":
		case "defaultmodel":
			return "defaultModel";
		case "safemode":
			return "safeMode";
		case "projecttrust":
		case "trust":
			return "projectTrust";
		case "sessionpath":
		case "sessiondir":
		case "sessionstoragepath":
			return "sessionPath";
		case "telemetry":
		case "tracing":
			return "telemetry";
		default:
			return key;
	}
}

function getConfigValue(settingsManager: SettingsManager, key: string): string {
	switch (normalizeConfigKey(key)) {
		case "provider":
			return settingsManager.getDefaultProvider() ?? "";
		case "defaultModel":
			return settingsManager.getDefaultModel() ?? "";
		case "theme":
			return settingsManager.getTheme() ?? "graphite";
		case "editor":
			return settingsManager.getEditor() ?? process.env.VISUAL ?? process.env.EDITOR ?? "";
		case "safeMode":
			return String(settingsManager.getSafeMode());
		case "telemetry":
			return String(settingsManager.getEnableAnalytics() || settingsManager.getEnableInstallTelemetry());
		case "projectTrust":
			return settingsManager.getDefaultProjectTrust();
		case "sessionPath":
			return settingsManager.getSessionDir() ?? join(getAgentDir(), "sessions");
		default:
			throw new Error(`Unknown config key: ${key}`);
	}
}

async function setConfigValue(settingsManager: SettingsManager, key: string, value: string): Promise<void> {
	switch (normalizeConfigKey(key)) {
		case "provider":
			settingsManager.setDefaultProvider(value);
			break;
		case "defaultModel":
			settingsManager.setDefaultModel(value);
			break;
		case "theme":
			if (!getThemeByName(value)) throw new Error(`Unknown theme: ${value}`);
			settingsManager.setTheme(value);
			break;
		case "editor":
			settingsManager.setEditor(value);
			break;
		case "safeMode": {
			const parsed = parseBooleanConfig(value);
			if (parsed === undefined) throw new Error("safeMode must be true or false");
			settingsManager.setSafeMode(parsed);
			break;
		}
		case "telemetry": {
			const parsed = parseBooleanConfig(value);
			if (parsed === undefined) throw new Error("telemetry must be true or false");
			settingsManager.setEnableAnalytics(parsed);
			settingsManager.setEnableInstallTelemetry(parsed);
			break;
		}
		case "projectTrust": {
			if (value !== "ask" && value !== "always" && value !== "never") {
				throw new Error("projectTrust must be ask, always, or never");
			}
			settingsManager.setDefaultProjectTrust(value as DefaultProjectTrust);
			break;
		}
		case "sessionPath":
			settingsManager.setSessionDir(resolve(value.replace(/^~(?=$|\/|\\)/, homedir())));
			break;
		default:
			throw new Error(`Unknown config key: ${key}`);
	}
	await settingsManager.flush();
}

async function handleConfigSubcommand(args: string[]): Promise<void> {
	const subcommand = args[0];
	if (!subcommand || subcommand === "--help" || subcommand === "-h") {
		return;
	}
	const settingsManager = settingsManagerForGlobalConfig();
	try {
		switch (subcommand) {
			case "show":
				printConfig(settingsManager);
				return;
			case "path":
				console.log(getSettingsPath());
				return;
			case "get": {
				const key = args[1];
				if (!key) throw new Error("config get requires a key");
				console.log(getConfigValue(settingsManager, key));
				return;
			}
			case "set": {
				const key = args[1];
				const value = args.slice(2).join(" ");
				if (!key || !value) throw new Error("config set requires <key> <value>");
				await setConfigValue(settingsManager, key, value);
				console.log(status("ok", `Set ${normalizeConfigKey(key)}`));
				return;
			}
			default:
				console.error(chalk.red(`Unknown config command: ${subcommand}`));
				console.error(chalk.dim(`Run ${APP_NAME} config --help`));
				process.exitCode = 1;
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
	}
}

function printConfig(settingsManager: SettingsManager): void {
	header("AIRIS Config");
	console.log(chalk.dim(`Config: ${getSettingsPath()}`));
	console.log(chalk.dim(`Agent:  ${getAgentDir()}`));
	console.log();
	console.log(`${chalk.dim("Key".padEnd(18))}${chalk.dim("Value".padEnd(34))}${chalk.dim("Status")}`);
	for (const key of [
		"provider",
		"defaultModel",
		"theme",
		"editor",
		"safeMode",
		"telemetry",
		"projectTrust",
		"sessionPath",
	]) {
		const value = getConfigValue(settingsManager, key);
		const displayValue = value || chalk.dim("not set");
		const valueStatus = value ? chalk.green("configured") : chalk.yellow("default");
		console.log(`${key.padEnd(18)}${displayValue.padEnd(43)}${valueStatus}`);
	}
}

function truncate(value: string, length: number): string {
	if (value.length <= length) return value;
	return `${value.slice(0, Math.max(0, length - 3))}...`;
}

function formatSessionTitle(session: SessionInfo): string {
	return session.name || session.firstMessage || "(untitled)";
}

function formatSessionModel(session: SessionInfo): string {
	if (session.provider && session.model) return `${session.provider}/${session.model}`;
	return "-";
}

async function getSessionDirFromSettings(): Promise<string | undefined> {
	const settingsManager = settingsManagerForGlobalConfig();
	return process.env[ENV_SESSION_DIR] ?? settingsManager.getSessionDir();
}

async function listSessions(all: boolean): Promise<SessionInfo[]> {
	const sessionDir = await getSessionDirFromSettings();
	return all ? SessionManager.listAll(sessionDir) : SessionManager.list(process.cwd(), sessionDir);
}

function printSessionList(sessions: readonly SessionInfo[]): void {
	if (sessions.length === 0) {
		console.log(status("info", "No sessions found."));
		return;
	}
	header("AIRIS Sessions");
	console.log(chalk.dim(`Project: ${process.cwd()}`));
	console.log();
	console.log(`${"ID".padEnd(28)} ${"Modified".padEnd(20)} ${"Model".padEnd(28)} Title`);
	for (const session of sessions.slice(0, 50)) {
		const modified = session.modified.toISOString().replace("T", " ").slice(0, 19);
		console.log(
			`${truncate(session.id, 27).padEnd(28)} ${modified.padEnd(20)} ${truncate(formatSessionModel(session), 27).padEnd(28)} ${truncate(formatSessionTitle(session), 80)}`,
		);
		console.log(chalk.dim(`  ${session.cwd || "unknown project"}`));
	}
}

async function promptYesNo(message: string): Promise<boolean> {
	return new Promise((resolvePrompt) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		rl.question(`${message} [y/N] `, (answer) => {
			rl.close();
			resolvePrompt(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
		});
	});
}

async function handleSessionCommand(args: string[]): Promise<void> {
	const subcommand = args[0] ?? "list";
	switch (subcommand) {
		case "list":
			printSessionList(await listSessions(args.includes("--all")));
			return;
		case "current": {
			const sessions = await listSessions(false);
			if (!sessions[0]) {
				console.log(chalk.dim("No current project session found."));
				return;
			}
			printSessionList([sessions[0]]);
			return;
		}
		case "clear": {
			const all = args.includes("--all");
			const sessions = await listSessions(all);
			if (sessions.length === 0) {
				console.log(chalk.dim("No sessions to clear."));
				return;
			}
			const confirmed =
				args.includes("--yes") ||
				(process.stdin.isTTY && (await promptYesNo(`Delete ${sessions.length} session file(s)?`)));
			if (!confirmed) {
				console.error(
					chalk.yellow(`Refusing to clear sessions without confirmation. Run ${APP_NAME} session clear --yes.`),
				);
				process.exitCode = 1;
				return;
			}
			for (const session of sessions) {
				rmSync(session.path, { force: true });
			}
			logSessionEvent("session.clear", { count: sessions.length, all });
			console.log(chalk.green(`Cleared ${sessions.length} session file(s).`));
			return;
		}
		default:
			console.error(chalk.red(`Unknown session command: ${subcommand}`));
			console.error(chalk.dim(`Run ${APP_NAME} session --help`));
			process.exitCode = 1;
	}
}

function handleTrustCommand(args: string[]): void {
	const trustStore = new ProjectTrustStore(getAgentDir());
	const subcommand = args[0];
	if (!subcommand) {
		trustStore.set(process.cwd(), true);
		console.log(chalk.green(`Trusted ${process.cwd()}`));
		return;
	}
	if (subcommand === "list") {
		const entries = trustStore.list();
		if (entries.length === 0) {
			console.log(chalk.dim("No trusted or blocked paths saved."));
			return;
		}
		for (const entry of entries) {
			const status = entry.decision ? chalk.green("trusted") : chalk.yellow("blocked");
			console.log(`${status.padEnd(17)} ${entry.path}`);
		}
		return;
	}
	if (subcommand === "revoke") {
		const target = args[1];
		if (!target) {
			console.error(chalk.red("trust revoke requires a path"));
			process.exitCode = 1;
			return;
		}
		trustStore.set(resolve(target), null);
		console.log(chalk.green(`Revoked trust decision for ${resolve(target)}`));
		return;
	}
	console.error(chalk.red(`Unknown trust command: ${subcommand}`));
	console.error(chalk.dim(`Run ${APP_NAME} trust --help`));
	process.exitCode = 1;
}

async function handleThemeCommand(args: string[]): Promise<void> {
	const subcommand = args[0] ?? "list";
	if (subcommand === "list") {
		const settingsManager = settingsManagerForGlobalConfig();
		const current = settingsManager.getTheme() ?? "graphite";
		for (const theme of getAvailableThemesWithPaths()) {
			const marker = theme.name === current ? chalk.green("current") : "       ";
			console.log(`${theme.name.padEnd(18)} ${marker} ${theme.path ? chalk.dim(theme.path) : ""}`);
		}
		return;
	}
	if (subcommand === "set") {
		const name = args[1];
		if (!name) {
			console.error(chalk.red("theme set requires a theme name"));
			process.exitCode = 1;
			return;
		}
		if (!getThemeByName(name)) {
			console.error(chalk.red(`Unknown theme: ${name}`));
			console.error(chalk.dim(`Run ${APP_NAME} theme list`));
			process.exitCode = 1;
			return;
		}
		const settingsManager = settingsManagerForGlobalConfig();
		settingsManager.setTheme(name);
		await settingsManager.flush();
		console.log(chalk.green(`Theme set to ${name}`));
		return;
	}
	if (subcommand === "preview") {
		const name = args[1] ?? settingsManagerForGlobalConfig().getTheme() ?? "graphite";
		const selected = getThemeByName(name);
		if (!selected) {
			console.error(chalk.red(`Unknown theme: ${name}`));
			process.exitCode = 1;
			return;
		}
		console.log(selected.fg("accent", `AIRIS theme preview: ${name}`));
		console.log(
			`${selected.fg("text", "text")} ${selected.fg("muted", "muted")} ${selected.fg("success", "success")} ${selected.fg("warning", "warning")} ${selected.fg("error", "error")}`,
		);
		console.log(selected.bg("selectedBg", " selected "));
		return;
	}
	console.error(chalk.red(`Unknown theme command: ${subcommand}`));
	console.error(chalk.dim(`Run ${APP_NAME} theme --help`));
	process.exitCode = 1;
}

function printChangelog(): void {
	const changelogPath = getChangelogPath();
	const entries = parseChangelog(changelogPath);
	if (entries[0]) {
		console.log(entries[0].content);
		return;
	}
	if (existsSync(changelogPath)) {
		console.log(readFileSync(changelogPath, "utf-8"));
		return;
	}
	console.log(chalk.dim("No changelog found."));
}

export function getSafeModeToolList(
	settingsManager: SettingsManager,
	explicitToolsConfigured: boolean,
): string[] | undefined {
	if (!settingsManager.getSafeMode() || explicitToolsConfigured) {
		return undefined;
	}
	return Array.from(READ_ONLY_TOOLS);
}

export function printUpdateGuidance(): void {
	console.log(`Installed version: ${VERSION}`);
	console.log(`Install method: ${detectInstallMethod()}`);
	console.log(`Update command: ${getUpdateInstruction(PACKAGE_NAME)}`);
	console.log("Rollback for source checkouts: git reset --hard ORIG_HEAD");
	console.log(`Logs: ${getAirisLogPath()}, ${getErrorsLogPath()}, ${getSessionsLogPath()}`);
	console.log(`Config: ~/${CONFIG_DIR_NAME}/agent or ${ENV_AGENT_DIR}`);
}
