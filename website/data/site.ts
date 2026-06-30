import {
  Bot,
  Braces,
  ClipboardCheck,
  Code2,
  FileCode2,
  GitBranch,
  Layers3,
  Palette,
  ShieldCheck,
  Smartphone,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const repo = {
  name: "AIRIS CLI",
  fullName: "Artificial Intelligence Responsive Integrated System",
  creator: "Umaiz Sufiyan",
  creatorProfile:
    "Created by Umaiz Sufiyan, a student developer and independent builder behind KageOS. He began building AIRIS at 15 and continues developing it at 16 with a focus on AI-powered command-line tools, automation, developer productivity, and mobile-first development.",
  organization: "KageOS",
  url: "https://github.com/sufiyan-sabeel/AIRIS-CLI",
  packageName: "@sufiyan-sabeel/airis-cli",
  version: "0.79.3",
  license: "MIT",
  node: ">=22.19.0",
  configDir: "~/.airis/agent",
};

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  evidence: string;
};

export const features: Feature[] = [
  {
    title: "Interactive terminal UI",
    description: "AIRIS launches an interactive terminal experience for coding conversations and project work.",
    icon: TerminalSquare,
    evidence: "README: Interactive TUI; help: `airis` launch command",
  },
  {
    title: "File operations",
    description: "Built-in tool names include read, write, edit, grep, find, and ls for project-aware file workflows.",
    icon: FileCode2,
    evidence: "CLI help: Built-in Tool Names",
  },
  {
    title: "Shell execution",
    description: "The built-in bash tool executes shell commands, with trust and approval controls around mutation-capable tools.",
    icon: Code2,
    evidence: "CLI help: bash tool; Project trust commands",
  },
  {
    title: "Session management",
    description: "List, resume, continue, fork, name, store, clear, and export sessions from the CLI.",
    icon: GitBranch,
    evidence: "CLI help: Sessions and session options",
  },
  {
    title: "Provider selection",
    description: "Choose providers and models with `--provider`, `--model`, and `--list-models`.",
    icon: Bot,
    evidence: "CLI help: AI commands and provider/model options",
  },
  {
    title: "Verified Autonomy",
    description: "Mission contracts, capability leases, evidence reports, and failure search are exposed as CLI commands.",
    icon: ClipboardCheck,
    evidence: "CLI help: Verified Autonomy section",
  },
  {
    title: "Ship workflow",
    description: "`airis ship` starts, resumes, cancels, lists, and reports status for a full development workflow.",
    icon: Layers3,
    evidence: "CLI help and docs/airis-ship.md",
  },
  {
    title: "Project trust",
    description: "Trust commands and per-run approval flags control project-local resources and mutation tools.",
    icon: ShieldCheck,
    evidence: "CLI help: Project section",
  },
  {
    title: "Extensions and skills",
    description: "AIRIS can load extension files, skills, prompt templates, themes, and package sources.",
    icon: Wrench,
    evidence: "CLI help: Developer, Config, Tools sections",
  },
  {
    title: "Theme support",
    description: "Theme listing, setting, preview, and custom theme file loading are supported.",
    icon: Palette,
    evidence: "CLI help: theme commands and `--theme` option",
  },
  {
    title: "Termux support",
    description: "The repository includes Android Termux installation instructions for running AIRIS in Termux.",
    icon: Smartphone,
    evidence: "README and docs/installation.md",
  },
  {
    title: "Machine-readable modes",
    description: "Use `--mode json` or `--mode rpc` for machine-readable output and process integration.",
    icon: Braces,
    evidence: "CLI help: Developer section and Options",
  },
];

export type Command = {
  command: string;
  description: string;
  usage: string;
  examples: string[];
  category: "Core" | "AI" | "Project" | "Verified Autonomy" | "Ship" | "Sessions" | "Config" | "Tools" | "System" | "Developer";
};

