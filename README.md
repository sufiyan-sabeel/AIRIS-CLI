# AIRIS-CLI


<p align="center">
  <img src="website/public/airis-logo.svg" alt="AIRIS logo" width="120" />
</p>

<p align="center">
  <strong>Artificial Intelligence Responsive Integrated System</strong><br />
  AI-powered command-line assistant for coding, automation, and developer workflows.
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

## Overview

AIRIS-CLI is a terminal-based AI coding agent and extensible command-line harness. It runs in your local terminal, works with files and shell commands in your workspace, supports interactive and one-shot prompt modes, and provides structured workflows for longer development tasks.

AIRIS does not require a specific IDE. It is designed for regular shells, SSH sessions, tmux, containers, desktop terminals, and Android environments through Termux.

Verified project metadata:

| Field | Value |
| --- | --- |
| CLI package | `@sufiyan-sabeel/airis-cli` |
| CLI version | `0.79.8` |
| Command | `airis` |
| Runtime | Node.js `>=22.19.0` |
| License | MIT |
| Creator | Umaiz Sufiyan |
| Brand | KageOS |
| Website | <https://sufiyan-sabeel.github.io/AIRIS-CLI/> |
| Repository | <https://github.com/sufiyan-sabeel/AIRIS-CLI> |

## About Creator

AIRIS-CLI is created by **Umaiz Sufiyan** under the **KageOS** brand.

Umaiz is a student developer and independent builder focused on AI-powered command-line tools, automation, and practical developer workflows. AIRIS began as a mobile-first AI terminal assistant when he was 15 and continues evolving at 16 into a broader AI development workflow system.

> Created by Umaiz Sufiyan under KageOS, AIRIS-CLI began as a mobile-first AI terminal assistant and continues evolving into a practical AI development workflow system.

## Project Journey

AIRIS started from a simple idea: make an AI assistant useful from the terminal, including on mobile devices where traditional desktop coding tools are not always available. The project has grown into a TypeScript monorepo with separate packages for the CLI runtime, AI provider layer, agent core, and terminal UI.

Current development focuses on:

- stable terminal UI behavior
- project trust and permission controls
- session management
- multi-provider model routing
- Android/Termux usability
- verified autonomy primitives such as missions, evidence, leases, and `airis ship`

## What AIRIS Does

AIRIS helps with repository and command-line work from a local terminal.

Core capabilities verified from package metadata, CLI help, and project docs include:

- interactive AI chat with `airis`
- one-shot prompt mode with `airis -p "prompt"`
- file-aware prompting with `airis @file.md "prompt"`
- built-in file and shell tools: `read`, `bash`, `edit`, `write`
- optional read-only discovery tools: `grep`, `find`, `ls`
- session list, resume, continuation, fork, and export support
- project trust controls with `airis trust`
- provider and model selection with `--provider`, `--model`, and `--list-models`
- configurable themes with `airis theme list` and `airis theme set`
- local image commands under `airis image`
- Android automation commands under `airis droid` and `airis automation`
- verified autonomy commands under `airis mission`, `airis evidence`, `airis lease`, and `airis failures`
- full-lifecycle workflow tracking with `airis ship`
- extension, skill, prompt-template, and theme loading through CLI options

## Why AIRIS-CLI

AIRIS-CLI is built for developers who prefer workflows that are:

- **terminal-native**: usable in regular shells, SSH, tmux, and containers
- **repository-aware**: designed around local files, sessions, and project state
- **provider-flexible**: supports multiple cloud providers and documented local model configuration
- **workflow-oriented**: includes session management, project trust, missions, evidence, and ship workflows
- **mobile-capable**: documented Android/Termux support for coding and automation on mobile devices
- **extensible**: supports extensions, skills, themes, prompt templates, and package-style additions

AIRIS runs locally as a CLI process. When you use cloud AI providers, prompts and selected context are sent to those provider APIs according to your configuration and provider terms.

## Android/Termux

