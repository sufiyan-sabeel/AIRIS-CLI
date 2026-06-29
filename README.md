# AIRIS

**Artificial Intelligence Responsive Integrated System**

A local-first AI coding agent that runs in your terminal. Chat with AI models, edit files, run commands, and automate workflows -- all without sending your code to remote servers unless you choose a cloud provider.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22.19.0](https://img.shields.io/badge/node-%3E%3D22.19.0-green.svg)](https://nodejs.org)
[![Runs on Android](https://img.shields.io/badge/android-termux-orange.svg)](#android--termux)
[![CI](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml)
[![npm audit](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/npm-audit.yml/badge.svg)](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/npm-audit.yml)
[![Deploy to GitHub Pages](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/deploy-pages.yml/badge.svg)](https://sufiyan-sabeel.github.io/AIRIS-CLI/)

**Version:** 0.79.3 | **Brand:** KageOS | **Creator:** Umaiz Sufiyan

## Website

Visit the [AIRIS website](https://sufiyan-sabeel.github.io/AIRIS-CLI/) for documentation, guides, and interactive demos.

## About the Creator

AIRIS-CLI is created by Umaiz Sufiyan, a student developer and independent builder behind KageOS. He began building AIRIS at 15 and continues developing it at 16 with a focus on AI-powered command-line tools, automation, developer productivity, and mobile-first development.

## What AIRIS Does

AIRIS is a command-line AI assistant that operates directly on your local files and terminal. It reads code, executes shell commands, edits files, and manages sessions -- giving you an AI pair programmer that works where you work.

**The problem it solves:** Most AI coding tools require a specific IDE, a subscription, or send your code to third-party servers. AIRIS runs entirely in your terminal, works with any text editor, supports 30+ AI providers (including local models), and runs on Android phones via Termux.

## Why Android and Termux Support Matter

AIRIS is one of the few full-featured AI coding agents that runs natively on Android through Termux:

- Write and debug code from your phone
- Automate Android device tasks via shell commands
- Use AI assistance anywhere without a laptop
- Run entirely offline with local models (Ollama, LM Studio)

## Features

### Core

- **Interactive TUI** -- Rich terminal interface with 18 built-in themes, split panels, and keyboard navigation
- **File Operations** -- Read (`read`), edit (`edit`), write (`write`) files with AI guidance and diff review
- **Shell Execution** -- Run bash commands with approval-based safety controls
- **Search** -- Grep file contents, find files by glob, list directories
- **Session Management** -- Save, resume, fork, and export conversations to HTML

### AI Providers (30+)

| Provider | Env Variable |
|----------|-------------|
| Google Gemini | `GEMINI_API_KEY` |
| Anthropic Claude | `ANTHROPIC_API_KEY` |
| OpenAI GPT | `OPENAI_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Amazon Bedrock | `AWS_BEARER_TOKEN_BEDROCK` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` |
| Google Vertex AI | `GOOGLE_CLOUD_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| NVIDIA | `NVIDIA_API_KEY` |
| HuggingFace | `HF_TOKEN` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Moonshot AI | `MOONSHOT_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| Kimi | `KIMI_API_KEY` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` |
| Xiaomi | `XIAOMI_API_KEY` |
| Ollama (local) | No key needed |
| LM Studio (local) | No key needed |

### Verified Autonomy

- **Mission contracts** -- Scoped task definitions with acceptance criteria
- **Capability leases** -- Time-bounded permission grants
- **Evidence-backed verification** -- Structured proof-of-completion reports
- **Failure genome** -- Tracks and prevents repeated failed commands

### `airis ship` -- Full Development Workflow

Orchestrates an entire development task from request to proof:

```bash
airis ship start "Build a professional notes application with CRUD operations"
```

| Phase | Description |
|-------|-------------|
| Request | Accepts your task description |
| Contract | Generates a mission contract with acceptance criteria |
| Approval | You review and approve the contract |
| Planning | Creates a TODO list for tracking progress |
| Implementation | Code changes (manual or AI-assisted) |
| Formatting | Runs linters and type checks |
| Testing | Executes build and test suites |
| Verification | Evidence-backed acceptance criterion checks |
| Proof | Generates a proof report under `.airis/evidence/` |
| Commit | Optional commit or PR with your permission |

### Additional Features

- **Routing Modes** -- `@coding`, `@automation`, `@multiauto` prefixes for task-specific behavior
- **Extension System** -- Custom extensions, skills, and prompt templates (77 example extensions included)
- **Project Trust** -- Granular trust model: AIRIS asks before accessing project-local resources
- **Local Image Generation** -- Stable Diffusion support via `airis image generate`
- **Android Automation** -- ADB-based device control via `airis droid`
- **18 Themes** -- amber, amoled, catppuccin, classic, dark, dracula, graphite, gruvbox, light, matrix, minimal, monokai, nord, one-dark, rose-pine, solarized-dark, tokyo-night, warm

## Installation

### One-liner (Linux, macOS, Termux)

```bash
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh
```

### From npm

```bash
npm install -g @sufiyan-sabeel/airis-cli
```

### From source

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

> **Android/Termux:** Do not build from `/sdcard` or `/storage/emulated/0`. These paths use FAT32 which doesn't support symlinks. Clone to `~/AIRIS-CLI` instead:
> ```bash
> cd ~ && git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
> cd AIRIS-CLI && npm install --ignore-scripts && npm run build && npm link
> ```

### Android (Termux)

```bash
pkg update && pkg install nodejs git
npm install -g @sufiyan-sabeel/airis-cli
```

### Requirements

- Node.js >= 22.19.0
- npm
- Git (for building from source)

See [docs/installation.md](docs/installation.md) for detailed platform-specific instructions.

## Quick Start

```bash
# Set your API key (pick one provider)
export GEMINI_API_KEY="your-key"
# or: export OPENAI_API_KEY="your-key"
# or: export ANTHROPIC_API_KEY="your-key"

# Start interactive mode
airis

# One-shot prompt
airis -p "List all TypeScript files in src/"

# Continue your last session
airis --continue
```

## Commands

### Core

| Command | Description |
|---------|-------------|
| `airis` | Launch interactive TUI |
| `airis -p "prompt"` | One-shot non-interactive prompt |
| `airis chat` | Launch chat mode (alias) |
| `airis help [command]` | Show help |
| `airis version` | Show version and brand info |
| `airis changelog` | Show latest changelog entry |

### AI

| Command | Description |
|---------|-------------|
| `airis --provider <name>` | Select provider |
| `airis --model <pattern>` | Select model |
| `airis --list-models [search]` | List available models |
| `airis --thinking <level>` | Set thinking level (off/minimal/low/medium/high/xhigh) |

### `airis ship`

| Command | Description |
|---------|-------------|
| `airis ship start "task"` | Start full development workflow |
| `airis ship status [id]` | Show workflow status |
| `airis ship resume` | Resume interrupted workflow |
| `airis ship cancel` | Cancel active workflow |
| `airis ship list` | List all workflows |

### Sessions

| Command | Description |
|---------|-------------|
| `airis session list [--all]` | List sessions |
| `airis session resume <id>` | Resume a session |
| `airis session current` | Show current-project session |
| `airis session clear [--yes]` | Clear current-project sessions |
| `airis --continue` / `-c` | Continue previous session |
| `airis --resume` / `-r` | Select a session to resume |
| `airis --fork <path\|id>` | Fork a session |

### Verified Autonomy

| Command | Description |
|---------|-------------|
| `airis mission "task" --verified` | Create mission contract |
| `airis mission approve <id>` | Approve scope and create lease |
| `airis mission run <id>` | Run evidence-backed verification |
| `airis evidence show <id>` | Show proof-of-completion |
| `airis lease list` | List active capability leases |
| `airis failures search "err"` | Search failure genome records |

### Project Trust

| Command | Description |
|---------|-------------|
| `airis trust` | Trust current project folder |
| `airis trust list` | List saved trust decisions |
| `airis trust revoke <path>` | Remove a trust decision |
| `airis --approve` / `airis --no-approve` | Per-run trust override |

### Image Generation

| Command | Description |
|---------|-------------|
| `airis image setup --model sd15` | Download a local Diffusers model |
| `airis image generate "prompt"` | Generate a PNG locally |
| `airis image edit --input img.png --mask mask.png --prompt "edit"` | Inpainting |
| `airis image models` | List local image models |
| `airis image open-last` | Open last generated PNG |

### Android / Droid

| Command | Description |
|---------|-------------|
| `airis droid open settings` | Open Android settings via ADB |
| `airis droid read screen` | Read connected device screen text |
| `airis automation tap 360 800` | Automation command alias |

### Config & System

| Command | Description |
|---------|-------------|
| `airis config show/get/set/path` | Manage settings |
| `airis theme list/set <name>` | Theme management |
| `airis doctor` | Check runtime health |
| `airis update [source\|self]` | Update AIRIS and extensions |
| `airis tools list` | Detect companion CLIs |
| `airis tools doctor` | Diagnose companion tools |
| `airis install <source>` | Install extension |
| `airis remove <source>` | Remove extension |

See `airis --help` for the complete command reference with all flags.

## Monorepo Structure

```
packages/
  ai/           @earendil-works/airis-ai          Unified LLM API, 30+ providers
  agent/        @earendil-works/airis-agent-core  Agent with transport abstraction
  tui/          @earendil-works/airis-tui          Terminal UI library
  coding-agent/ @sufiyan-sabeel/airis-cli          CLI binary (the `airis` command)
```

Dependency chain: `coding-agent` -> `agent` -> `ai` -> `tui`

## Configuration

AIRIS stores configuration in `~/.airis/agent/`:

```
~/.airis/agent/
  auth.json        # Provider API keys
  settings.json    # User preferences (theme, provider, model, safeMode, telemetry)
  models.json      # Custom model definitions
  sessions/        # Saved conversations (JSONL)
  extensions/      # Custom extensions
  skills/          # Custom skills
  prompts/         # Prompt templates
  themes/          # Custom themes
  tools/           # Custom tools
```

Project-local state lives in `.airis/` within your repository:

```
.airis/
  ship/            # Ship workflow state
  evidence/        # Proof reports
  vision/          # Vision backend files
```

## Documentation

- [Installation Guide](docs/installation.md) -- Platform-specific instructions
- [Quick Start](docs/quick-start.md) -- Get running in 5 minutes
- [Verified Autonomy](AIRIS_VERIFIED_AUTONOMY.md) -- Mission contracts and evidence
- [Image Generation](AIRIS_IMAGE_GENERATION.md) -- Local image generation
- [Routing Modes](AIRIS_ROUTING_MODES.md) -- @coding, @automation, @multiauto
- [Roadmap](ROADMAP.md) -- Planned features by version
- [Contributing](CONTRIBUTING.md) -- How to contribute
- [Security Policy](SECURITY.md) -- Vulnerability reporting

## Development

```bash
# Setup
npm install --ignore-scripts
npm run build

# Quality checks
npm run check    # Lint, format, and type check
./test.sh        # Run tests
```

### npm Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build all packages (tui -> ai -> agent -> coding-agent) |
| `npm run check` | Biome lint + pinned deps + TS imports + shrinkwrap + type check |
| `npm test` | Run tests across all workspaces |
| `npm run release:patch` | Release patch version |
| `npm run release:minor` | Release minor version |
| `npm run release:local` | Build local release for smoke testing |

## Known Limitations

- No built-in sandbox -- AIRIS runs with your user permissions
- AI-generated code requires human review
- Android automation depends on Termux and device permissions
- Local model quality varies by hardware
- Some features (visual verification, Android Bridge) are planned but not yet implemented (see [ROADMAP.md](ROADMAP.md))

## Security

AIRIS runs locally with your user permissions. It does not sandbox itself. See [SECURITY.md](SECURITY.md) for the security model, scope, and vulnerability reporting process.

Never include API keys, tokens, or private session data in issues, PRs, or logs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process, quality bar, and approval workflow.

## About the Creator

AIRIS is created by Umaiz Sufiyan, a student developer and independent builder behind KageOS. He began building AIRIS at 15 and continues developing it at 16 with a focus on AI-powered command-line tools, automation, and developer productivity.

## License

MIT License. See [LICENSE](LICENSE) for details.

### Upstream Attribution

AIRIS is built on top of the following open-source projects:

- **opencode** -- Interactive CLI tool for software engineering (Apache 2.0). AIRIS extends opencode's agent architecture, TUI system, and verified autonomy framework. See the [opencode repository](https://github.com/anomalyco/opencode) for the original codebase.
- **Node.js** -- JavaScript runtime
- **TypeScript** -- Type-safe JavaScript
- **Vitest** -- Testing framework
- **Biome** -- Formatter and linter
- **Bun** -- Binary compilation target

AIRIS adds Android/Termux support, the `airis ship` workflow, provider routing, project trust, and mobile-first optimizations on top of the upstream foundation.

---

**AIRIS** -- Artificial Intelligence Responsive Integrated System
**Brand:** KageOS | **Creator:** Umaiz Sufiyan
