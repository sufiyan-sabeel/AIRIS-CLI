import {
  Bot,
  Braces,
  Camera,
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
    description: "Rich terminal interface with 18 built-in themes, split panels, and keyboard navigation.",
    icon: TerminalSquare,
    evidence: "README: Interactive TUI with 18 themes; `airis theme list`",
  },
  {
    title: "File operations and shell",
    description: "7 built-in tools: read, bash, edit, write, grep, find, and ls for project-aware file workflows and shell execution.",
    icon: FileCode2,
    evidence: "CLI help: Built-in Tool Names (read, bash, edit, write, grep, find, ls)",
  },
  {
    title: "Session management",
    description: "List, resume, continue, fork, name, store, clear, and export sessions to HTML.",
    icon: GitBranch,
    evidence: "CLI help: Sessions and session options",
  },
  {
    title: "30+ AI providers",
    description: "Google Gemini, Anthropic, OpenAI, Groq, Mistral, DeepSeek, OpenRouter, Ollama, and more.",
    icon: Bot,
    evidence: "README: 30+ providers; packages/ai/src/env-api-keys.ts (35+ provider IDs)",
  },
  {
    title: "Verified Autonomy",
    description: "Mission contracts, capability leases, evidence-backed verification, and failure genome tracking.",
    icon: ClipboardCheck,
    evidence: "CLI help: Verified Autonomy section",
  },
  {
    title: "Ship workflow",
    description: "`airis ship` orchestrates request, contract, approval, planning, implementation, launch, verification, proof, and commit.",
    icon: Layers3,
    evidence: "CLI help and packages/coding-agent/src/core/ship/types.ts (11 phases)",
  },
  {
    title: "Project trust",
    description: "Granular trust model: AIRIS asks before accessing project-local resources and mutation tools.",
    icon: ShieldCheck,
    evidence: "CLI help: Project section",
  },
  {
    title: "Extensions and skills",
    description: "Load custom extensions, skills, prompt templates, themes, and package sources (77 example extensions).",
    icon: Wrench,
    evidence: "CLI help: Developer, Config, Tools sections",
  },
  {
    title: "18 themes",
    description: "amber, amoled, catppuccin, classic, dark, dracula, graphite, gruvbox, light, matrix, minimal, monokai, nord, one-dark, rose-pine, solarized-dark, tokyo-night, warm.",
    icon: Palette,
    evidence: "README: 18 themes; `airis theme list`",
  },
  {
    title: "Local image generation",
    description: "Generate images locally with Stable Diffusion models via `airis image generate`.",
    icon: Camera,
    evidence: "README: Image Generation section; `airis image` commands",
  },
  {
    title: "Android automation",
    description: "ADB-based device control: tap, read screen, open settings via `airis droid` commands.",
    icon: Smartphone,
    evidence: "README: Android/Termux support; `airis droid` commands",
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
  category: "Core" | "AI" | "Project" | "Verified Autonomy" | "Ship" | "Sessions" | "Vision" | "Droid" | "Config" | "Tools" | "System" | "Developer" | "Experimental";
};

export const commands: Command[] = [
  { command: "airis", description: "Launch interactive AIRIS TUI.", usage: "airis [options] [@files...] [messages...]", examples: ["airis", "airis \"Review this project\""], category: "Core" },
  { command: "airis chat", description: "Launch chat mode as an alias.", usage: "airis chat", examples: ["airis chat"], category: "Core" },
  { command: "airis help", description: "Show help, optionally for a command.", usage: "airis help [command]", examples: ["airis help", "airis help session"], category: "Core" },
  { command: "airis version", description: "Show version and brand metadata.", usage: "airis version", examples: ["airis version"], category: "Core" },
  { command: "airis changelog", description: "Show the latest changelog entry.", usage: "airis changelog", examples: ["airis changelog"], category: "Core" },
  { command: "airis -p", description: "Run one-shot prompt mode (non-interactive).", usage: "airis -p \"prompt\"", examples: ["airis -p \"Summarize package.json\""], category: "AI" },
  { command: "airis --provider", description: "Select AI provider.", usage: "airis --provider <name>", examples: ["airis --provider anthropic -p \"Explain this code\""], category: "AI" },
  { command: "airis --model", description: "Select model or provider/model.", usage: "airis --model <pattern>", examples: ["airis --model anthropic/*sonnet*"], category: "AI" },
  { command: "airis --list-models", description: "List configured models with optional search.", usage: "airis --list-models [search]", examples: ["airis --list-models", "airis --list-models gemini"], category: "AI" },
  { command: "airis --thinking", description: "Set thinking level.", usage: "airis --thinking <level>", examples: ["airis --thinking high"], category: "AI" },
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
  { command: "airis --continue", description: "Continue previous session.", usage: "airis --continue", examples: ["airis --continue"], category: "Sessions" },
  { command: "airis --resume", description: "Select a session to resume.", usage: "airis --resume", examples: ["airis --resume"], category: "Sessions" },
  { command: "airis --fork", description: "Fork a session into a new one.", usage: "airis --fork <path|id>", examples: ["airis --fork abc123"], category: "Sessions" },
  { command: "airis image setup", description: "Download a local Diffusers model.", usage: "airis image setup --model sd15", examples: ["airis image setup --model sd15"], category: "Vision" },
  { command: "airis image generate", description: "Generate a PNG image locally.", usage: "airis image generate \"prompt\"", examples: ["airis image generate \"a sunset over mountains\""], category: "Vision" },
  { command: "airis image edit", description: "Inpainting with mask.", usage: "airis image edit --input img.png --mask mask.png --prompt \"edit\"", examples: ["airis image edit --input photo.png --mask area.png --prompt \"add a tree\""], category: "Vision" },
  { command: "airis image models", description: "List local image models.", usage: "airis image models", examples: ["airis image models"], category: "Vision" },
  { command: "airis image open-last", description: "Open last generated PNG.", usage: "airis image open-last", examples: ["airis image open-last"], category: "Vision" },
  { command: "airis droid open", description: "Open Android settings via ADB.", usage: "airis droid open settings", examples: ["airis droid open settings"], category: "Droid" },
  { command: "airis droid read", description: "Read connected device screen text.", usage: "airis droid read screen", examples: ["airis droid read screen"], category: "Droid" },
  { command: "airis automation", description: "Run automation commands via ADB.", usage: "airis automation tap 360 800", examples: ["airis automation tap 360 800"], category: "Droid" },
  { command: "airis config show", description: "Show sanitized config.", usage: "airis config show", examples: ["airis config show"], category: "Config" },
  { command: "airis config get", description: "Read config value.", usage: "airis config get <key>", examples: ["airis config get theme"], category: "Config" },
  { command: "airis config set", description: "Write config value.", usage: "airis config set <key> <val>", examples: ["airis config set theme graphite"], category: "Config" },
  { command: "airis config path", description: "Show settings path.", usage: "airis config path", examples: ["airis config path"], category: "Config" },
  { command: "airis theme list", description: "List available themes.", usage: "airis theme list", examples: ["airis theme list"], category: "Config" },
  { command: "airis theme set", description: "Set a theme.", usage: "airis theme set <name>", examples: ["airis theme set graphite"], category: "Config" },
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
  { command: "airis --models", description: "Limit model cycling with glob patterns.", usage: "airis --models <patterns>", examples: ["airis --models \"anthropic/*sonnet*\""], category: "Experimental" },
];

