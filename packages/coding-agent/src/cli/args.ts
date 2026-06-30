/**
 * CLI argument parsing and help display
 */

import type { ThinkingLevel } from "@earendil-works/airis-agent-core";
import chalk from "chalk";
import { APP_NAME, CONFIG_DIR_NAME, ENV_AGENT_DIR, ENV_SESSION_DIR, VERSION } from "../config.ts";
import type { ExtensionFlag } from "../core/extensions/types.ts";
import { box, commandHint, section } from "./ui.ts";

export type Mode = "text" | "json" | "rpc";

export interface Args {
	provider?: string;
	model?: string;
	apiKey?: string;
	systemPrompt?: string;
	appendSystemPrompt?: string[];
	thinking?: ThinkingLevel;
	continue?: boolean;
	resume?: boolean;
	help?: boolean;
	version?: boolean;
	mode?: Mode;
	name?: string;
	noSession?: boolean;
	session?: string;
	sessionId?: string;
	fork?: string;
	sessionDir?: string;
	models?: string[];
	tools?: string[];
	excludeTools?: string[];
	noTools?: boolean;
	noBuiltinTools?: boolean;
	extensions?: string[];
	noExtensions?: boolean;
	print?: boolean;
	export?: string;
	noSkills?: boolean;
	skills?: string[];
	promptTemplates?: string[];
	noPromptTemplates?: boolean;
	themes?: string[];
	noThemes?: boolean;
	noContextFiles?: boolean;
	listModels?: string | true;
	offline?: boolean;
	verbose?: boolean;
	projectTrustOverride?: boolean;
	messages: string[];
	fileArgs: string[];
	/** Unknown flags (potentially extension flags) - map of flag name to value */
	unknownFlags: Map<string, boolean | string>;
	diagnostics: Array<{ type: "warning" | "error"; message: string }>;
}

const VALID_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export function isValidThinkingLevel(level: string): level is ThinkingLevel {
	return VALID_THINKING_LEVELS.includes(level as ThinkingLevel);
}

