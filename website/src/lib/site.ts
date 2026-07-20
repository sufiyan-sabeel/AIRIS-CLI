import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Boxes,
  Braces,
  BrainCircuit,
  ClipboardCheck,
  Code2,
  FileCode2,
  GitBranch,
  Layers3,
  Palette,
  Plug,
  ShieldCheck,
  Smartphone,
  TerminalSquare,
  Workflow,
  Wrench,
  Sparkles,
  Network,
  Cpu,
  ScrollText,
} from "lucide-react";

export const siteConfig = {
  name: "AIRIS",
  cli: "airis",
  fullName: "Artificial Intelligence Responsive Integrated System",
  tagline: "The AI coding agent that lives in your terminal.",
  description:
    "AIRIS is a terminal-native AI coding agent and extensible CLI harness for coding, automation, and developer workflows. Runs locally, ships to your shell, and works everywhere — desktop, SSH, containers, and Android.",
  url: "https://airiscli.dev",
  repo: "https://github.com/sufiyan-sabeel/AIRIS-CLI",
  installUrl: "https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh",
  discord: "https://discord.com/invite/nKXTsAcmbT",
  version: "0.79.8",
  license: "MIT",
  nodeVersion: ">=22.19.0",
  packageName: "@sufiyan-sabeel/airis-cli",
  brand: "KageOS",
  creator: "Umaiz Sufiyan",
  theme: "graphite",
  primaryColor: "#60A5FA",
  accentColor: "#22D3EE",
};

export type NavItem = { label: string; href: string; external?: boolean };

export const navItems: NavItem[] = [
  { label: "Features", href: "/features" },
  { label: "Install", href: "/install" },
  { label: "Docs", href: "/docs" },
  { label: "Providers", href: "/providers" },
  { label: "Extensions", href: "/extensions" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Blog", href: "/blog" },
  { label: "GitHub", href: siteConfig.repo, external: true },
];

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  tag: string;
};

export const features: Feature[] = [
  {
    title: "Interactive terminal UI",
    description:
      "A conversational coding assistant that opens right in your shell — no IDE, no browser, no configuration ritual.",
    icon: TerminalSquare,
    tag: "Core",
  },
  {
    title: "One-shot prompt mode",
    description:
      "Pipe a question with airis -p and get a clean answer back. Perfect for scripts, git hooks, and quick lookups.",
    icon: Code2,
    tag: "Core",
  },
  {
    title: "File-aware prompting",
    description:
      "Point AIRIS at files and folders with @path and it reasons over your actual codebase, not a guess.",
    icon: FileCode2,
    tag: "Core",
  },
  {
    title: "Built-in tool belt",
    description:
      "read, bash, edit, and write come standard. Read-only helpers like grep, find, and ls engage only when you allow them.",
    icon: Wrench,
    tag: "Tools",
  },
  {
    title: "Session memory",
    description:
      "Save, resume, fork, rename, and export sessions. Pick up exactly where a previous run left off.",
    icon: GitBranch,
    tag: "Sessions",
  },
  {
    title: "Project trust controls",
    description:
      "Decide what AIRIS may touch per project. Trust commands and per-run approval flags keep you in control.",
    icon: ShieldCheck,
    tag: "Safety",
  },
  {
    title: "Multi-provider routing",
    description:
      "20+ providers behind one CLI. Switch models with --provider and --model, or discover them with --list-models.",
    icon: Bot,
    tag: "AI",
  },
  {
    title: "Verified autonomy",
    description:
      "Mission contracts, capability leases, evidence reports, and a failure genome — autonomous work you can audit.",
    icon: ClipboardCheck,
    tag: "Autonomy",
  },
  {
    title: "Ship workflow",
    description:
      "airis ship runs a full development lifecycle: contract, plan, implement, verify, and hand you a proof report.",
    icon: Layers3,
    tag: "Workflow",
  },
  {
    title: "Extensions & skills",
    description:
      "Load TypeScript extensions with lifecycle hooks and custom tools, plus on-demand Agent Skills packages.",
    icon: Plug,
    tag: "Extensible",
  },
  {
    title: "Themeable interface",
    description:
      "A 51-token theme system with graphite and light built in. Author your own JSON theme in minutes.",
    icon: Palette,
    tag: "UI",
  },
  {
    title: "Android & Termux",
    description:
      "Built mobile-first. Run AIRIS in Termux, drive devices over ADB, and automate via Termux:API.",
    icon: Smartphone,
    tag: "Mobile",
  },
];

export type InstallMethod = {
  id: string;
  label: string;
  description: string;
  commands: string[];
  note?: string;
};