export const commandCategories = ["All", "Core", "AI", "Project", "Verified Autonomy", "Ship", "Sessions", "Vision", "Droid", "Config", "Tools", "System", "Developer", "Experimental"] as const;

export const installSections = [
  {
    platform: "Linux",
    commands: [
      "curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh",
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
    platform: "Windows (WSL)",
    commands: [
      "curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh",
      "git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git\ncd AIRIS-CLI\nnpm install --ignore-scripts --no-audit --no-fund\nnpm run build\nnpm link",
    ],
  },
  {
    platform: "Termux (Android)",
    commands: [
      "pkg update && pkg upgrade\npkg install nodejs git\nnpm install -g @sufiyan-sabeel/airis-cli\nairis --version",
    ],
  },
];

export const providers = [
  ["Anthropic", "ANTHROPIC_API_KEY or ANTHROPIC_OAUTH_TOKEN"],
  ["OpenAI", "OPENAI_API_KEY"],
  ["Google Gemini", "GEMINI_API_KEY"],
  ["Google Vertex AI", "GOOGLE_CLOUD_API_KEY or ADC"],
  ["Groq", "GROQ_API_KEY"],
  ["Mistral", "MISTRAL_API_KEY"],
  ["DeepSeek", "DEEPSEEK_API_KEY"],
  ["OpenRouter", "OPENROUTER_API_KEY"],
  ["Amazon Bedrock", "AWS_PROFILE / AWS_BEARER_TOKEN_BEDROCK"],
  ["Azure OpenAI", "AZURE_OPENAI_API_KEY"],
  ["Cloudflare Workers AI", "CLOUDFLARE_API_KEY"],
  ["Cerebras", "CEREBRAS_API_KEY"],
  ["xAI", "XAI_API_KEY"],
  ["GitHub Copilot", "COPILOT_GITHUB_TOKEN"],
  ["Fireworks", "FIREWORKS_API_KEY"],
  ["Together AI", "TOGETHER_API_KEY"],
  ["HuggingFace", "HF_TOKEN"],
  ["Kimi", "KIMI_API_KEY"],
  ["MiniMax", "MINIMAX_API_KEY"],
  ["Moonshot AI", "MOONSHOT_API_KEY"],
  ["NVIDIA NIM", "NVIDIA_API_KEY"],
  ["Vercel AI Gateway", "AI_GATEWAY_API_KEY"],
  ["ZAI", "ZAI_API_KEY"],
  ["Ant Ling", "ANT_LING_API_KEY"],
  ["OpenCode", "OPENCODE_API_KEY"],
  ["Xiaomi", "XIAOMI_API_KEY"],
  ["Ollama (local)", "No key needed -- start Ollama first"],
  ["LM Studio (local)", "No key needed -- start LM Studio first"],
];

export const docs = [
  { title: "Installation Guide", href: "#installation", description: "Repository-backed install commands for Linux, macOS, Windows (WSL), and Termux." },
  { title: "Quick Start", href: "#quick-start", description: "Set an API key, launch interactive mode, run one-shot prompts, and continue sessions." },
  { title: "Command Explorer", href: "#commands", description: "Searchable command reference with 50+ commands across 12 categories." },
  { title: "Ship Workflow", href: "#workflow", description: "Full-lifecycle workflow phases from request through proof report." },
  { title: "Providers", href: "#providers", description: "28+ AI providers including local models (Ollama, LM Studio)." },
];

export const workflowPhases = ["Request", "Contract", "Approval", "Planning", "Implementation", "Formatting", "Testing", "Launch", "Verification", "Proof", "Commit"];

export const terminalLines = [
  "$ airis",
  "$ airis -p \"List all TypeScript files in src/\"",
  "$ airis ship start \"Add a help command with usage examples\"",
  "$ airis mission \"Add tests\" --verified",
  "$ airis image generate \"a sunset over mountains\"",
  "$ airis theme set tokyo-night",
];