export function parseArgs(args: string[]): Args {
	const result: Args = {
		messages: [],
		fileArgs: [],
		unknownFlags: new Map(),
		diagnostics: [],
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (i === 0 && arg === "chat") {
			continue;
		}

		if (arg === "--help" || arg === "-h") {
			result.help = true;
		} else if (arg === "--version" || arg === "-v") {
			result.version = true;
		} else if (arg === "--mode" && i + 1 < args.length) {
			const mode = args[++i];
			if (mode === "text" || mode === "json" || mode === "rpc") {
				result.mode = mode;
			}
		} else if (arg === "--continue" || arg === "-c") {
			result.continue = true;
		} else if (arg === "--resume" || arg === "-r") {
			result.resume = true;
		} else if (arg === "--provider" && i + 1 < args.length) {
			result.provider = args[++i];
		} else if (arg === "--model" && i + 1 < args.length) {
			result.model = args[++i];
		} else if (arg === "--aairis-key" && i + 1 < args.length) {
			result.apiKey = args[++i];
		} else if (arg === "--system-prompt" && i + 1 < args.length) {
			result.systemPrompt = args[++i];
		} else if (arg === "--append-system-prompt" && i + 1 < args.length) {
			result.appendSystemPrompt = result.appendSystemPrompt ?? [];
			result.appendSystemPrompt.push(args[++i]);
		} else if (arg === "--name" || arg === "-n") {
			if (i + 1 < args.length) {
				result.name = args[++i];
			} else {
				result.diagnostics.push({ type: "error", message: "--name requires a value" });
			}
		} else if (arg === "--no-session") {
			result.noSession = true;
		} else if (arg === "--session" && i + 1 < args.length) {
			result.session = args[++i];
		} else if (arg === "--session-id" && i + 1 < args.length) {
			result.sessionId = args[++i];
		} else if (arg === "--fork" && i + 1 < args.length) {
			result.fork = args[++i];
		} else if (arg === "--session-dir" && i + 1 < args.length) {
			result.sessionDir = args[++i];
		} else if (arg === "--models" && i + 1 < args.length) {
			result.models = args[++i].split(",").map((s) => s.trim());
		} else if (arg === "--no-tools" || arg === "-nt") {
			result.noTools = true;
		} else if (arg === "--no-builtin-tools" || arg === "-nbt") {
			result.noBuiltinTools = true;
		} else if ((arg === "--tools" || arg === "-t") && i + 1 < args.length) {
			result.tools = args[++i]
				.split(",")
				.map((s) => s.trim())
				.filter((name) => name.length > 0);
		} else if ((arg === "--exclude-tools" || arg === "-xt") && i + 1 < args.length) {
			result.excludeTools = args[++i]
				.split(",")
				.map((s) => s.trim())
				.filter((name) => name.length > 0);
		} else if (arg === "--thinking" && i + 1 < args.length) {
			const level = args[++i];
			if (isValidThinkingLevel(level)) {
				result.thinking = level;
			} else {
				result.diagnostics.push({
					type: "warning",
					message: `Invalid thinking level "${level}". Valid values: ${VALID_THINKING_LEVELS.join(", ")}`,
				});
			}
		} else if (arg === "--print" || arg === "-p") {
			result.print = true;
			const next = args[i + 1];
			if (next !== undefined && !next.startsWith("@") && (!next.startsWith("-") || next.startsWith("---"))) {
				result.messages.push(next);
				i++;
			}
		} else if (arg === "--export" && i + 1 < args.length) {
			result.export = args[++i];
		} else if ((arg === "--extension" || arg === "-e") && i + 1 < args.length) {
			result.extensions = result.extensions ?? [];
			result.extensions.push(args[++i]);
		} else if (arg === "--no-extensions" || arg === "-ne") {
			result.noExtensions = true;
		} else if (arg === "--skill" && i + 1 < args.length) {
			result.skills = result.skills ?? [];
			result.skills.push(args[++i]);
		} else if (arg === "--prompt-template" && i + 1 < args.length) {
			result.promptTemplates = result.promptTemplates ?? [];
			result.promptTemplates.push(args[++i]);
		} else if (arg === "--theme" && i + 1 < args.length) {
			result.themes = result.themes ?? [];
			result.themes.push(args[++i]);
		} else if (arg === "--no-skills" || arg === "-ns") {
			result.noSkills = true;
		} else if (arg === "--no-prompt-templates" || arg === "-np") {
			result.noPromptTemplates = true;
		} else if (arg === "--no-themes") {
			result.noThemes = true;
		} else if (arg === "--no-context-files" || arg === "-nc") {
			result.noContextFiles = true;
		} else if (arg === "--list-models") {
			// Check if next arg is a search pattern (not a flag or file arg)
			if (i + 1 < args.length && !args[i + 1].startsWith("-") && !args[i + 1].startsWith("@")) {
				result.listModels = args[++i];
			} else {
				result.listModels = true;
			}
		} else if (arg === "--verbose") {
			result.verbose = true;
		} else if (arg === "--approve" || arg === "-a") {
			result.projectTrustOverride = true;
		} else if (arg === "--no-approve" || arg === "-na") {
			result.projectTrustOverride = false;
		} else if (arg === "--offline") {
			result.offline = true;
		} else if (arg.startsWith("@")) {
			result.fileArgs.push(arg.slice(1)); // Remove @ prefix
		} else if (arg.startsWith("--")) {
			const eqIndex = arg.indexOf("=");
			if (eqIndex !== -1) {
				result.unknownFlags.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
			} else {
				const flagName = arg.slice(2);
				const next = args[i + 1];
				if (next !== undefined && !next.startsWith("-") && !next.startsWith("@")) {
					result.unknownFlags.set(flagName, next);
					i++;
				} else {
					result.unknownFlags.set(flagName, true);
				}
			}
		} else if (arg.startsWith("-") && !arg.startsWith("--")) {
			result.diagnostics.push({ type: "error", message: `Unknown option: ${arg}` });
		} else if (!arg.startsWith("-")) {
			result.messages.push(arg);
		}
	}

	return result;
}