export const commands: Command[] = [
  { command: "airis", description: "Launch interactive AIRIS.", usage: "airis [options] [@files...] [messages...]", examples: ["airis", "airis \"Review this project\""], category: "Core" },
  { command: "airis chat", description: "Launch chat mode as an alias.", usage: "airis chat", examples: ["airis chat"], category: "Core" },
  { command: "airis help", description: "Show help, optionally for a command.", usage: "airis help [command]", examples: ["airis help", "airis help session"], category: "Core" },
  { command: "airis version", description: "Show version and brand metadata.", usage: "airis version", examples: ["airis version"], category: "Core" },
  { command: "airis changelog", description: "Show the latest changelog entry.", usage: "airis changelog", examples: ["airis changelog"], category: "Core" },
  { command: "airis -p", description: "Run one-shot prompt mode.", usage: "airis -p \"prompt\"", examples: ["airis -p \"Summarize package.json\""], category: "AI" },
  { command: "airis --provider", description: "Select provider.", usage: "airis --provider <name>", examples: ["airis --provider anthropic -p \"Explain this code\""], category: "AI" },
  { command: "airis --model", description: "Select model or provider/model.", usage: "airis --model <pattern>", examples: ["airis --model anthropic/*sonnet*"], category: "AI" },
  { command: "airis --list-models", description: "List configured models with optional search.", usage: "airis --list-models [search]", examples: ["airis --list-models", "airis --list-models gemini"], category: "AI" },
  { command: "airis trust", description: "Trust current project folder.", usage: "airis trust", examples: ["airis trust"], category: "Project" },
  { command: "airis trust list", description: "List saved trust decisions.", usage: "airis trust list", examples: ["airis trust list"], category: "Project" },
  { command: "airis trust revoke", description: "Remove a trust decision.", usage: "airis trust revoke <path>", examples: ["airis trust revoke ."], category: "Project" },
  { command: "airis mission", description: "Create a scoped mission contract.", usage: "airis mission \"<request>\" --verified", examples: ["airis mission \"Add tests\" --verified"], category: "Verified Autonomy" },
  { command: "airis mission approve", description: "Approve scope and create a temporary lease.", usage: "airis mission approve <id>", examples: ["airis mission approve mission-123"], category: "Verified Autonomy" },
  { command: "airis mission run", description: "Run evidence-backed verification.", usage: "airis mission run <id>", examples: ["airis mission run mission-123"], category: "Verified Autonomy" },
  { command: "airis evidence show", description: "Show structured proof-of-completion.", usage: "airis evidence show <mission-id>", examples: ["airis evidence show mission-123"], category: "Verified Autonomy" },
  { command: "airis lease list", description: "List active capability leases.", usage: "airis lease list", examples: ["airis lease list"], category: "Verified Autonomy" },
  { command: "airis failures search", description: "Search failure genome records.", usage: "airis failures search \"<error>\"", examples: ["airis failures search \"TypeError\""], category: "Verified Autonomy" },
  { command: "airis ship start", description: "Start a full development workflow.", usage: "airis ship start \"task\"", examples: ["airis ship start \"Add a help command\""], category: "Ship" },
  { command: "airis ship status", description: "Show workflow status.", usage: "airis ship status [id]", examples: ["airis ship status"], category: "Ship" },
  { command: "airis ship resume", description: "Resume the active workflow.", usage: "airis ship resume", examples: ["airis ship resume"], category: "Ship" },
  { command: "airis ship cancel", description: "Cancel the active workflow.", usage: "airis ship cancel", examples: ["airis ship cancel"], category: "Ship" },
  { command: "airis ship list", description: "List all ship workflows.", usage: "airis ship list", examples: ["airis ship list"], category: "Ship" },
  { command: "airis session list", description: "List sessions.", usage: "airis session list [--all]", examples: ["airis session list", "airis session list --all"], category: "Sessions" },
  { command: "airis session resume", description: "Resume a session.", usage: "airis session resume <id>", examples: ["airis session resume abc123"], category: "Sessions" },
  { command: "airis session current", description: "Show latest current-project session.", usage: "airis session current", examples: ["airis session current"], category: "Sessions" },
  { command: "airis session clear", description: "Clear current-project sessions.", usage: "airis session clear [--yes]", examples: ["airis session clear --yes"], category: "Sessions" },
  { command: "airis config show", description: "Show sanitized config.", usage: "airis config show", examples: ["airis config show"], category: "Config" },
  { command: "airis config get", description: "Read config value.", usage: "airis config get <key>", examples: ["airis config get theme"], category: "Config" },
  { command: "airis config set", description: "Write config value.", usage: "airis config set <key> <val>", examples: ["airis config set theme graphite"], category: "Config" },
  { command: "airis config path", description: "Show settings path.", usage: "airis config path", examples: ["airis config path"], category: "Config" },
  { command: "airis theme list", description: "List themes.", usage: "airis theme list", examples: ["airis theme list"], category: "Config" },
  { command: "airis theme set", description: "Set a theme.", usage: "airis theme set graphite", examples: ["airis theme set graphite"], category: "Config" },
  { command: "airis tools list", description: "Detect companion CLIs.", usage: "airis tools list", examples: ["airis tools list"], category: "Tools" },
  { command: "airis tools doctor", description: "Diagnose companion tools.", usage: "airis tools doctor", examples: ["airis tools doctor"], category: "Tools" },
  { command: "airis install", description: "Install extension source.", usage: "airis install <source> [-l]", examples: ["airis install ./local/path"], category: "Tools" },
  { command: "airis remove", description: "Remove extension source.", usage: "airis remove <source> [-l]", examples: ["airis remove npm:@foo/bar"], category: "Tools" },
  { command: "airis list", description: "List installed extensions.", usage: "airis list", examples: ["airis list"], category: "Tools" },
  { command: "airis doctor", description: "Check runtime health.", usage: "airis doctor", examples: ["airis doctor"], category: "System" },
  { command: "airis update", description: "Update AIRIS and extensions.", usage: "airis update [source|self]", examples: ["airis update", "airis update self"], category: "System" },
  { command: "airis --mode", description: "Machine-readable output modes.", usage: "airis --mode json|rpc", examples: ["airis --mode json -p \"Summarize\""], category: "Developer" },
  { command: "airis --extension", description: "Load an extension file.", usage: "airis --extension <path>", examples: ["airis --extension ./extension.ts"], category: "Developer" },
  { command: "airis --skill", description: "Load a skill file or directory.", usage: "airis --skill <path>", examples: ["airis --skill ./skills"], category: "Developer" },
];

