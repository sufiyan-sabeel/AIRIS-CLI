# AIRIS CLI

**Artificial Intelligence Responsive Integrated System**

A powerful AI coding agent CLI with read, bash, edit, write tools and session management.

> Based on [Pi Agent Harness](https://github.com/earendil-works/pi) - All original features preserved.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.19.0-green.svg)

## Features

- **Interactive AI Assistant** - Chat with AI models directly in your terminal
- **File Operations** - Read, edit, and write files with AI assistance
- **Shell Commands** - Execute bash commands with AI guidance
- **Session Management** - Save, resume, fork, and export conversations
- **Multi-Model Support** - Works with 25+ providers including OpenAI, Anthropic, Google, and more
- **Beautiful TUI** - Rich terminal user interface with 14 built-in themes
- **Extensible** - Custom extensions, skills, and prompt templates support
- **Android Ready** - Full functionality on Termux

## Quick Install

### One-liner Install

```bash
curl -fsSL https://airis-dev.netlify.app/install.sh | sh
```

### Or Clone & Install

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
chmod +x setup.sh
./setup.sh
```

### Manual Install

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

### Run

```bash
# Show help
airis --help

# Run interactively (requires API key)
export GEMINI_API_KEY="your-key-here"
airis

# One-shot prompt
airis -p "List all TypeScript files in src/"
```

## Usage

### Basic Commands

```bash
# Interactive mode
airis

# Non-interactive (print and exit)
airis -p "Your prompt here"

# Continue last session
airis --continue

# Resume a specific session
airis --resume

# Fork a session
airis --fork <session_id>

# Export session to HTML
airis --export session.jsonl output.html
```

### Options

| Option | Description |
|--------|-------------|
| `--provider <name>` | Provider name (default: google) |
| `--model <pattern>` | Model pattern or ID (supports globs and fuzzy) |
| `--api-key <key>` | API key (defaults to env vars) |
| `--print, -p` | Non-interactive mode |
| `--continue, -c` | Continue previous session |
| `--resume, -r` | Select session to resume |
| `--fork <id>` | Fork session into new one |
| `--session <path>` | Use specific session file |
| `--no-session` | Don't save session (ephemeral) |
| `--name, -n` | Set session display name |
| `--thinking <level>` | Set thinking level: off, minimal, low, medium, high, xhigh |
| `--tools <list>` | Enable specific tools (read, bash, edit, write...) |
| `--no-tools` | Disable all tools |
| `--extension, -e <path>` | Load extension file |
| `--skill <path>` | Load skill file or directory |
| `--theme <path>` | Load theme file |
| `--list-models [search]` | List available models |
| `--export <file>` | Export session to HTML |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

### Examples

```bash
# Interactive mode with initial prompt
airis "List all .ts files in src/"

# Include files in message
airis @prompt.md @image.png "What color is the sky?"

# Use different model
airis --provider openai --model gpt-4o-mini "Help me refactor"

# Read-only mode
airis --tools read,grep,find,ls -p "Review the code in src/"

# High thinking level
airis --thinking high "Solve this complex problem"

# Load extension
airis -e ./my-extension.ts
```

## Supported Providers

25+ providers including:

- **Google** - Gemini
- **Anthropic** - Claude
- **OpenAI** - GPT
- **Azure OpenAI**
- **Groq**
- **Mistral**
- **DeepSeek**
- **OpenRouter**
- **Together AI**
- **Fireworks**
- **Cerebras**
- **xAI** - Grok
- **NVIDIA NIM**
- **Cloudflare Workers AI**
- **Vercel AI Gateway**
- **Amazon Bedrock**
- And more...

Run `airis --list-models` to see all available models.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI GPT API key |
| `GROQ_API_KEY` | Groq API key |
| `MISTRAL_API_KEY` | Mistral API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `AIRIS_CODING_AGENT_DIR` | Config directory (default: `~/.airis/agent`) |
| `PI_OFFLINE` | Disable startup network operations |

See `airis --help` for full list of supported providers and API keys.

## Configuration

AIRIS stores configuration in `~/.airis/agent/`:

```
~/.airis/agent/
├── auth.json        # Provider authentication
├── settings.json    # User settings
├── models.json      # Custom model definitions
├── sessions/        # Session storage
├── extensions/      # Custom extensions
├── skills/          # Custom skills
└── prompts/         # Custom prompt templates
```

## Themes

AIRIS includes 14 built-in themes:

| Theme | Description |
|-------|-------------|
| **dark** | Default dark theme |
| **light** | Light theme |
| **graphite** | Graphite dark theme (default) |
| **amoled** | AMOLED black theme |
| **nord** | Arctic, bluish color scheme |
| **dracula** | Popular dark theme with purple/pink accents |
| **gruvbox** | Retro groove with warm colors |
| **tokyo-night** | Popular VS Code theme |
| **catppuccin** | Pastel color scheme |
| **monokai** | Classic dark theme |
| **solarized-dark** | Classic solarized |
| **one-dark** | Atom One Dark theme |
| **rose-pine** | Rose Pine theme |
| **matrix** | Green on black terminal style |

```bash
# List themes
airis theme list

# Set theme
airis theme set dark

# Use custom theme file
airis --theme ./my-theme.json
```

## Commands

| Command | Description |
|---------|-------------|
| `airis` | Launch interactive mode |
| `airis -p "prompt"` | Non-interactive prompt mode |
| `airis --continue` | Continue last session |
| `airis --resume` | Pick and resume a session |
| `airis sessions` | List recent sessions |
| `airis --model <pattern>` | Use specific model |
| `airis --provider <name>` | Set provider |
| `airis --thinking <level>` | Set thinking level |
| `airis --tools <list>` | Enable specific tools |
| `airis --no-tools` | Disable all tools |
| `airis --export <file>` | Export session to HTML |
| `airis trust` | Trust current folder |
| `airis theme set <name>` | Set theme |
| `airis install <source>` | Install extension |
| `airis update` | Update AIRIS and extensions |
| `airis --list-models` | List available models |
| `airis --version` | Show version |

## Development

```bash
# Install with lifecycle scripts
npm install

# Build all packages
npm run build

# Lint, format, and type check
npm run check

# Run tests
./test.sh

# Run AIRIS from sources
./airis-test.sh
```

## Project Structure

```
AIRIS-CLI/
├── packages/
│   ├── coding-agent/    # Main CLI application
│   ├── ai/              # Unified LLM API
│   ├── agent/           # Agent runtime
│   └── tui/             # Terminal UI library
├── .airis/              # Built-in extensions and skills
└── scripts/             # Build and release scripts
```

## Extending AIRIS

Create custom extensions in `~/.airis/agent/extensions/`:

```typescript
// my-extension.ts
import type { ExtensionAPI } from "@sufiyan-sabeel/airis-cli";

export default function(api: ExtensionAPI) {
  api.registerCommand("hello", {
    description: "Say hello",
    handler: () => "Hello from AIRIS!"
  });
}
```

## Android & Termux

AIRIS runs fully on Android via Termux:

```bash
# Install on Termux
pkg update && pkg install nodejs git
npm install -g @sufiyan-sabeel/airis-cli

# Set your API key
export GEMINI_API_KEY="your-key-here"

# Run
airis
```

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

Built on [Pi Agent Harness](https://github.com/earendil-works/pi) by [Mario Zechner](https://github.com/badlogic).

---

**AIRIS** - Artificial Intelligence Responsive Integrated System

**Brand**: KageOS | **Creator**: Umaiz Sufiyan
