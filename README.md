# AIRIS

**Artificial Intelligence Responsive Integrated System**

AIRIS is a terminal AI coding agent and extensible coding harness built around the `airis` CLI. It is designed for repository work, command-line workflows, session-based collaboration with models, and mobile-first usage through Android Termux support.

It ships as [`@sufiyan-sabeel/airis-cli`](https://www.npmjs.com/package/@sufiyan-sabeel/airis-cli) and is part of the AIRIS monorepo.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22.19.0](https://img.shields.io/badge/node-%3E%3D22.19.0-green.svg)](https://nodejs.org)
[![Runs on Android](https://img.shields.io/badge/android-termux-orange.svg)](docs/installation.md)
[![CI](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml)
[![npm audit](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/npm-audit.yml/badge.svg)](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/npm-audit.yml)
[![Deploy to GitHub Pages](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/deploy-pages.yml/badge.svg)](https://sufiyan-sabeel.github.io/AIRIS-CLI/)

## Overview

AIRIS helps you work with code directly from your terminal:

- chat with AI models in interactive or one-shot mode
- read, write, edit, and inspect files
- run shell commands as part of development workflows
- save, resume, fork, and export sessions
- extend the agent with tools, skills, themes, prompt templates, and packages
- run on desktop terminals and on Android through Termux

AIRIS focuses on practical local development workflows instead of requiring a specific IDE or a fixed hosted environment.

## Project analysis

AIRIS stands out in four main ways:

1. **Terminal-first workflow**  
   AIRIS is built around the command line, which makes it editor-agnostic and suitable for local development, remote servers, SSH sessions, containers, and tmux-based workflows.

2. **Extensible architecture**  
   The project is designed as a coding harness rather than a closed assistant. Extensions, skills, themes, prompt templates, and AIRIS packages let users adapt the tool to their own workflows.

3. **Mobile-first differentiation**  
   AIRIS supports Android through Termux, making it usable on phones and tablets for coding, automation, and project review in environments where most coding agents do not operate well.

4. **Structured agent workflow support**  
   Beyond basic chat, AIRIS includes session management, project trust, routing modes, verified autonomy components, and `airis ship` workflow tooling for more disciplined development tasks.

## Core capabilities

### Coding and repository work

- Built-in file tools: `read`, `write`, `edit`, `bash`
- Optional read-only discovery tools: `grep`, `find`, `ls`
- Interactive TUI for code-focused sessions
- One-shot prompt mode for fast CLI usage
- Session save, resume, fork, tree navigation, export, and compaction

### Workflow and autonomy features

- Project trust decisions for local project resources
- Routing modes such as `@coding`, `@automation`, and `@multiauto`
- Verified autonomy and evidence-oriented workflow components
- `airis ship` for structured task execution and proof-oriented progress tracking
- Self-debugging and adaptive planning support inside the coding-agent runtime

### Customization and platform support

- Custom extensions
- Skills
- Prompt templates
- Themes
- AIRIS packages
- Provider and local model support
- Android/Termux support

## Why AIRIS

AIRIS is intended for users who want an AI coding workflow that is:

- **terminal-native** instead of IDE-locked
- **extensible** instead of fixed to one interaction model
- **local-workflow friendly** for repositories, shells, and developer tools
- **mobile-capable** through Termux support
- **session-aware** for longer engineering work

## Install

### npm

```bash
npm install -g --ignore-scripts @sufiyan-sabeel/airis-cli
```

### Installer

```bash
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh
```

### From source

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts
npm run build
npm link
```

## Quick start

Authenticate with a provider key and start AIRIS:

```bash
export ANTHROPIC_AAIRIS_KEY=sk-ant-...
airis
```

Or start first and authenticate through the interactive interface:

```bash
airis
/login
```

Common usage:

```bash
airis -p "Summarize this repository"
airis --continue
airis --list-models
airis trust
airis doctor
airis sessions
```

## Example workflows

### Interactive coding session

```bash
airis
```

### One-shot analysis

```bash
airis -p "Review this project structure and identify improvement areas"
```

### Android automation routing

```bash
airis @automation "open settings"
```

### Structured ship workflow

```bash
airis ship start "Add a help command that shows usage examples"
```

## Architecture at a glance

AIRIS is a monorepo with separate packages for the main runtime pieces:

- [`packages/coding-agent`](packages/coding-agent) — AIRIS CLI and interactive runtime
- [`packages/ai`](packages/ai) — provider integrations and model runtime
- [`packages/agent`](packages/agent) — agent framework primitives
- [`packages/tui`](packages/tui) — terminal UI components

This split keeps the CLI, agent logic, model integration, and TUI implementation modular.

## Documentation

### Main entry points

- Website: https://sufiyan-sabeel.github.io/AIRIS-CLI/
- [Root docs overview](docs/README.md)
- [Installation guide](docs/installation.md)
- [Quick start](docs/quick-start.md)
- [Package CLI README](packages/coding-agent/README.md)

### AIRIS CLI docs

- [Interactive usage](packages/coding-agent/docs/usage.md)
- [Providers](packages/coding-agent/docs/providers.md)
- [Models](packages/coding-agent/docs/models.md)
- [Extensions](packages/coding-agent/docs/extensions.md)
- [Skills](packages/coding-agent/docs/skills.md)
- [Themes](packages/coding-agent/docs/themes.md)
- [SDK](packages/coding-agent/docs/sdk.md)
- [Termux](packages/coding-agent/docs/termux.md)
- [Security](packages/coding-agent/docs/security.md)

## Development

```bash
npm install --ignore-scripts
npm run check
./test.sh
```

Repository workflow and contribution rules:

- [AGENTS.md](AGENTS.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## Creator and brand

- **Project**: AIRIS
- **Full form**: Artificial Intelligence Responsive Integrated System
- **Creator**: Umaiz Sufiyan
- **Role**: Student developer
- **Brand**: KageOS

AIRIS is developed by Umaiz Sufiyan under the KageOS brand with a focus on terminal AI workflows, coding assistance, automation, and Android/Termux usability.

## License

MIT. See [LICENSE](LICENSE).