export const commandCategories = ["All", "Core", "AI", "Project", "Verified Autonomy", "Ship", "Sessions", "Config", "Tools", "System", "Developer"] as const;

export const installSections = [
  {
    platform: "Linux",
    commands: [
      "curl -fsSL https://airis-dev.netlify.app/install.sh | sh",
      "git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git\ncd AIRIS-CLI\nnpm install --ignore-scripts --no-audit --no-fund\nnpm run build\nnpm link",
    ],
  },
  {
    platform: "macOS",
    commands: [
      "brew install node\ngit clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git\ncd AIRIS-CLI\nnpm install --ignore-scripts --no-audit --no-fund\nnpm run build\nnpm link",
    ],
  },
  {
    platform: "Windows",
    commands: [
      "git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git\ncd AIRIS-CLI\nnpm install --ignore-scripts --no-audit --no-fund\nnpm run build\nnpm link",
    ],
  },
  {
    platform: "Termux",
    commands: [
      "pkg update && pkg upgrade\npkg install nodejs git\nnpm install -g @sufiyan-sabeel/airis-cli\nairis --version",
    ],
  },
];

export const providers = [
  ["Anthropic", "ANTHROPIC_AAIRIS_KEY or ANTHROPIC_OAUTH_TOKEN"],
  ["OpenAI", "OPENAI_AAIRIS_KEY"],
  ["Google Gemini", "GEMINI_AAIRIS_KEY"],
  ["Groq", "GROQ_AAIRIS_KEY"],
  ["Mistral", "MISTRAL_AAIRIS_KEY"],
  ["DeepSeek", "DEEPSEEK_AAIRIS_KEY"],
  ["OpenRouter", "OPENROUTER_AAIRIS_KEY"],
  ["Amazon Bedrock", "AWS_PROFILE / AWS credentials / AWS_BEARER_TOKEN_BEDROCK"],
  ["Azure OpenAI", "AZURE_OPENAI_AAIRIS_KEY"],
  ["Cloudflare", "CLOUDFLARE_AAIRIS_KEY and CLOUDFLARE_ACCOUNT_ID"],
  ["Cerebras", "CEREBRAS_AAIRIS_KEY"],
  ["xAI", "XAI_AAIRIS_KEY"],
  ["Fireworks", "FIREWORKS_AAIRIS_KEY"],
  ["Together AI", "TOGETHER_AAIRIS_KEY"],
  ["Kimi For Coding", "KIMI_AAIRIS_KEY"],
  ["MiniMax", "MINIMAX_AAIRIS_KEY"],
  ["NVIDIA NIM", "NVIDIA_AAIRIS_KEY"],
];

export const docs = [
  { title: "Installation Guide", href: "#installation", description: "Repository-backed install commands for Linux, macOS, Windows, and Termux." },
  { title: "Quick Start", href: "#quick-start", description: "Set an API key, launch interactive mode, run one-shot prompts, and continue sessions." },
  { title: "Command Explorer", href: "#commands", description: "Searchable command reference generated from CLI help and source." },
  { title: "Ship Workflow", href: "#workflow", description: "Full-lifecycle workflow phases from request through proof report." },
];

export const workflowPhases = ["Request", "Contract", "Approval", "Planning", "Implementation", "Formatting", "Testing", "Verification", "Proof", "Commit"];

export const terminalLines = [
  "$ airis",
  "$ airis -p \"List all TypeScript files in src/\"",
  "$ airis ship start \"Add a help command that shows usage examples\"",
  "$ airis mission \"Add tests\" --verified",
  "$ airis theme set graphite",
];
