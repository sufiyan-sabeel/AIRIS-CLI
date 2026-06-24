# AIRIS

**Artificial Intelligence Responsive Integrated System**

A local-first AI coding agent that runs in your terminal. Chat with AI models, edit files, run commands, and automate workflows -- all without sending your code to remote servers unless you choose a cloud provider.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22.19.0](https://img.shields.io/badge/node-%3E%3D22.19.0-green.svg)](https://nodejs.org)
[![Runs on Android](https://img.shields.io/badge/android-termux-orange.svg)](#android--termux)

## What AIRIS Does

AIRIS is a command-line AI assistant that operates directly on your local files and terminal. It reads code, executes shell commands, edits files, and manages sessions -- giving you an AI pair programmer that works where you work.

**The problem it solves:** Most AI coding tools require a specific IDE, a subscription, or send your code to third-party servers. AIRIS runs entirely in your terminal, works with any text editor, supports 25+ AI providers (including local models), and runs on Android phones via Termux.

## Why Android and Termux Support Matter

AIRIS is one of the few full-featured AI coding agents that runs natively on Android through Termux. This means you can:

- Write and debug code from your phone
- Automate Android device tasks via shell commands
- Use AI assistance anywhere without a laptop
- Run entirely offline with local models (Ollama, LM Studio)

## Verified Features

- **Interactive TUI** -- Rich terminal interface with 14 built-in themes, split panels, and keyboard navigation
- **File Operations** -- Read, edit, and write files with AI guidance and diff review
- **Shell Execution** -- Run bash commands with approval-based safety controls
- **Session Management** -- Save, resume, fork, and export conversations to HTML
- **25+ Providers** -- OpenAI, Anthropic, Google Gemini, Groq, Mistral, DeepSeek, Ollama, and more
- **Project Trust** -- Granular trust model: AIRIS asks before accessing project-local resources
- **Verified Autonomy** -- Mission contracts with evidence-backed completion proofs
- **`airis ship`** -- Full-lifecycle development workflow with TODO tracking and proof reports
- **Routing Modes** -- `@coding`, `@automation`, `@multiauto` prefixes for task-specific behavior
- **Extension System** -- Custom extensions, skills, and prompt templates
- **Smart Routing** -- Automatic tool selection based on task type

## Known Limitations

- No built-in sandbox -- AIRIS runs with your user permissions
- AI-generated code requires human review
- Android automation depends on Termux and device permissions
- Local model quality varies by hardware
- Some features (visual verification, Android Bridge) are planned but not yet implemented (see [ROADMAP.md](ROADMAP.md))

## Installation

### One-liner (Linux, macOS, Termux)

```bash
curl -fsSL https://airis-dev.netlify.app/install.sh | sh
```

### From source

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

### Android (Termux)

```bash
pkg update && pkg install nodejs git
npm install -g @sufiyan-sabeel/airis-cli
```

### Requirements

- Node.js >= 22.19.0
- npm or yarn or pnpm
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

## `airis ship` -- Full Development Workflow

The `airis ship` command orchestrates an entire development task from request to proof:

```bash
airis ship start "Build a professional notes application with CRUD operations"
```

**What it does:**

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

```bash
# Check workflow status
airis ship status

# Resume an interrupted workflow
airis ship resume

# Cancel a workflow
airis ship cancel

# List all workflows
airis ship list
```

Interrupted workflows persist in `.airis/ship/` and can be resumed at any time. See [docs/airis-ship.md](docs/airis-ship.md) for the complete reference.

## Providers and Local Models

AIRIS supports 25+ AI providers. Set the appropriate environment variable for your chosen provider:

| Provider | Environment Variable |
|----------|---------------------|
| Google Gemini | `GEMINI_API_KEY` |
| Anthropic Claude | `ANTHROPIC_API_KEY` |
| OpenAI GPT | `OPENAI_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Amazon Bedrock | `AWS_BEARER_TOKEN_BEDROCK` |
| Ollama (local) | No key needed -- start Ollama first |

```bash
# Use a specific provider and model
airis --provider anthropic --model claude-sonnet-4-20250514 -p "Explain this code"

# List all available models
airis --list-models
```

## Screenshots

The AIRIS terminal UI features a responsive layout with theme support:

- **Orange welcome screen** with project info and quick-start guidance
- **Adaptive TODO panel** tracking ship workflow progress
- **Permission dialogs** for trust and dangerous operations
- **Diff review** showing file changes before applying
- **Proof reports** with pass/fail status for each requirement

```bash
# Set a theme
airis theme set graphite
airis theme set dracula
airis theme set tokyo-night
```

## Commands

| Command | Description |
|---------|-------------|
| `airis` | Launch interactive mode |
| `airis -p "prompt"` | Non-interactive prompt mode |
| `airis ship start "task"` | Start full development workflow |
| `airis mission "task" --verified` | Create scoped mission contract |
| `airis trust` | Trust current project folder |
| `airis doctor` | Check runtime health |
| `airis sessions` | List recent sessions |
| `airis --list-models` | List available models |
| `airis --help` | Full help with all options |

See `airis --help` for the complete command reference.

## Configuration

AIRIS stores configuration in `~/.airis/agent/`:

```
~/.airis/agent/
  auth.json        # Provider API keys
  settings.json    # User preferences
  models.json      # Custom model definitions
  sessions/        # Saved conversations
  extensions/      # Custom extensions
  skills/          # Custom skills
```

Project-local state lives in `.airis/` within your repository.

## Documentation

- [Installation Guide](docs/installation.md) -- Platform-specific install instructions
- [Quick Start](docs/quick-start.md) -- Get running in 5 minutes
- [airis ship Reference](docs/airis-ship.md) -- Complete ship workflow docs
- [Verified Autonomy](AIRIS_VERIFIED_AUTONOMY.md) -- Mission contracts and evidence
- [Roadmap](ROADMAP.md) -- Planned features by version
- [Contributing](CONTRIBUTING.md) -- How to contribute
- [Security Policy](SECURITY.md) -- Vulnerability reporting

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process, quality bar, and approval workflow.

```bash
# Development setup
npm install
npm run build
npm run check    # Lint, format, and type check
./test.sh        # Run tests
```

## Security

AIRIS runs locally with your user permissions. It does not sandbox itself. See [SECURITY.md](SECURITY.md) for the security model, scope, and vulnerability reporting process.

Never include API keys, tokens, or private session data in issues, PRs, or logs.

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
