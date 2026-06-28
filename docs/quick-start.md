# Quick Start

Get AIRIS running in 5 minutes.

## 1. Install

```bash
# One-liner (Linux/macOS/Termux)
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh

# Or from source
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

## 2. Configure a Provider

Set an API key for at least one provider:

```bash
# Google Gemini (free tier available)
export GEMINI_API_KEY="your-key"

# OpenAI
export OPENAI_API_KEY="your-key"

# Anthropic
export ANTHROPIC_API_KEY="your-key"

# Add to your shell profile for persistence
echo 'export GEMINI_API_KEY="your-key"' >> ~/.bashrc
```

## 3. Start AIRIS

```bash
airis
```

You will see the AIRIS welcome screen with:
- Brand information
- Available providers and models
- Quick-start commands

## 4. Try These Commands

```bash
# Ask a question
airis -p "What files are in this directory?"

# Review code
airis -p "Review this project for potential issues"

# Edit a file (with confirmation)
airis -p "Add a comment to the top of package.json"

# Continue your last session
airis --continue
```

## 5. Use Project Trust

When AIRIS detects a project directory, it asks whether to trust it:

```bash
# Trust the current project
airis trust

# Check trust decisions
airis trust list
```

Trust allows AIRIS to read and edit files in the project. Risky actions always require confirmation.

## 6. Try `airis ship`

Start a full development workflow:

```bash
airis ship start "Add a help command that shows usage examples"
```

This creates a mission contract, tracks progress through implementation, formatting, testing, and verification, and produces a proof report.

## Next Steps

- Read the [airis ship Reference](airis-ship.md) for the complete workflow
- See [Installation Guide](installation.md) for platform-specific details
- Check the [Roadmap](../ROADMAP.md) for planned features
- Join [Discord](https://discord.com/invite/nKXTsAcmbT) for help and discussion