AIRIS includes built-in Android support through [Termux](https://termux.dev/). Termux:API commands (`termux-notification`, `termux-toast`, `termux-tts-speak`, `termux-clipboard-set/get`, `termux-dialog`, `termux-vibrate`, `termux-open-url`, `termux-share`, `termux-battery-status`, `termux-location`, `termux-camera-photo`, `termux-sensor`) are recognized and documented as part of the AIRIS agent skill system.

### Recommended Termux setup

```bash
pkg update && pkg upgrade
pkg install nodejs git termux-api android-tools
mkdir -p ~/.airis/agent
```

### Termux:API skill

AIRIS includes a built-in Termux:API skill at [`.airis/skills/termux-api.md`](.airis/skills/termux-api.md) that teaches the agent how to use Android device capabilities. When running in Termux, AIRIS can:

- **`termux-notification`** — Send system notifications with titles, content, buttons, and priority levels
- **`termux-toast`** — Show brief popup messages (short/long duration, position control)
- **`termux-tts-speak`** — Speak text aloud with rate, pitch, language, and engine options
- **`termux-vibrate`** — Trigger haptic feedback with duration control
- **`termux-clipboard-set`** / **`termux-clipboard-get`** — Read and write the system clipboard
- **`termux-dialog`** — Show input, confirm, selection, date/time, counter, and custom dialogs
- **`termux-open-url`** — Open URLs in the default browser
- **`termux-share`** — Share text or files through Android's share sheet
- **`termux-battery-status`** — Check battery health, percentage, temperature (JSON output)
- **`termux-location`** — Get GPS/network location (JSON output)
- **`termux-camera-photo`** — Take photos with front or back camera
- **`termux-sensor`** — Read sensor data (accelerometer, etc.)

### Android Debug Bridge (ADB)

AIRIS `airis droid` and `airis automation` commands require ADB for extended Android automation (screen reads, taps, gestures, settings toggles). Install with:

```bash
pkg install android-tools
adb devices   # verify connection
```

ADB is a built-in dependency for the droid/automation command group.

### Termux guidance

- Install Termux from F-Droid or GitHub, not the outdated Play Store build.
- Keep source checkouts under the Termux home directory (`$HOME`).
- Do not build npm workspaces from `/sdcard`, `/storage/emulated/0`, or `/mnt/sdcard`; those shared-storage filesystems can break symlinks and package extraction.
- Use `termux-setup-storage` only if you need access to shared Android storage.
- Install Termux:API and `pkg install termux-api` for clipboard and device helper commands.
- Text clipboard support is documented; image clipboard support is not available through Termux clipboard APIs.

The web installer is designed to detect Termux and choose Termux-friendly install paths. Source builds are also documented, but should stay inside `$HOME`.

## Installation

### Requirements

- Node.js `>=22.19.0`
- npm
- Git, when building from source
- Standard POSIX utilities for source builds and shell workflows
- `curl` plus `tar` or `unzip` for the binary installer
- At least one configured AI provider key, OAuth credential, local model, or supported provider configuration for model calls

### Binary installer

The GitHub Pages installer downloads release assets from GitHub Releases (`airis-<platform>.tar.gz` or `airis-<platform>.zip`) and installs an `airis` command into a platform-appropriate binary directory.

```bash
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash
```

Installer notes:

- Supported installer platforms in the script are Linux, macOS, and Windows-style shells for `x64` and `arm64` assets.
- Termux is detected and uses Termux install locations.
- The installer requires matching GitHub Release assets to exist for the selected version.
- Set `VERSION=vX.Y.Z` to install a specific release if the asset exists.

### From source

This is the verified development install path from repository docs:

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

Verify:

```bash
airis --version
airis --help
```

### npm package status

The CLI package manifest is named `@sufiyan-sabeel/airis-cli`. The repository contains an npm publishing workflow triggered on version tags. Binary releases are available through [GitHub Releases](https://github.com/sufiyan-sabeel/AIRIS-CLI/releases).

To install from npm when registry access is available:

```bash
npm install -g --ignore-scripts @sufiyan-sabeel/airis-cli
```

## Quick Start

Set a provider key, then start AIRIS:

```bash
export GEMINI_AAIRIS_KEY="your-key"
# or: export OPENAI_AAIRIS_KEY="your-key"
# or: export ANTHROPIC_AAIRIS_KEY="your-key"

airis
```

Run a one-shot prompt:

```bash
airis -p "Summarize this repository"
```

Continue the previous session:

```bash
airis --continue
```

List models:

```bash
airis --list-models
```

Trust the current project for local project resources:

```bash
airis trust
airis trust list
```

Start a structured development workflow:

```bash
airis ship start "Add a help command that shows usage examples"
```

## Commands

The following command groups are verified from `airis --help` output.

| Area | Commands |
| --- | --- |
| Core | `airis`, `airis chat`, `airis help [command]`, `airis version`, `airis changelog` |
| AI | `airis -p "prompt"`, `airis --provider <name>`, `airis --model <pattern>`, `airis --list-models [search]` |
| Vision | `airis image setup`, `airis image generate`, `airis image edit`, `airis image models`, `airis image open-last` |
| Project trust | `airis trust`, `airis trust list`, `airis trust revoke <path>`, `--approve`, `--no-approve` |
| Verified autonomy | `airis mission`, `airis evidence show`, `airis lease list`, `airis failures search` |
| Ship workflow | `airis ship start`, `airis ship status`, `airis ship resume`, `airis ship cancel`, `airis ship list` |
| Sessions | `airis session list`, `airis session resume`, `airis session current`, `airis session clear`, `--continue`, `--resume` |
| Files | `airis @file.md "prompt"`, `--tools read,grep,find,ls` |
| Config | `airis config show`, `airis config get`, `airis config set`, `airis config path`, `airis theme list`, `airis theme set` |
| Android | `airis droid open settings`, `airis droid read screen`, `airis automation tap 360 800` |
| Tools | `airis tools list`, `airis tools doctor`, `airis install`, `airis remove`, `airis list` |
| System | `airis doctor`, `airis update [source\|self]` |
| Developer | `--mode json\|rpc`, `--extension <path>`, `--skill <path>` |

Useful examples:

```bash
airis
airis "Review this project"
airis -p "Summarize package.json"
airis @README.md "Find outdated installation instructions"
airis --tools read,grep,find,ls -p "Review this codebase without modifying files"
airis doctor
airis session list
airis theme list
```

## Configuration

### User and project paths

Verified paths and environment variables:

| Purpose | Path or variable |
| --- | --- |
| Settings path from `airis config path` | `~/.airis/agent/settings.json` |
| Default config directory | `AIRIS_CODING_AGENT_DIR` default: `~/.airis/agent` |
| Session storage override | `AIRIS_CODING_AGENT_SESSION_DIR` or `--session-dir` |
| Project-local state | `.airis/` |
| Local model configuration | `~/.airis/agent/models.json` |
| Offline startup mode | `AIRIS_OFFLINE=1` or `--offline` |
| Share viewer base URL | `AIRIS_SHARE_VIEWER_URL` |

Show sanitized config:

```bash
airis config show
```

Read or write a config value:

```bash
airis config get <key>
airis config set <key> <value>
```

### Provider keys

Common provider environment variables verified from source and help output:

| Provider | Environment variable |
| --- | --- |
| Anthropic | `ANTHROPIC_AAIRIS_KEY` or `ANTHROPIC_OAUTH_TOKEN` |
| OpenAI | `OPENAI_AAIRIS_KEY` |
| Google Gemini | `GEMINI_AAIRIS_KEY` |
| Azure OpenAI | `AZURE_OPENAI_AAIRIS_KEY` plus Azure endpoint/deployment variables as needed |
| DeepSeek | `DEEPSEEK_AAIRIS_KEY` |
| Groq | `GROQ_AAIRIS_KEY` |
| Cerebras | `CEREBRAS_AAIRIS_KEY` |
| xAI | `XAI_AAIRIS_KEY` |
| OpenRouter | `OPENROUTER_AAIRIS_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_AAIRIS_KEY` |
| Mistral | `MISTRAL_AAIRIS_KEY` |
| MiniMax | `MINIMAX_AAIRIS_KEY` |
| Moonshot | `MOONSHOT_AAIRIS_KEY` |
| OpenCode Zen / OpenCode Go | `OPENCODE_AAIRIS_KEY` |
| Kimi For Coding | `KIMI_AAIRIS_KEY` |
| Cloudflare Workers AI / AI Gateway | `CLOUDFLARE_AAIRIS_KEY`, `CLOUDFLARE_ACCOUNT_ID`, and gateway settings as needed |
| Ollama (Local) | `OLLAMA_AAIRIS_KEY` or `OLLAMA_BASE_URL` (default `http://localhost:11434`) |
| Amazon Bedrock | `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BEARER_TOKEN_BEDROCK`, `AWS_REGION` |

For the complete current list, run:

```bash
airis --help
```

### Local models

Local model configuration is documented through `~/.airis/agent/models.json`. The repository docs include examples for local and self-hosted endpoints such as Ollama, LM Studio, and vLLM. See [`packages/coding-agent/docs/models.md`](packages/coding-agent/docs/models.md).

## Project Structure

```text
.
├── docs/                         # Installation, quick start, and workflow docs
├── packages/
│   ├── agent/                    # Agent framework primitives
│   ├── ai/                       # Unified LLM API, providers, and model metadata
│   ├── coding-agent/             # AIRIS CLI, tools, sessions, TUI runtime, docs, examples
│   └── tui/                      # Terminal UI library and rendering components
├── scripts/                      # Build, release, model generation, and repository checks
├── website/                      # GitHub Pages website built with Next.js
├── install.sh                    # Repository installer script
├── docs/install.sh               # Website-facing adaptive binary installer source
├── ROADMAP.md                    # Public roadmap
├── SECURITY.md                   # Security model and private reporting guidance
├── CONTRIBUTING.md               # Contribution rules
└── LICENSE                       # MIT license
```

Main package descriptions from `package.json` files:

| Package | Description |
| --- | --- |
| `@sufiyan-sabeel/airis-cli` | Coding agent CLI with read, bash, edit, write tools and session management |
| `@sufiyan-sabeel/airis-ai` | Unified LLM API with automatic model discovery and provider configuration |
| `@sufiyan-sabeel/airis-agent-core` | General-purpose agent with transport abstraction, state management, and attachment support |
| `@sufiyan-sabeel/airis-tui` | Terminal User Interface library with differential rendering for text-based applications |

## Website

Project website:

- <https://sufiyan-sabeel.github.io/AIRIS-CLI/>

Documentation section:

- <https://sufiyan-sabeel.github.io/AIRIS-CLI/#docs>

The website is stored in [`website/`](website/) and built as a Next.js application. GitHub Pages deployment is handled by the repository workflow `.github/workflows/deploy-pages.yml`.

## Security

AIRIS is a local coding agent. It runs with the permissions of the user account that starts it.

Important security boundaries:

- AIRIS does **not** provide a sandbox by itself.
- Commands and file edits run inside your operating-system user boundary.
- Use containers, virtual machines, disposable worktrees, or other sandboxing tools when working with untrusted code.
- Only install extensions, skills, tools, and packages from sources you trust.
- Treat repository instructions such as `AGENTS.md`, comments, prompts, and project files as prompt-injection surfaces.
- Review AI-generated changes before using or committing them.
- Do not paste secrets into public issues, screenshots, logs, AI prompts, or examples.
- Redact `.env` files, API tokens, SSH keys, npm tokens, cloud credentials, database dumps, personal data, proprietary code, and unredacted logs.

Private vulnerability reporting:

- Email: `riyazo65ckm@gmail.com`
- Or use GitHub Security Advisories for this repository.

Do not open public issues for security-sensitive reports. See [`SECURITY.md`](SECURITY.md).

## Known Limitations

- Binary packages are published as [GitHub Releases](https://github.com/sufiyan-sabeel/AIRIS-CLI/releases). The binary installer downloads assets matching your platform and version.
- npm package publishing requires the `@sufiyan-sabeel` npm organization to be set up. Use the binary installer or source installation for now.
- AIRIS is not a sandbox and should not be treated as an isolation boundary.
- AI-generated code and shell commands can be incorrect, incomplete, or unsafe; human review is required.
- Prompt injection from trusted project files is an expected risk for local coding agents.
- Cloud provider usage can send prompt text, selected files, and context to configured provider APIs.
- Termux support depends on Android, Termux package availability, and filesystem behavior. Keep source checkouts in `$HOME`, not Android shared storage.
- Local image/model workflows may require substantial disk, memory, and platform support.
- Droid/automation commands depend on Android/ADB or Termux capabilities being available and configured. ADB must be installed (`pkg install android-tools`) and the device must be authorized.

## Development

Install dependencies and build from the repository root:

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run build
```

Run repository checks:

```bash
npm run check
```

Run the non-e2e test wrapper used by this repository:

```bash
./test.sh
```

Useful development files:

- [`AGENTS.md`](AGENTS.md) — repository rules for coding agents and contributors
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution gate and PR expectations
- [`SECURITY.md`](SECURITY.md) — security model and reporting process
- [`ROADMAP.md`](ROADMAP.md) — planned milestones

## CI/CD

The repository includes GitHub Actions workflows for:

| Workflow file | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | repository checks |
| `.github/workflows/build-binaries.yml` | binary build workflow |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deployment |
| `.github/workflows/npm-publish.yml` | npm publish workflow |
| `.github/workflows/npm-audit.yml` | npm audit workflow |
| `.github/workflows/approve-contributor.yml` | contributor approval automation |
| `.github/workflows/issue-gate.yml` | issue gate automation |
| `.github/workflows/pr-gate.yml` | PR gate automation |
| `.github/workflows/go-r-ci.yml` | Go/R tool checks |
| `.github/workflows/daily-facts.yml` | scheduled repository automation |

## Roadmap

The public roadmap is maintained in [`ROADMAP.md`](ROADMAP.md).

Current and planned milestones:

- **v0.80 — Stable TUI, Adaptive Brain, Permissions, Doctor**: in progress.
- **v0.85 — Model Router, Privacy Firewall, Repository Intelligence**: planned.
- **v0.90 — Visual Verification, Android Bridge, Local Automation**: planned.
- **v1.0 — Polished Free Open-Source Release**: planned.
- **v2.0 — Optional AIRIS Cloud and Team Services**: future.

Roadmap items are plans, not shipped-feature guarantees. Check CLI help, package docs, and release notes for current behavior.

## Contributing

Before contributing, read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

Repository contribution rules include:

- AIRIS core is intended to stay minimal; features that do not belong in core should usually be extensions.
- New issues and PRs are gated by maintainer review.
- Contributors need maintainer approval before opening PRs.
- PR authors are expected to understand their changes.
- Run the required checks before submitting a PR:

```bash
npm run check
./test.sh
```

For questions, use the Discord link in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

AIRIS-CLI is licensed under the MIT License.

Copyright (c) 2026 Umaiz Sufiyan.

See [`LICENSE`](LICENSE).

## Attribution

- AIRIS-CLI is created by Umaiz Sufiyan under KageOS.
- The project uses the open-source Node.js, TypeScript, and npm ecosystem.
- Portions of the ANSI utility code are derived from `ansi-regex` and `strip-ansi` by Sindre Sorhus under the MIT License, as noted in source comments.
- Third-party dependencies remain under their respective licenses.
=======


## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

* [Create](https://docs.gitlab.com/user/project/repository/web_editor/#create-a-file) or [upload](https://docs.gitlab.com/user/project/repository/web_editor/#upload-a-file) files
* [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.com/umaiz-group/airis-cli.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

* [Set up project integrations](https://gitlab.com/umaiz-group/airis-cli/-/settings/integrations)

## Collaborate with your team

* [Invite team members and collaborators](https://docs.gitlab.com/user/project/members/)
* [Create a new merge request](https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/)
* [Automatically close issues from merge requests](https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically)
* [Enable merge request approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/)
* [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

* [Get started with GitLab CI/CD](https://docs.gitlab.com/ci/quick_start/)
* [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/user/application_security/sast/)
* [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/topics/autodevops/requirements/)
* [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/user/clusters/agent/)
* [Set up protected environments](https://docs.gitlab.com/ci/environments/protected_environments/)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
>>>>>>> 9d75062be9e995ff344ba67af70838be82d4e00a
