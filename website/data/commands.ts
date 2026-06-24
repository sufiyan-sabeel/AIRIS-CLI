export interface Command {
  command: string;
  description: string;
  category: "core" | "session" | "provider" | "ship" | "config";
}

export const commands: Command[] = [
  {
    command: "airis",
    description: "Launch interactive mode",
    category: "core",
  },
  {
    command: 'airis -p "prompt"',
    description: "Non-interactive prompt mode",
    category: "core",
  },
  {
    command: "airis --continue",
    description: "Continue your last session",
    category: "session",
  },
  {
    command: "airis --resume",
    description: "Pick and resume a saved session",
    category: "session",
  },
  {
    command: "airis sessions",
    description: "List recent sessions",
    category: "session",
  },
  {
    command: "airis ship start \"task\"",
    description: "Start full development workflow",
    category: "ship",
  },
  {
    command: "airis ship status",
    description: "Check workflow status",
    category: "ship",
  },
  {
    command: "airis ship resume",
    description: "Resume an interrupted workflow",
    category: "ship",
  },
  {
    command: "airis ship list",
    description: "List all workflows",
    category: "ship",
  },
  {
    command: "airis --provider <name>",
    description: "Set provider (google, anthropic, openai...)",
    category: "provider",
  },
  {
    command: "airis --model <pattern>",
    description: "Use specific model (supports glob/fuzzy)",
    category: "provider",
  },
  {
    command: "airis --list-models",
    description: "List all available models",
    category: "provider",
  },
  {
    command: "airis --thinking <level>",
    description: "Thinking level: off/minimal/low/medium/high",
    category: "config",
  },
  {
    command: "airis --tools <list>",
    description: "Enable specific tools (read, bash, edit, write...)",
    category: "config",
  },
  {
    command: "airis --no-tools",
    description: "Disable all tools (read-only mode)",
    category: "config",
  },
  {
    command: "airis trust",
    description: "Trust current folder for project-local resources",
    category: "config",
  },
  {
    command: "airis doctor",
    description: "Check runtime health and diagnostics",
    category: "config",
  },
  {
    command: "airis theme set <name>",
    description: "Set theme (20 built-in themes)",
    category: "config",
  },
  {
    command: "airis --export <file>",
    description: "Export session to HTML",
    category: "session",
  },
  {
    command: 'airis mission "task" --verified',
    description: "Create scoped mission contract",
    category: "ship",
  },
  {
    command: "airis --version",
    description: "Show version",
    category: "config",
  },
  {
    command: "airis --help",
    description: "Full help with all options",
    category: "config",
  },
];

export const commandCategories = [
  { id: "all", label: "All" },
  { id: "core", label: "Core" },
  { id: "session", label: "Session" },
  { id: "provider", label: "Provider" },
  { id: "ship", label: "Ship" },
  { id: "config", label: "Config" },
] as const;
