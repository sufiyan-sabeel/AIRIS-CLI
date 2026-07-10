# AIRIS-CLI

<p align="center">
  <img src="website/public/airis-logo.svg" alt="AIRIS logo" width="120" />
</p>

<p align="center">
  <strong>Artificial Intelligence Responsive Integrated System</strong><br />
  AI-powered terminal assistant for coding, automation, and developer workflows.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <a href="https://nodejs.org"><img alt="Node.js >=22.19.0" src="https://img.shields.io/badge/node-%3E%3D22.19.0-green.svg" /></a>
  <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/npm-audit.yml"><img alt="npm audit" src="https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/npm-audit.yml/badge.svg" /></a>
  <a href="https://sufiyan-sabeel.github.io/AIRIS-CLI/"><img alt="GitHub Pages" src="https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/deploy-pages.yml/badge.svg" /></a>
</p>

```bash
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash
```

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Installation](#installation)
  - [Requirements](#requirements)
  - [Binary Installer](#binary-installer)
  - [From Source](#from-source)
  - [npm](#npm)
- [CLI Commands](#cli-commands)
- [Configuration](#configuration)
  - [User and Project Paths](#user-and-project-paths)
  - [Settings](#settings)
  - [Environment Variables](#environment-variables)
- [AI Providers](#ai-providers)
  - [Built-in API Providers](#built-in-api-providers)
  - [Provider Credentials](#provider-credentials)
  - [Custom Providers](#custom-providers)
  - [Local Models](#local-models)
- [Extensions](#extensions)
- [Skills](#skills)
- [Themes](#themes)
- [Android / Termux](#android--termux)
- [Automation](#automation)
  - [ADB Automation](#adb-automation)
  - [Termux:API](#termuxapi)
- [Project Architecture](#project-architecture)
  - [Directory Structure](#directory-structure)
  - [Packages](#packages)
- [Development](#development)
  - [Setup](#setup)
  - [Build](#build)
  - [Testing](#testing)
  - [CI / CD](#ci--cd)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Credits](#credits)

---

## Overview

AIRIS-CLI is a terminal-based AI coding agent and extensible command-line harness. It runs in your local terminal, works with files and shell commands in your workspace, supports interactive and one-shot prompt modes, and provides structured workflows for longer development tasks.

AIRIS does not require a specific IDE. It is designed for regular shells, SSH sessions, tmux, containers, desktop terminals, and Android environments through Termux.

| Field | Value |
| --- | --- |
| CLI package | `@sufiyan-sabeel/airis-cli` |
| Version | `0.79.8` |
| Command | `airis` |
| Runtime | Node.js `>=22.19.0` |
| License | MIT |
| Creator | [Umaiz Sufiyan](https://github.com/sufiyan-sabeel) |
| Brand | KageOS |
| Website | [sufiyan-sabeel.github.io/AIRIS-CLI](https://sufiyan-sabeel.github.io/AIRIS-CLI/) |
| Repository | [github.com/sufiyan-sabeel/AIRIS-CLI](https://github.com/sufiyan-sabeel/AIRIS-CLI) |

### About the Creator

AIRIS-CLI is created by **Umaiz Sufiyan** under the **KageOS** brand. Umaiz is a student developer and independent builder focused on AI-powered command-line tools, automation, and practical developer workflows. AIRIS began as a mobile-first AI terminal assistant and continues evolving into a broader AI development workflow system.

### Project Journey

AIRIS started from a simple idea: make an AI assistant useful from the terminal, including on mobile devices where traditional desktop coding tools are not always available. The project has grown into a TypeScript monorepo with separate packages for the CLI runtime, AI provider layer, agent core, and terminal UI.

Current development focuses on:

- Stable terminal UI behavior
- Project trust and permission controls
- Session management
- Multi-provider model routing
- Android and Termux usability
- Verified autonomy primitives — missions, evidence, leases, and ship workflows

---

## Key Features

- **Interactive AI chat** — Conversational coding assistant in the terminal
- **One-shot prompt mode** — `airis -p "prompt"` for quick queries
- **File-aware prompting** — Include files with `@file.md "prompt"`
- **Built-in tools** — `read`, `bash`, `edit`, `write` for file and shell operations
- **Read-only tools** — `grep`, `find`, `ls` (off by default for safety)
- **Session management** — Save, list, resume, fork, and export sessions
- **Project trust controls** — `airis trust` for managing project-level permissions
- **Multi-provider support** — 20+ AI providers via environment variables or OAuth
- **Model selection** — `--provider`, `--model`, `--list-models` for fine-grained control
- **Themes** — Customizable terminal UI with `airis theme list` / `airis theme set`
- **Image generation** — Local image commands under `airis image`
- **Extensions** — TypeScript-based plugin system with lifecycle hooks and custom tools
- **Skills** — Self-contained capability packages loaded on demand
- **Verified autonomy** — `airis mission`, `airis evidence`, `airis lease`, `airis failures`
- **Ship workflow** — Full-lifecycle development tracking with `airis ship`
- **Android automation** — `airis droid` and `airis automation` for ADB-based device control
- **Termux integration** — Android terminal support with Termux:API skill

---

## Quick Start

```bash
# Set a provider key
export GEMINI_AAIRIS_KEY="your-gemini-key"

# Start interactive AIRIS
airis

# Run a one-shot prompt
airis -p "Summarize this repository"

# Continue the previous session
airis --continue

# List available models
airis --list-models

# Trust the current project
airis trust

# Start a structured development workflow
airis ship start "Add a help command that shows usage examples"
```

---

## Installation

### Requirements

- **Node.js** `>=22.19.0`
- **npm** (for source builds and package management)
- **Git** (when building from source)
- Standard POSIX utilities for source builds and shell workflows
- **curl** plus **tar** or **unzip** for the binary installer
- At least one configured AI provider key or OAuth credential

### Binary Installer

```bash
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash
```

The installer downloads release assets from GitHub Releases and installs an `airis` command into a platform-appropriate binary directory. Supported platforms: Linux, macOS, and Windows-style shells for `x64` and `arm64`. Termux is detected automatically and uses Termux-friendly install paths.

Set `VERSION=vX.Y.Z` to install a specific release.

### From Source

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

Verify the installation:

```bash
airis --version
airis --help
```

### npm

```bash
npm install -g --ignore-scripts @sufiyan-sabeel/airis-cli
```

> **Note:** npm package publishing requires the `@sufiyan-sabeel` npm organization. Binary releases are also available through [GitHub Releases](https://github.com/sufiyan-sabeel/AIRIS-CLI/releases).

---

## CLI Commands

The following commands are verified from the AIRIS CLI help output.

### Command Categories

| Area | Commands |
| --- | --- |
| **Core** | `airis`, `airis chat`, `airis help [command]`, `airis version`, `airis changelog` |
| **AI** | `airis -p "prompt"`, `--provider <name>`, `--model <pattern>`, `--list-models [search]` |
| **Vision** | `airis image setup --model sd15`, `airis image generate "prompt"`, `airis image edit --input ...`, `airis image models`, `airis image open-last` |
| **Project Trust** | `airis trust`, `airis trust list`, `airis trust revoke <path>`, `--approve`, `--no-approve` |
| **Verified Autonomy** | `airis mission "task" --verified`, `airis mission approve <id>`, `airis mission run <id>`, `airis evidence show <id>`, `airis lease list`, `airis failures search "err"` |
| **Ship Workflow** | `airis ship start "task"`, `airis ship status [id]`, `airis ship resume`, `airis ship cancel`, `airis ship list` |
| **Sessions** | `airis session list [--all]`, `airis session resume <id>`, `airis session current`, `airis session clear [--yes]`, `--continue`, `--resume` |
| **Files** | `airis @file.md "prompt"`, `--tools read,grep,find,ls` |
| **Config** | `airis config show`, `airis config get <key>`, `airis config set <key> <val>`, `airis config path`, `airis theme list`, `airis theme set <name>` |
| **Droid** | `airis droid open settings`, `airis droid read screen`, `airis automation tap 360 800` |
| **Tools** | `airis tools list`, `airis tools doctor`, `airis install <source> [-l]`, `airis remove <source> [-l]`, `airis list` |
| **System** | `airis doctor`, `airis update [source\|self]` |
| **Developer** | `--mode json\|rpc`, `--extension <path>`, `--skill <path>`, `--prompt-template <path>`, `--theme <path>` |
| **Experimental** | `--models <patterns>`, `--thinking <level>` |

### Options

| Option | Description |
| --- | --- |
| `--provider <name>` | Provider name (default: google) |
| `--model <pattern>` | Model pattern or ID (`provider/id`) |
| `--aairis-key <key>` | API key (defaults to env vars) |
| `--system-prompt <text>` | Custom system prompt |
| `--append-system-prompt <text>` | Append text or file contents to system prompt |
| `--mode <mode>` | Output mode: text, json, or rpc |
| `--print, -p` | Non-interactive mode: process prompt and exit |
| `--continue, -c` | Continue previous session |
| `--resume, -r` | Select a session to resume |
| `--session <path\|id>` | Use specific session file or partial UUID |
| `--session-id <id>` | Use exact project session ID |
| `--fork <path\|id>` | Fork session into a new one |
| `--session-dir <dir>` | Session storage directory |
| `--no-session` | Ephemeral mode (don't save session) |
| `--name, -n <name>` | Session display name |
| `--models <patterns>` | Comma-separated model patterns for cycling |
| `--no-tools, -nt` | Disable all tools by default |
| `--no-builtin-tools, -nbt` | Disable built-in tools only |
| `--tools, -t <tools>` | Comma-separated tool allowlist |
| `--exclude-tools, -xt <tools>` | Comma-separated tool denylist |
| `--thinking <level>` | Thinking level: off, minimal, low, medium, high, xhigh |
| `--extension, -e <path>` | Load an extension |
| `--no-extensions, -ne` | Disable extension discovery |
| `--skill <path>` | Load a skill |
| `--no-skills, -ns` | Disable skills discovery |
| `--prompt-template <path>` | Load a prompt template |
| `--no-prompt-templates, -np` | Disable prompt template discovery |
| `--theme <path>` | Load a theme |
| `--no-themes` | Disable theme discovery |
| `--no-context-files, -nc` | Disable AGENTS.md and CLAUDE.md discovery |
| `--export <file>` | Export session to HTML |
| `--list-models [search]` | List available models (optional fuzzy search) |
| `--verbose` | Force verbose startup |
| `--approve, -a` | Trust project-local files for this run |
| `--no-approve, -na` | Ignore project-local files for this run |
| `--offline` | Disable startup network operations |

### Useful Examples

```bash
airis
airis "Review this project"
airis -p "Summarize package.json"
airis @README.md "Find outdated installation instructions"
airis --tools read,grep,find,ls -p "Review this codebase without modifying files"
airis doctor
airis session list
airis theme list
airis --list-models
```

---

## Configuration

### User and Project Paths

| Purpose | Path or Variable |
| --- | --- |
| Settings path | `~/.airis/agent/settings.json` |
| Config directory | `AIRIS_CODING_AGENT_DIR` (default: `~/.airis/agent`) |
| Session storage | `AIRIS_CODING_AGENT_SESSION_DIR` or `--session-dir` |
| Project-local state | `.airis/` |
| Local model config | `~/.airis/agent/models.json` |
| Auth credentials | `~/.airis/agent/auth.json` |
| Trust database | `~/.airis/agent/trust.json` |
| Offline mode | `AIRIS_OFFLINE=1` or `--offline` |
| Share viewer URL | `AIRIS_SHARE_VIEWER_URL` |

Show sanitized config:

```bash
airis config show
```

Read or write a config value:

```bash
airis config get <key>
airis config set <key> <value>
```

### Settings

AIRIS uses JSON settings files with project settings overriding global settings.

| Location | Scope |
| --- | --- |
| `~/.airis/agent/settings.json` | Global (all projects) |
| `.airis/settings.json` | Project (current directory) |

Key settings include default provider, default model, theme, compaction behavior, retry configuration, and resource locations. Edit directly with `airis config` or use `/settings` in interactive mode.

See [settings documentation](packages/coding-agent/docs/settings.md) for the full settings reference.

### Environment Variables

#### Provider API Keys

> **Note:** Environment variable keys use the `_AAIRIS_KEY` suffix pattern. The full canonical list is available via `airis --help`.

| Provider | Environment Variable |
| --- | --- |
| Anthropic | `ANTHROPIC_AAIRIS_KEY` or `ANTHROPIC_OAUTH_TOKEN` |
| Ant Ling | `ANT_LING_AAIRIS_KEY` |
| OpenAI GPT | `OPENAI_AAIRIS_KEY` |
| Azure OpenAI | `AZURE_OPENAI_AAIRIS_KEY` (plus `AZURE_OPENAI_BASE_URL`, resource name, deployment map) |
| Google Gemini | `GEMINI_AAIRIS_KEY` |
| DeepSeek | `DEEPSEEK_AAIRIS_KEY` |
| NVIDIA NIM | `NVIDIA_AAIRIS_KEY` |
| Groq | `GROQ_AAIRIS_KEY` |
| Cerebras | `CEREBRAS_AAIRIS_KEY` |
| xAI (Grok) | `XAI_AAIRIS_KEY` |
| Fireworks | `FIREWORKS_AAIRIS_KEY` |
| Together AI | `TOGETHER_AAIRIS_KEY` |
| OpenRouter | `OPENROUTER_AAIRIS_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_AAIRIS_KEY` |
| ZAI | `ZAI_AAIRIS_KEY` |
| ZAI Coding Plan (China) | `ZAI_CODING_CN_AAIRIS_KEY` |
| Mistral | `MISTRAL_AAIRIS_KEY` |
| MiniMax | `MINIMAX_AAIRIS_KEY` |
| Moonshot | `MOONSHOT_AAIRIS_KEY` |
| OpenCode Zen / OpenCode Go | `OPENCODE_AAIRIS_KEY` |
| Kimi For Coding | `KIMI_AAIRIS_KEY` |
| Ollama (Local) | `OLLAMA_AAIRIS_KEY` or `OLLAMA_BASE_URL` (default: `http://localhost:11434`) |
| Cloudflare Workers AI | `CLOUDFLARE_AAIRIS_KEY` + `CLOUDFLARE_ACCOUNT_ID` |
| Cloudflare AI Gateway | `CLOUDFLARE_AAIRIS_KEY` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID` |
| Xiaomi MiMo | `XIAOMI_AAIRIS_KEY` |
| Xiaomi MiMo Token Plan (CN) | `XIAOMI_TOKEN_PLAN_CN_AAIRIS_KEY` |
| Xiaomi MiMo Token Plan (AMS) | `XIAOMI_TOKEN_PLAN_AMS_AAIRIS_KEY` |
| Xiaomi MiMo Token Plan (SGP) | `XIAOMI_TOKEN_PLAN_SGP_AAIRIS_KEY` |
| Amazon Bedrock | `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BEARER_TOKEN_BEDROCK`, `AWS_REGION` |
| Hugging Face | `HF_TOKEN` |

#### AIRIS Configuration

| Variable | Purpose |
| --- | --- |
| `AIRIS_CODING_AGENT_DIR` | Config directory (default: `~/.airis/agent`) |
| `AIRIS_CODING_AGENT_SESSION_DIR` | Session storage directory |
| `AIRIS_PACKAGE_DIR` | Override package directory (for Nix/Guix) |
| `AIRIS_OFFLINE` | Disable startup network operations |
| `AIRIS_TELEMETRY` | Override install telemetry |
| `AIRIS_SHARE_VIEWER_URL` | Base URL for `/share` command |
| `AIRIS_CODING_AGENT` | Set to `"true"` when running inside AIRIS |

#### Amazon Bedrock

```bash
# Option 1: AWS Profile
export AWS_PROFILE=your-profile

# Option 2: IAM Keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# Option 3: Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# Option 4: Container roles (ECS, IRSA)
# AWS_CONTAINER_CREDENTIALS_*, AWS_WEB_IDENTITY_TOKEN_FILE

# Optional
export AWS_REGION=us-east-1
```

#### Azure OpenAI

```bash
export AZURE_OPENAI_AAIRIS_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
# or: export AZURE_OPENAI_RESOURCE_NAME=your-resource

export AZURE_OPENAI_AAIRIS_VERSION=2024-02-01       # Optional
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4  # Optional
```

#### Google Vertex AI

Uses Application Default Credentials:

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` to a service account key file.

---

## AI Providers

### Built-in API Providers

AIRIS supports multiple AI provider APIs through a unified streaming interface. The following API types are registered as built-in providers:

| API | Protocol | Provider Examples |
| --- | --- | --- |
| `anthropic-messages` | Anthropic Messages API | Claude (Pro/Max, API key) |
| `openai-responses` | OpenAI Responses API | GPT-4o, GPT-4, o-series via API key |
| `openai-completions` | OpenAI Completions API | Legacy models, compatible endpoints |
| `openai-codex-responses` | OpenAI Codex API | Codex via ChatGPT Plus/Pro |
| `azure-openai-responses` | Azure OpenAI | Azure-hosted OpenAI models |
| `google-generative-ai` | Google Gemini API | Gemini 2.0, Gemini 2.5 Pro |
| `google-vertex` | Google Vertex AI | Enterprise Gemini |
| `mistral-conversations` | Mistral API | Mistral models |
| `bedrock-converse-stream` | Amazon Bedrock | Claude, Llama, Mistral on AWS |

### Provider Credentials

Credentials are resolved in this order:

1. CLI `--aairis-key` flag
2. `~/.airis/agent/auth.json` entry (API key or OAuth token)
3. Environment variable
4. Custom provider keys from `models.json`

Use `/login` in interactive mode to store credentials via OAuth (ChatGPT Plus/Pro, Claude Pro/Max, GitHub Copilot) or API key. Use `/logout` to clear credentials.

### Custom Providers

Custom providers can be added via:

- **`models.json`** — Add Ollama, LM Studio, vLLM, or any provider that speaks a supported API (OpenAI, Anthropic, Google Gemini). See [models documentation](packages/coding-agent/docs/models.md).
- **Extensions** — For providers needing custom API implementations or OAuth flows. See [custom-provider documentation](packages/coding-agent/docs/custom-provider.md) and [extension examples](packages/coding-agent/examples/extensions/).

### Local Models

Configure local and self-hosted endpoints via `~/.airis/agent/models.json`:

```json
{
  "openai-completions": {
    "baseUrl": "http://localhost:1234/v1",
    "models": [
      {
        "id": "local-model",
        "name": "Local Model",
        "contextWindow": 32768,
        "maxTokens": 4096
      }
    ]
  }
}
```

Compatible with Ollama, LM Studio, vLLM, and any OpenAI-compatible endpoint. See [models documentation](packages/coding-agent/docs/models.md).

---

## Extensions

AIRIS has a built-in extension system allowing TypeScript modules to extend behavior. Extensions can:

- Register **custom tools** callable by the LLM
- Subscribe to **lifecycle events** (session start, tool calls, agent turns, etc.)
- Register **slash commands** (`/mycommand`)
- Add **custom UI components** to the TUI
- Intercept and **modify tool calls**, inject context, customize compaction
- Store **persistent state** across sessions

### Quick Example

```typescript
import type { ExtensionAPI } from "@sufiyan-sabeel/airis-cli";
import { Type } from "typebox";

export default function (airis: ExtensionAPI) {
  airis.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });
}
```

### Extension Locations

| Location | Scope |
| --- | --- |
| `~/.airis/agent/extensions/*.ts` | Global (all projects) |
| `~/.airis/agent/extensions/*/index.ts` | Global (subdirectory) |
| `.airis/extensions/*.ts` | Project-local |
| `.airis/extensions/*/index.ts` | Project-local (subdirectory) |

Load with `airis -e ./path/to/extension.ts` or place in auto-discovery directories.

See [extensions documentation](packages/coding-agent/docs/extensions.md) and [extension examples](packages/coding-agent/examples/extensions/).

---

## Skills

Skills are self-contained capability packages that the agent loads on-demand. They implement the [Agent Skills standard](https://agentskills.io/specification) and provide specialized workflows, setup instructions, and reference documentation for specific tasks.

### Skill Locations

| Location | Scope |
| --- | --- |
| `~/.airis/agent/skills/` | Global |
| `~/.agents/skills/` | Global (cross-agent) |
| `.airis/skills/` | Project (trusted) |
| `.agents/skills/` | Project ancestor directories (trusted) |

Skills register as `/skill:name` commands. Disable discovery with `--no-skills`.

See [skills documentation](packages/coding-agent/docs/skills.md).

---

## Themes

AIRIS supports customizable terminal UI themes defined as JSON files. Themes define 51 color tokens covering core UI, backgrounds, markdown rendering, syntax highlighting, tool diffs, and thinking level indicators.

### Theme Locations

| Location | Scope |
| --- | --- |
| Built-in | `dark`, `light` |
| `~/.airis/agent/themes/*.json` | Global |
| `.airis/themes/*.json` | Project (trusted) |

```bash
airis theme list
airis theme set graphite
```

See [themes documentation](packages/coding-agent/docs/themes.md).

---

## Android / Termux

AIRIS includes built-in Android support through [Termux](https://termux.dev/). The CLI can control Android device capabilities via Termux:API commands and ADB (Android Debug Bridge).

### Recommended Termux Setup

```bash
pkg update && pkg upgrade
pkg install nodejs git termux-api android-tools
mkdir -p ~/.airis/agent
```

### Termux Guidance

- Install Termux from **F-Droid** or **GitHub releases** (not the outdated Play Store build)
- Keep source checkouts under the Termux home directory (`$HOME`)
- Do not build npm workspaces from `/sdcard`, `/storage/emulated/0`, or `/mnt/sdcard`
- Use `termux-setup-storage` only if you need access to shared Android storage
- Install Termux:API and run `pkg install termux-api` for clipboard and device helper commands

### Automation

See the [automation guide](.airis/automation-guide.md) for detailed automation capabilities including custom tools, build automation, and file operations.

#### ADB Automation

```bash
# Check connection
adb devices

# Tap at coordinates
adb shell input tap 540 1200

# Swipe
adb shell input swipe 100 500 100 100 300

# Type text
adb shell input text 'hello world'

# Key events
adb shell input keyevent 3   # HOME
adb shell input keyevent 4   # BACK
adb shell input keyevent 66  # ENTER

# Open app
adb shell monkey -p com.whatsapp -c android.intent.category.LAUNCHER 1

# Screenshot
adb shell screencap -p /sdcard/screenshot.png

# UI hierarchy dump
adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml
```

#### Termux:API

AIRIS includes a built-in Termux:API skill at [`.airis/skills/termux-api.md`](.airis/skills/termux-api.md). Available capabilities:

| Command | Purpose |
| --- | --- |
| `termux-notification` | Send system notifications with titles, content, buttons |
| `termux-toast` | Show brief popup messages |
| `termux-tts-speak` | Text-to-speech with rate, pitch, language, engine options |
| `termux-vibrate` | Haptic feedback |
| `termux-clipboard-set/get` | Read and write system clipboard |
| `termux-dialog` | Input, confirm, selection, date/time, counter dialogs |
| `termux-open-url` | Open URLs in default browser |
| `termux-share` | Share text or files through Android share sheet |
| `termux-battery-status` | Battery health, percentage, temperature (JSON) |
| `termux-location` | GPS/network location (JSON) |
| `termux-camera-photo` | Take photos with front or back camera |
| `termux-sensor` | Read sensor data (accelerometer, etc.) |

---

## Project Architecture

### Directory Structure

```text
.
├── docs/                         # Installation, quick start, and workflow docs
├── docs/install.sh               # Website-facing binary installer source
├── packages/
│   ├── agent/                    # Agent framework primitives
│   ├── ai/                       # Unified LLM API, providers, and model metadata
│   ├── coding-agent/             # AIRIS CLI, tools, sessions, TUI runtime, docs, examples
│   └── tui/                      # Terminal UI library and rendering components
├── scripts/                      # Build, release, model generation, and repository checks
├── website/                      # GitHub Pages website (Next.js)
├── .airis/                       # Project-level AIRIS configuration and skills
├── .github/workflows/            # CI/CD workflow definitions
├── install.sh                    # Repository installer script
├── ROADMAP.md                    # Public roadmap
├── SECURITY.md                   # Security model and reporting guidance
├── CONTRIBUTING.md               # Contribution rules
└── LICENSE                       # MIT license
```

### Packages

| Package | Description | Path |
| --- | --- | --- |
| `@sufiyan-sabeel/airis-cli` | Coding agent CLI with read, bash, edit, write tools and session management | `packages/coding-agent/` |
| `@sufiyan-sabeel/airis-ai` | Unified LLM API with automatic model discovery and provider configuration | `packages/ai/` |
| `@sufiyan-sabeel/airis-agent-core` | General-purpose agent with transport abstraction, state management, and attachment support | `packages/agent/` |
| `@sufiyan-sabeel/airis-tui` | Terminal User Interface library with differential rendering | `packages/tui/` |

---

## Development

### Setup

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
```

### Build

```bash
npm run build
```

This builds packages in dependency order: `tui` → `ai` → `agent` → `coding-agent`.

### Testing

Run the non-e2e test suite:

```bash
./test.sh
```

Run repository checks (lint, type-check, pinned deps, shrinkwrap):

```bash
npm run check
```

Useful development references:

- [`AGENTS.md`](AGENTS.md) — Repository rules for coding agents and contributors
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Contribution gate and PR expectations
- [`SECURITY.md`](SECURITY.md) — Security model and reporting process
- [`ROADMAP.md`](ROADMAP.md) — Planned milestones

### CI / CD

The repository includes the following GitHub Actions workflows:

| Workflow | Purpose |
| --- | --- |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Repository checks (lint, type-check, tests) |
| [`.github/workflows/build-binaries.yml`](.github/workflows/build-binaries.yml) | Binary build workflow |
| [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) | GitHub Pages deployment |
| [`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml) | npm publish on version tags |
| [`.github/workflows/npm-audit.yml`](.github/workflows/npm-audit.yml) | Scheduled npm audit |
| [`.github/workflows/approve-contributor.yml`](.github/workflows/approve-contributor.yml) | Contributor approval automation |
| [`.github/workflows/issue-gate.yml`](.github/workflows/issue-gate.yml) | Issue gate automation |
| [`.github/workflows/openclaw-gate.yml`](.github/workflows/openclaw-gate.yml) | OpenClaw gate automation |
| [`.github/workflows/pr-gate.yml`](.github/workflows/pr-gate.yml) | PR gate automation |
| [`.github/workflows/go-r-ci.yml`](.github/workflows/go-r-ci.yml) | Go and R tool checks |
| [`.github/workflows/daily-facts.yml`](.github/workflows/daily-facts.yml) | Scheduled repository automation |

---


## Website Development

The AIRIS-CLI website is located in the `website/` directory. It is a Next.js 16 static site with Tailwind CSS v4 and Framer Motion.

### Development

```bash
cd website
npm install --ignore-scripts
npm run dev
```

### Building for Production

```bash
cd website
npm run build
```

Static output is written to `website/out/`. The site is deployed to GitHub Pages.

### GitHub Pages Deployment

Deployed automatically via `.github/workflows/deploy-pages.yml` on changes to `website/` on `main`. Uses Next.js static export with `basePath: "/AIRIS-CLI"`.

### CLI Terminal UI

The TUI package (`packages/tui`) provides reusable components:

- **AirisWordmark**: ASCII wordmark adapting to terminal width
- **ShortcutBar**: Compact keyboard shortcut display
- **StatusLine**: Repository path, branch, version, mode
- **PromptArea**: Input area with contextual status
- **Loader**: Animated spinner with activity message

### Theme Colors

The CLI uses a graphite/slate palette:

| Role | Color |
|------|-------|
| Primary | Muted blue `#60A5FA` |
| Accent | Soft cyan `#22D3EE` |
| Success | Soft green `#4ADE80` |
| Warning | Amber `#FBBF24` |
| Error | Muted red `#F87171` |
| Divider | Dark slate `#282832` |

Set theme via: `airis config set theme graphite` or `airis theme set graphite`

### NO_COLOR Support

Set `NO_COLOR=1` to disable all ANSI escape sequences. Animations are also disabled when:

- `CI` environment variable is set
- Output is not a TTY (piped/redirected)
- `prefers-reduced-motion` is active (website only)

### Terminal Width Breakpoints

The CLI adapts to terminal width automatically:

- **Narrow (<50 columns)**: Compact single-line prompt, minimal shortcuts, no wordmark
- **Medium (50-90 columns)**: Standard prompt with context bar, compact shortcuts
- **Wide (>90 columns)**: Full layout with dividers, multi-row shortcuts, ASCII wordmark

### Troubleshooting

- **Blank display in narrow terminals**: The CLI auto-switches to compact mode. If still broken, check `TERM`.
- **ANSI corruption in logs**: Set `NO_COLOR=1`.
- **Slow mobile rendering (Termux)**: Set `export AIRIS_CLEAR_ON_SHRINK=0`.

---

## Roadmap

The public roadmap is maintained in [`ROADMAP.md`](ROADMAP.md).

| Milestone | Status | Focus Areas |
| --- | --- | --- |
| **v0.80** | In progress | Stable TUI, Adaptive Brain, Permissions, Doctor, Ship workflow, Verified Autonomy |
| **v0.85** | Planned | Model Router, Privacy Firewall, Repository Intelligence |
| **v0.90** | Planned | Visual Verification, Android Bridge, Local Automation |
| **v1.0** | Planned | Production-ready stability, comprehensive docs, performance optimization |
| **v2.0** | Future | Optional AIRIS Cloud sync, team collaboration, enterprise tools |

Roadmap items are plans, not shipped-feature guarantees. Check CLI help, package docs, and release notes for current behavior.

---

## Contributing

Before contributing, read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

Key guidelines:

- AIRIS core is intended to stay **minimal**; features that do not belong in core should be extensions
- New issues and PRs are **gated** by maintainer review
- Contributors need maintainer approval (`lgtm`) before opening PRs
- Run required checks before submitting a PR:

```bash
npm run check
./test.sh
```

Questions? Join the [Discord](https://discord.com/invite/nKXTsAcmbT).

---

## Security

AIRIS is a local coding agent. It runs with the permissions of the user account that starts it.

### Important Security Boundaries

- AIRIS does **not** provide a sandbox by itself
- Commands and file edits run within your operating-system user boundary
- Use containers, VMs, or sandboxing tools when working with untrusted code
- Only install extensions, skills, tools, and packages from trusted sources
- Treat repository instructions (`AGENTS.md`, comments, project files) as **prompt-injection surfaces**
- Review AI-generated changes before using or committing them
- Do not paste secrets into public issues, screenshots, logs, or AI prompts
- Redact `.env` files, API tokens, SSH keys, npm tokens, cloud credentials, database dumps, personal data, proprietary code, and unredacted logs

### Reporting Vulnerabilities

- **Email:** `riyazo65ckm@gmail.com`
- **GitHub Security Advisories:** Use the Security tab for this repository

Do not open public issues for security-sensitive reports. See [`SECURITY.md`](SECURITY.md) for the full security policy.

### Known Limitations

- Binary packages are published as [GitHub Releases](https://github.com/sufiyan-sabeel/AIRIS-CLI/releases)
- npm package publishing requires the `@sufiyan-sabeel` npm organization setup
- AIRIS is not a sandbox and should not be treated as an isolation boundary
- AI-generated code can be incorrect, incomplete, or unsafe; human review is required
- Prompt injection from trusted project files is an expected risk for local coding agents
- Cloud provider usage sends prompt text and selected context to configured provider APIs
- Termux support depends on Android, Termux package availability, and filesystem behavior
- Local image workflows may require substantial disk, memory, and platform support
- Droid/automation commands depend on ADB or Termux:API availability

---

## License

AIRIS-CLI is licensed under the **MIT License**.

Copyright (c) 2026 Umaiz Sufiyan.

See [`LICENSE`](LICENSE).

---

## Credits

- **AIRIS-CLI** is created by **Umaiz Sufiyan** under the **KageOS** brand
- The project uses the open-source Node.js, TypeScript, and npm ecosystem
- Portions of the ANSI utility code are derived from `ansi-regex` and `strip-ansi` by Sindre Sorhus under the MIT License
- Third-party dependencies remain under their respective licenses