export function printHelp(extensionFlags?: ExtensionFlag[]): void {
	const extensionFlagsText =
		extensionFlags && extensionFlags.length > 0
			? `\n${section("Extension CLI Flags")}\n${extensionFlags
					.map((flag) => {
						const value = flag.type === "string" ? " <value>" : "";
						const description = flag.description ?? `Registered by ${flag.extensionPath}`;
						return commandHint(`--${flag.name}${value}`, description);
					})
					.join("\n")}\n`
			: "";
	console.log(`${chalk.bold(chalk.cyan("AIRIS"))} ${chalk.dim(`v${VERSION}`)}
Artificial Intelligence Responsive Integrated System
Creator: Umaiz Sufiyan
Student developer | KageOS

${section("Usage")}
  ${APP_NAME} [options] [@files...] [messages...]
  ${APP_NAME} <command> [args]

${section("Command Categories")}
  ${chalk.cyan("Core")}
    ${APP_NAME}                         Launch interactive AIRIS
    ${APP_NAME} chat                    Launch chat mode (alias)
    ${APP_NAME} help [command]          Show help
    ${APP_NAME} version                 Show version and brand metadata
    ${APP_NAME} changelog               Show latest changelog entry

  ${chalk.cyan("AI")}
    ${APP_NAME} -p "prompt"             Run one-shot prompt mode
    ${APP_NAME} --provider <name>       Select provider
    ${APP_NAME} --model <pattern>       Select model or provider/model
    ${APP_NAME} --list-models [search]  List configured models

  ${chalk.cyan("Vision")}
    ${APP_NAME} image setup --model sd15
                                   Download a local Diffusers model
    ${APP_NAME} image generate "prompt"
                                   Generate a PNG locally
    ${APP_NAME} image edit --input image.png --mask mask.png --prompt "edit"
                                   Edit a PNG locally with inpainting
    ${APP_NAME} image models           List local image models
    ${APP_NAME} image open-last        Open the last generated PNG

  ${chalk.cyan("Project")}
    ${APP_NAME} trust                   Trust current project folder
    ${APP_NAME} trust list              List saved trust decisions
    ${APP_NAME} trust revoke <path>     Remove a trust decision
    ${APP_NAME} --approve               Trust project for this run
    ${APP_NAME} --no-approve            Run without project trust

  ${chalk.cyan("Verified Autonomy")}
    ${APP_NAME} mission "task" --verified
                                   Create a scoped mission contract
    ${APP_NAME} mission approve <id>    Approve scope and create a temporary lease
    ${APP_NAME} mission run <id>        Run evidence-backed verification
    ${APP_NAME} evidence show <id>      Show structured proof-of-completion
    ${APP_NAME} lease list              List active capability leases
    ${APP_NAME} failures search "err"   Search failure genome records

  ${chalk.cyan("Ship Workflow")}
    ${APP_NAME} ship start "task"       Start a full development workflow
    ${APP_NAME} ship status [id]        Show workflow status
    ${APP_NAME} ship resume             Resume the active workflow
    ${APP_NAME} ship cancel             Cancel the active workflow
    ${APP_NAME} ship list               List all ship workflows

  ${chalk.cyan("Sessions")}
    ${APP_NAME} session list [--all]    List sessions
    ${APP_NAME} session resume <id>     Resume a session
    ${APP_NAME} session current         Show latest current-project session
    ${APP_NAME} session clear [--yes]   Clear current-project sessions
    ${APP_NAME} --continue, -c          Continue previous session
    ${APP_NAME} --resume, -r            Select a session to resume

  ${chalk.cyan("Files")}
    ${APP_NAME} @file.md "prompt"       Include a file in the prompt
    ${APP_NAME} --tools read,grep,find,ls -p "Review code"
                                   Run read-only review mode

  ${chalk.cyan("Config")}
    ${APP_NAME} config show             Show sanitized config
    ${APP_NAME} config get <key>        Read config value
    ${APP_NAME} config set <key> <val>  Write config value
    ${APP_NAME} config path             Show settings path
    ${APP_NAME} theme list              List themes
    ${APP_NAME} theme set graphite      Set graphite theme

  ${chalk.cyan("Droid")}
    ${APP_NAME} droid open settings     Run Android automation through ADB
    ${APP_NAME} droid read screen       Read connected device screen text
    ${APP_NAME} automation tap 360 800  Automation command alias

  ${chalk.cyan("Tools")}
    ${APP_NAME} tools list              Detect companion CLIs
    ${APP_NAME} tools doctor            Diagnose companion tools
    ${APP_NAME} install <source> [-l]   Install extension source
    ${APP_NAME} remove <source> [-l]    Remove extension source
    ${APP_NAME} list                    List installed extensions

  ${chalk.cyan("System")}
    ${APP_NAME} doctor                  Check runtime health
    ${APP_NAME} update [source|self]    Update AIRIS and extensions

  ${chalk.cyan("Developer")}
    ${APP_NAME} --mode json|rpc         Machine-readable modes
    ${APP_NAME} --extension <path>      Load extension
    ${APP_NAME} --skill <path>          Load skill

  ${chalk.cyan("Experimental")}
    ${APP_NAME} --models <patterns>     Limit model cycling
    ${APP_NAME} --thinking <level>      Set thinking level

${section("Options")}
  --provider <name>              Provider name (default: google)
  --model <pattern>              Model pattern or ID (supports "provider/id" and optional ":<thinking>")
  --aairis-key <key>                API key (defaults to env vars)
  --system-prompt <text>         System prompt (default: coding assistant prompt)
  --append-system-prompt <text>  Append text or file contents to the system prompt (can be used multiple times)
  --mode <mode>                  Output mode: text (default), json, or rpc
  --print, -p                    Non-interactive mode: process prompt and exit
  --continue, -c                 Continue previous session
  --resume, -r                   Select a session to resume
  --session <path|id>            Use specific session file or partial UUID
  --session-id <id>              Use exact project session ID, creating it if missing
  --fork <path|id>               Fork specific session file or partial UUID into a new session
  --session-dir <dir>            Directory for session storage and lookup
  --no-session                   Don't save session (ephemeral)
  --name, -n <name>              Set session display name
  --models <patterns>            Comma-separated model patterns for Ctrl+P cycling
                                 Supports globs (anthropic/*, *sonnet*) and fuzzy matching
  --no-tools, -nt                Disable all tools by default (built-in and extension)
  --no-builtin-tools, -nbt       Disable built-in tools by default but keep extension/custom tools enabled
  --tools, -t <tools>            Comma-separated allowlist of tool names to enable
                                 Applies to built-in, extension, and custom tools
  --exclude-tools, -xt <tools>   Comma-separated denylist of tool names to disable
                                 Applies to built-in, extension, and custom tools
  --thinking <level>             Set thinking level: off, minimal, low, medium, high, xhigh
  --extension, -e <path>         Load an extension file (can be used multiple times)
  --no-extensions, -ne           Disable extension discovery (explicit -e paths still work)
  --skill <path>                 Load a skill file or directory (can be used multiple times)
  --no-skills, -ns               Disable skills discovery and loading
  --prompt-template <path>       Load a prompt template file or directory (can be used multiple times)
  --no-prompt-templates, -np     Disable prompt template discovery and loading
  --theme <path>                 Load a theme file or directory (can be used multiple times)
  --no-themes                    Disable theme discovery and loading
  --no-context-files, -nc        Disable AGENTS.md and CLAUDE.md discovery and loading
  --export <file>                Export session file to HTML and exit
  --list-models [search]         List available models (with optional fuzzy search)
  --verbose                      Force verbose startup (overrides quietStartup setting)
  --approve, -a                  Trust project-local files for this run
  --no-approve, -na              Ignore project-local files for this run
  --offline                      Disable startup network operations (same as AIRIS_OFFLINE=1)
  --help, -h                     Show this help
  --version, -v                  Show version number

Extensions can register additional flags (for example, --plan).${extensionFlagsText}

${box(
	"Examples",
	[
		`${APP_NAME}`,
		`${APP_NAME} "Review this project"`,
		`${APP_NAME} -p "Summarize package.json"`,
		`${APP_NAME} doctor`,
		`${APP_NAME} session list`,
	].map((example) => chalk.cyan(example)),
)}

${section("Environment Variables")}
  ANTHROPIC_AAIRIS_KEY                - Anthropic Claude API key
  ANTHROPIC_OAUTH_TOKEN            - Anthropic OAuth token (alternative to API key)
  ANT_LING_AAIRIS_KEY                 - Ant Ling API key
  OPENAI_AAIRIS_KEY                   - OpenAI GPT API key
  AZURE_OPENAI_AAIRIS_KEY             - Azure OpenAI API key
  AZURE_OPENAI_BASE_URL            - Azure OpenAI/Cognitive Services base URL (e.g. https://{resource}.openai.azure.com)
  AZURE_OPENAI_RESOURCE_NAME       - Azure OpenAI resource name (alternative to base URL)
  AZURE_OPENAI_AAIRIS_VERSION         - Azure OpenAI API version (default: v1)
  AZURE_OPENAI_DEPLOYMENT_NAME_MAP - Azure OpenAI model=deployment map (comma-separated)
  DEEPSEEK_AAIRIS_KEY                 - DeepSeek API key
  NVIDIA_AAIRIS_KEY                   - NVIDIA NIM API key
  GEMINI_AAIRIS_KEY                   - Google Gemini API key
  GROQ_AAIRIS_KEY                     - Groq API key
  CEREBRAS_AAIRIS_KEY                 - Cerebras API key
  XAI_AAIRIS_KEY                      - xAI Grok API key
  FIREWORKS_AAIRIS_KEY                - Fireworks API key
  TOGETHER_AAIRIS_KEY                 - Together AI API key
  OPENROUTER_AAIRIS_KEY               - OpenRouter API key
  AI_GATEWAY_AAIRIS_KEY               - Vercel AI Gateway API key
  ZAI_AAIRIS_KEY                      - ZAI API key
  ZAI_CODING_CN_AAIRIS_KEY            - ZAI Coding Plan API key (China)
  MISTRAL_AAIRIS_KEY                  - Mistral API key
  MINIMAX_AAIRIS_KEY                  - MiniMax API key
  MOONSHOT_AAIRIS_KEY                 - Moonshot AI API key
  OPENCODE_AAIRIS_KEY                 - OpenCode Zen/OpenCode Go API key
  KIMI_AAIRIS_KEY                     - Kimi For Coding API key
  CLOUDFLARE_AAIRIS_KEY               - Cloudflare API token (Workers AI and AI Gateway)
  CLOUDFLARE_ACCOUNT_ID            - Cloudflare account id (required for both)
  CLOUDFLARE_GATEWAY_ID            - Cloudflare AI Gateway slug (required for AI Gateway)
  XIAOMI_AAIRIS_KEY                   - Xiaomi MiMo API key (api.xiaomimimo.com billing)
  XIAOMI_TOKEN_PLAN_CN_AAIRIS_KEY     - Xiaomi MiMo Token Plan API key (China region)
  XIAOMI_TOKEN_PLAN_AMS_AAIRIS_KEY    - Xiaomi MiMo Token Plan API key (Amsterdam region)
  XIAOMI_TOKEN_PLAN_SGP_AAIRIS_KEY    - Xiaomi MiMo Token Plan API key (Singapore region)
  AWS_PROFILE                      - AWS profile for Amazon Bedrock
  AWS_ACCESS_KEY_ID                - AWS access key for Amazon Bedrock
  AWS_SECRET_ACCESS_KEY            - AWS secret key for Amazon Bedrock
  AWS_BEARER_TOKEN_BEDROCK         - Bedrock API key (bearer token)
  AWS_REGION                       - AWS region for Amazon Bedrock (e.g., us-east-1)
  ${ENV_AGENT_DIR.padEnd(32)} - Config directory (default: ~/${CONFIG_DIR_NAME}/agent)
  ${ENV_SESSION_DIR.padEnd(32)} - Session storage directory (overridden by --session-dir)
  AIRIS_PACKAGE_DIR                - Override package directory (for Nix/Guix store paths)
  AIRIS_OFFLINE                    - Disable startup network operations when set to 1/true/yes
  AIRIS_TELEMETRY                  - Override install telemetry when set to 1/true/yes or 0/false/no
  AIRIS_SHARE_VIEWER_URL           - Base URL for /share command (default: https://sufiyan-sabeel.github.io/AIRIS-CLI/)
  AIRIS_CODING_AGENT               - Set to "true" when running inside AIRIS

${section("Built-in Tool Names")}
  read   - Read file contents
  bash   - Execute bash commands
  edit   - Edit files with find/replace
  write  - Write files (creates/overwrites)
  grep   - Search file contents (read-only, off by default)
  find   - Find files by glob pattern (read-only, off by default)
  ls     - List directory contents (read-only, off by default)
`);
}