export const installMethods: InstallMethod[] = [
  {
    id: "script",
    label: "Install script",
    description: "One line. Downloads the latest release for your platform.",
    commands: ["curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash"],
    note: "Set VERSION=vX.Y.Z to pin a release.",
  },
  {
    id: "npm",
    label: "npm",
    description: "Grab the published package globally.",
    commands: ["npm install -g --ignore-scripts @sufiyan-sabeel/airis-cli", "airis --version"],
  },
  {
    id: "source",
    label: "From source",
    description: "Clone, build the monorepo, and link the CLI.",
    commands: [
      "git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git",
      "cd AIRIS-CLI",
      "npm install --ignore-scripts --no-audit --no-fund",
      "npm run build",
      "npm link",
    ],
  },
  {
    id: "termux",
    label: "Termux (Android)",
    description: "Mobile terminal support, straight from F-Droid.",
    commands: [
      "pkg update && pkg upgrade",
      "pkg install nodejs git termux-api",
      "npm install -g @sufiyan-sabeel/airis-cli",
      "airis --version",
    ],
  },
];

export type Provider = { name: string; env: string; kind: string };

export const providers: Provider[] = [
  { name: "Anthropic", env: "ANTHROPIC_AAIRIS_KEY", kind: "Cloud" },
  { name: "OpenAI", env: "OPENAI_AAIRIS_KEY", kind: "Cloud" },
  { name: "Google Gemini", env: "GEMINI_AAIRIS_KEY", kind: "Cloud" },
  { name: "Groq", env: "GROQ_AAIRIS_KEY", kind: "Cloud" },
  { name: "Mistral", env: "MISTRAL_AAIRIS_KEY", kind: "Cloud" },
  { name: "DeepSeek", env: "DEEPSEEK_AAIRIS_KEY", kind: "Cloud" },
  { name: "OpenRouter", env: "OPENROUTER_AAIRIS_KEY", kind: "Cloud" },
  { name: "Amazon Bedrock", env: "AWS_PROFILE / credentials", kind: "Cloud" },
  { name: "Azure OpenAI", env: "AZURE_OPENAI_AAIRIS_KEY", kind: "Cloud" },
  { name: "Cloudflare", env: "CLOUDFLARE_AAIRIS_KEY", kind: "Cloud" },
  { name: "Cerebras", env: "CEREBRAS_AAIRIS_KEY", kind: "Cloud" },
  { name: "xAI (Grok)", env: "XAI_AAIRIS_KEY", kind: "Cloud" },
  { name: "Fireworks", env: "FIREWORKS_AAIRIS_KEY", kind: "Cloud" },
  { name: "Together AI", env: "TOGETHER_AAIRIS_KEY", kind: "Cloud" },
  { name: "NVIDIA NIM", env: "NVIDIA_AAIRIS_KEY", kind: "Cloud" },
  { name: "Ollama", env: "OLLAMA_BASE_URL", kind: "Local" },
  { name: "LM Studio", env: "models.json", kind: "Local" },
  { name: "vLLM", env: "models.json", kind: "Local" },
];

export type Extension = {
  name: string;
  summary: string;
  icon: LucideIcon;
  status: "Stable" | "Beta" | "Experimental";
  tags: string[];
};

export const extensions: Extension[] = [
  {
    name: "adb-automation",
    summary:
      "Drive Android devices over ADB. Tap, swipe, type, screenshot, and read UI hierarchy from inside a session.",
    icon: Smartphone,
    status: "Stable",
    tags: ["android", "automation"],
  },
  {
    name: "termux-api",
    summary:
      "Bridge Termux:API capabilities — notifications, TTS, clipboard, camera, and sensors — into agent workflows.",
    icon: Cpu,
    status: "Stable",
    tags: ["termux", "mobile"],
  },
  {
    name: "redraws",
    summary:
      "Custom TUI redraw hooks for adaptive, width-aware rendering on tiny and ultrawide terminals alike.",
    icon: Sparkles,
    status: "Beta",
    tags: ["tui", "ui"],
  },
  {
    name: "prompt-url-widget",
    summary:
      "A contextual widget that surfaces prompt templates and links directly in the terminal interface.",
    icon: Boxes,
    status: "Beta",
    tags: ["tui", "productivity"],
  },
  {
    name: "ml-brain",
    summary:
      "Optional local reasoning layer for offline classification and routing of routine requests.",
    icon: BrainCircuit,
    status: "Experimental",
    tags: ["local", "ml"],
  },
  {
    name: "tps",
    summary:
      "Tokens-per-second instrumentation that profiles model throughput across providers in real time.",
    icon: Network,
    status: "Beta",
    tags: ["observability"],
  },
];

export type RoadmapMilestone = {
  version: string;
  status: "Shipped" | "In progress" | "Planned";
  title: string;
  points: string[];
};

