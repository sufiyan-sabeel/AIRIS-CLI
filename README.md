# AIRIS

**Artificial Intelligence Responsive Integrated System**

AIRIS is a terminal AI coding agent and extensible coding harness. It ships as [`@sufiyan-sabeel/airis-cli`](https://www.npmjs.com/package/@sufiyan-sabeel/airis-cli) and runs through the `airis` command.

It can chat with models, read and edit files, run shell commands, manage sessions, and be extended with custom tools, skills, prompt templates, themes, and packages.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22.19.0](https://img.shields.io/badge/node-%3E%3D22.19.0-green.svg)](https://nodejs.org)
[![Runs on Android](https://img.shields.io/badge/android-termux-orange.svg)](docs/installation.md)
[![CI](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/ci.yml)
[![npm audit](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/npm-audit.yml/badge.svg)](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/npm-audit.yml)
[![Deploy to GitHub Pages](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/workflows/deploy-pages.yml/badge.svg)](https://sufiyan-sabeel.github.io/AIRIS-CLI/)

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

Authenticate with an API key:

```bash
export ANTHROPIC_AAIRIS_KEY=sk-ant-...
airis
```

Or start AIRIS and log in from the interactive UI:

```bash
airis
/login
```

One-shot prompt:

```bash
airis -p "Summarize this repository"
```

Continue the latest session:

```bash
airis --continue
```

## What AIRIS includes

- Interactive terminal UI
- Print mode, JSON mode, RPC mode, and SDK usage
- Built-in tools: `read`, `write`, `edit`, `bash`, plus optional `grep`, `find`, `ls`
- Session save/resume, branching, export, and compaction
- Project trust and local configuration support
- Extensions, skills, prompt templates, themes, and AIRIS packages
- Cloud providers and local model support
- Android/Termux support

## Common commands

```bash
airis                           # interactive mode
airis -p "explain this file"    # print response and exit
airis --list-models             # list available models
airis trust                     # manage project trust
airis doctor                    # runtime diagnostics
airis sessions                  # inspect saved sessions
airis --help                    # full CLI reference
```

## Documentation

- Website: https://sufiyan-sabeel.github.io/AIRIS-CLI/
- [Root docs overview](docs/README.md)
- [Installation guide](docs/installation.md)
- [Quick start](docs/quick-start.md)
- [Package CLI README](packages/coding-agent/README.md)
- [Interactive usage](packages/coding-agent/docs/usage.md)
- [Providers and models](packages/coding-agent/docs/providers.md)
- [Extensions](packages/coding-agent/docs/extensions.md)
- [Skills](packages/coding-agent/docs/skills.md)
- [Themes](packages/coding-agent/docs/themes.md)
- [SDK](packages/coding-agent/docs/sdk.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Monorepo packages

- [`packages/coding-agent`](packages/coding-agent) — AIRIS CLI and interactive runtime
- [`packages/ai`](packages/ai) — provider integrations and model runtime
- [`packages/agent`](packages/agent) — agent framework primitives
- [`packages/tui`](packages/tui) — terminal UI components

## Development

```bash
npm install --ignore-scripts
npm run check
./test.sh
```

See [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for repository rules and contributor workflow.

## License

MIT. See [LICENSE](LICENSE).

## Creator

AIRIS is built by Umaiz Sufiyan under KageOS.
