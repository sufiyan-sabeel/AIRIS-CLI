# AIRIS CLI

**Artificial Intelligence Responsive Integrated System**

A powerful AI coding agent CLI with read, bash, edit, write tools and session management.

> Based on [Pi Agent Harness](https://github.com/earendil-works/pi) - All original features preserved.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.19.0-green.svg)

## Features

- 🤖 **Interactive AI Assistant** - Chat with AI models directly in your terminal
- 📁 **File Operations** - Read, edit, and write files with AI assistance
- 💻 **Shell Commands** - Execute bash commands with AI guidance
- 🔄 **Session Management** - Save and resume conversations
- 🧠 **Multi-Model Support** - Works with OpenAI, Anthropic, Google, and more
- 🎨 **Beautiful TUI** - Rich terminal user interface with themes
- 🔌 **Extensible** - Custom extensions and tools support

## Quick Start

### Install

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/AIRIS-CLI.git
cd AIRIS-CLI

# Install dependencies
npm install --ignore-scripts --no-audit --no-fund

# Build all packages
npm run build

# Link globally
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
```

### Options

| Option | Description |
|--------|-------------|
| `--provider <name>` | Provider name (default: google) |
| `--model <pattern>` | Model pattern or ID |
| `--api-key <key>` | API key (defaults to env vars) |
| `--print, -p` | Non-interactive mode |
| `--continue, -c` | Continue previous session |
| `--resume, -r` | Select session to resume |
| `--name, -n` | Set session display name |
| `--thinking <level>` | Set thinking level (off/low/medium/high) |
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

# Export session to HTML
airis --export session.jsonl output.html
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI GPT API key |
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
import type { ExtensionAPI } from "@earendil-works/airis-coding-agent";

export default function(api: ExtensionAPI) {
  api.registerCommand("hello", {
    description: "Say hello",
    handler: () => "Hello from AIRIS!"
  });
}
```

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

Built on [Pi Agent Harness](https://github.com/earendil-works/pi) by [Mario Zechner](https://github.com/badlogic).

---

**AIRIS** - Artificial Intelligence Responsive Integrated System
