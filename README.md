# AIRIS CLI

**Artificial Intelligence Responsive Integrated System** — A modern AI-powered command-line development assistant.

A local-first AI coding agent that runs in your terminal. Work with local files, shell commands, sessions, verified autonomy, and the `airis ship` workflow — all without sending your code to remote servers unless you choose a cloud provider.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22.19.0](https://img.shields.io/badge/node-%3E%3D22.19.0-green.svg)](https://nodejs.org)
[![Runs on Android](https://img.shields.io/badge/android-termux-orange.svg)](#android--termux)
[![CI](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/deploy-pages.yml/badge.svg)](https://sufiyan-sabeel.github.io/AIRIS-CLI/)

## Website

Visit the [AIRIS website](https://sufiyan-sabeel.github.io/AIRIS-CLI/) for documentation, guides, interactive demos, and the animated terminal preview.

## About the Creator

Created by **Umaiz Sufiyan**, a student developer and independent builder behind **KageOS**. He began building AIRIS at 15 and continues developing it at 16 with a focus on AI-powered command-line tools, automation, developer productivity, and mobile-first development.

## What AIRIS Does

AIRIS is a command-line AI assistant that operates directly on your local files and terminal. It reads code, executes shell commands, edits files, manages sessions, and provides verified autonomy capabilities — giving you an AI pair programmer that works where you work.

**The problem it solves:** Most AI coding tools require a specific IDE, a subscription, or send your code to third-party servers. AIRIS runs entirely in your terminal, works with any text editor, supports 30+ AI providers (including local models), and runs on Android phones via Termux.

## Why Android and Termux Support Matter

AIRIS is one of the few full-featured AI coding agents that runs natively on Android through Termux. This means you can:

- Write and debug code from your phone
- Automate Android device tasks via shell commands
- Use AI assistance anywhere without a laptop
- Run entirely offline with local models (Ollama, LM Studio)

## Verified Features

All features are verified from README, package metadata, source files, installation scripts, documentation, and `airis --help` output.

- **Interactive terminal UI** — Rich terminal interface with built-in themes, keyboard navigation, and animated command letter-by-letter typing
- **File operations** — Built-in tools: read, write, edit, grep, find, ls for project-aware file workflows
- **Shell execution** — Built-in bash tool with trust and approval controls around mutation-capable tools
- **Session management** — List, resume, continue, fork, name, store, clear, and export sessions from the CLI
- **30+ Provider selection** — Choose providers and models with `--provider`, `--model`, and `--list-models`
- **Verified Autonomy** — Mission contracts, capability leases, evidence reports, and failure search commands
- **`airis ship` workflow** — Start, resume, cancel, list, and report status for a full development lifecycle
- **Project trust** — Trust commands and per-run approval flags control project-local resources
- **Extensions and skills** — Load extension files, skills, prompt templates, themes, and package sources
- **Theme support** — Theme listing, setting, preview, custom theme file loading
- **Termux support** — Android Termux installation supported by the adaptive curl installer
- **Machine-readable modes** — `--mode json` or `--mode rpc` for machine-readable output and process integration

## Known Limitations

- No built-in sandbox -- AIRIS runs with your user permissions
- AI-generated code requires human review
- Android automation depends on Termux and device permissions
- Local model quality varies by hardware
- Some features (visual verification, Android Bridge) are planned but not yet implemented (see [ROADMAP.md](ROADMAP.md))

## Installation

### One-liner (Linux, macOS, Termux, proot-distro)

```bash
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh
```

The adaptive installer automatically detects your platform and installs AIRIS with the correct binary path (`$PREFIX/bin` on Termux, `/usr/local/bin` on Linux, `~/.local/bin` on macOS/non-root).

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
pkg update && pkg upgrade
pkg install curl tar
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh
airis --version
```

### proot-distro (Linux on Android)

```bash
apt update && apt install -y curl tar
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh
airis --version
```

### Requirements

- Node.js >= 22.19.0
- npm or yarn or pnpm
- Git (for building from source)

See [docs/installation.md](docs/installation.md) for detailed platform-specific instructions.

## Quick Start

```bash
# Set your API key (pick one provider)
export GEMINI_AAIRIS_KEY="your-key"
# or: export OPENAI_AAIRIS_KEY="your-key"
# or: export ANTHROPIC_AAIRIS_KEY="your-key"

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

AIRIS supports 30+ AI providers. Set the appropriate environment variable for your chosen provider:

| Provider | Environment Variable |
|----------|---------------------|
| Anthropic | `ANTHROPIC_AAIRIS_KEY` or `ANTHROPIC_OAUTH_TOKEN` |
| OpenAI | `OPENAI_AAIRIS_KEY` |
| Google Gemini | `GEMINI_AAIRIS_KEY` |
| Groq | `GROQ_AAIRIS_KEY` |
| Mistral | `MISTRAL_AAIRIS_KEY` |
| DeepSeek | `DEEPSEEK_AAIRIS_KEY` |
| OpenRouter | `OPENROUTER_AAIRIS_KEY` |
| Amazon Bedrock | `AWS_PROFILE` / `AWS_BEARER_TOKEN_BEDROCK` |
| Azure OpenAI | `AZURE_OPENAI_AAIRIS_KEY` |
| Cloudflare | `CLOUDFLARE_AAIRIS_KEY` + `CLOUDFLARE_ACCOUNT_ID` |
| Cerebras | `CEREBRAS_AAIRIS_KEY` |
| xAI | `XAI_AAIRIS_KEY` |
| Fireworks | `FIREWORKS_AAIRIS_KEY` |
| Together AI | `TOGETHER_AAIRIS_KEY` |
| Kimi For Coding | `KIMI_AAIRIS_KEY` |
| MiniMax | `MINIMAX_AAIRIS_KEY` |
| NVIDIA NIM | `NVIDIA_AAIRIS_KEY` |
| Ollama (local) | No key needed — start Ollama first |

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
  models.json      # Custom model definitions (including generated model registry)
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

AIRIS runs locally with your user permissions. It does not sandbox itself.

### Repository Security Controls

This repository enforces:
- **CODEOWNERS review** — all changes require admin (`@sufiyan-sabeel`) approval
- **Dependabot** — weekly automated security dependency scanning
- **Branch protection** — required reviews, status checks, and admin enforcement on `main`
- **Secret scanning** — push protection enabled for credentials and tokens

See [SECURITY.md](SECURITY.md) for the full security model, scope, and vulnerability reporting process.

### Safety for Contributors

**Never** include API keys, tokens, `.env` files, passwords, recovery codes, private keys, personal data, or unredacted configuration in public GitHub issues, pull requests, discussions, screenshots, logs, or AI prompts. Share the smallest reproducible example and redact all secrets.


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
**Built by:** Umaiz Sufiyan, KageOS