export const roadmap: RoadmapMilestone[] = [
  {
    version: "v0.79",
    status: "Shipped",
    title: "Stable foundation",
    points: [
      "Adaptive terminal UI with width breakpoints",
      "Project trust and per-run approval flags",
      "Session fork, resume, and export",
      "Verified autonomy primitives (missions, evidence, leases)",
    ],
  },
  {
    version: "v0.80",
    status: "In progress",
    title: "Reliable core",
    points: [
      "Doc doctor and self-diagnostics",
      "Ship workflow end to end",
      "Adaptive brain routing",
      "Provider model discovery polish",
    ],
  },
  {
    version: "v0.85",
    status: "Planned",
    title: "Smarter routing",
    points: [
      "Model router with cost/latency awareness",
      "Privacy firewall for secret redaction",
      "Repository intelligence index",
    ],
  },
  {
    version: "v0.90",
    status: "Planned",
    title: "Visual & mobile",
    points: [
      "Visual verification of UI changes",
      "Android bridge improvements",
      "Local automation toolkit",
    ],
  },
  {
    version: "v1.0",
    status: "Planned",
    title: "Production ready",
    points: [
      "Stability and performance hardening",
      "Comprehensive documentation",
      "Long-term support guarantee",
    ],
  },
  {
    version: "v2.0",
    status: "Planned",
    title: "Beyond the terminal",
    points: [
      "Optional AIRIS Cloud sync",
      "Team collaboration",
      "Enterprise tooling",
    ],
  },
];

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readingTime: string;
  category: string;
  icon: LucideIcon;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "introducing-airis-0-80",
    title: "AIRIS 0.80: the road to a reliable core",
    excerpt:
      "A look at the stability work landing in the next milestone — adaptive UI, the ship workflow, and verified autonomy.",
    date: "2026-04-18",
    readingTime: "6 min read",
    category: "Release",
    icon: Sparkles,
  },
  {
    slug: "verified-autonomy-explained",
    title: "Verified autonomy, without giving up control",
    excerpt:
      "Missions, leases, and evidence reports: how AIRIS makes autonomous work something you can actually audit.",
    date: "2026-03-30",
    readingTime: "9 min read",
    category: "Deep dive",
    icon: ClipboardCheck,
  },
  {
    slug: "running-airis-on-termux",
    title: "A real coding agent in your pocket",
    excerpt:
      "Step-by-step setup for running AIRIS inside Termux on Android, plus ADB automation tricks.",
    date: "2026-03-12",
    readingTime: "7 min read",
    category: "Guide",
    icon: Smartphone,
  },
  {
    slug: "writing-your-first-extension",
    title: "Write your first AIRIS extension in 10 minutes",
    excerpt:
      "Register a custom tool, hook into the agent loop, and ship a TypeScript plugin the agent can load on demand.",
    date: "2026-02-22",
    readingTime: "8 min read",
    category: "Tutorial",
    icon: Wrench,
  },
];

export type CliCommand = {
  command: string;
  description: string;
  usage: string;
  category: string;
};

export const cliCommands: CliCommand[] = [
  { command: "airis", description: "Launch interactive AIRIS.", usage: "airis [options] [@files...] [messages...]", category: "Core" },
  { command: "airis -p", description: "Run a one-shot prompt and exit.", usage: 'airis -p "prompt"', category: "Core" },
  { command: "airis --provider", description: "Select an AI provider.", usage: "airis --provider <name>", category: "AI" },
  { command: "airis --model", description: "Select a model pattern.", usage: "airis --model <pattern>", category: "AI" },
  { command: "airis --list-models", description: "List available models.", usage: "airis --list-models [search]", category: "AI" },
  { command: "airis trust", description: "Trust the current project.", usage: "airis trust", category: "Project" },
  { command: "airis mission", description: "Create a scoped mission contract.", usage: 'airis mission "task" --verified', category: "Autonomy" },
  { command: "airis evidence show", description: "Show proof of completion.", usage: "airis evidence show <id>", category: "Autonomy" },
  { command: "airis ship start", description: "Start a development workflow.", usage: 'airis ship start "task"', category: "Workflow" },
  { command: "airis session list", description: "List saved sessions.", usage: "airis session list [--all]", category: "Sessions" },
  { command: "airis config set", description: "Write a config value.", usage: "airis config set <key> <val>", category: "Config" },
  { command: "airis theme set", description: "Apply a theme.", usage: "airis theme set graphite", category: "Config" },
  { command: "airis doctor", description: "Check runtime health.", usage: "airis doctor", category: "System" },
  { command: "airis --extension", description: "Load an extension.", usage: "airis --extension <path>", category: "Developer" },
];

export const architectureLayers = [
  {
    name: "Interface",
    icon: TerminalSquare,
    detail: "Adaptive terminal UI (TUI) with width-aware layouts.",
  },
  {
    name: "Agent Core",
    icon: BrainCircuit,
    detail: "Transport abstraction, state, and attachment handling.",
  },
  {
    name: "Tool Layer",
    icon: Wrench,
    detail: "read, bash, edit, write, plus read-only helpers.",
  },
  {
    name: "Provider Layer",
    icon: Bot,
    detail: "Unified streaming API across 20+ providers and local models.",
  },
  {
    name: "Extension Runtime",
    icon: Plug,
    detail: "Lifecycle hooks, custom tools, and slash commands.",
  },
];

export const commands = cliCommands;
export const HeroIcon = Braces;
export const WorkflowIcon = Workflow;
export const ScrollIcon = ScrollText;
