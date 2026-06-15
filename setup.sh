#!/bin/bash
# AIRIS CLI - Quick Setup Script
set -e

echo "╔════════════════════════════════════════════╗"
echo "║  AIRIS CLI - Setup                        ║"
echo "║  Artificial Intelligence Responsive       ║"
echo "║  Integrated System                        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "❌ Error: Node.js 22 or higher required"
    echo "   Current: $(node -v)"
    echo "   Install: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --ignore-scripts --no-audit --no-fund

# Build packages
echo ""
echo "🔨 Building packages..."
npm run build

# Link globally
echo ""
echo "🔗 Linking AIRIS globally..."
npm link

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  ✅ Installation Complete!                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Get started:"
echo "  airis --help        Show help"
echo "  airis --version     Show version"
echo "  airis               Start interactive mode"
echo ""
echo "Set your API key:"
echo "  export GEMINI_API_KEY='your-key-here'"
echo ""
echo "Documentation: https://github.com/YOUR_USERNAME/AIRIS-CLI"
