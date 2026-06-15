#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  AIRIS CLI - Quick Installer                                            ║
# ║  One-liner: curl -fsSL https://raw.githubusercontent.com/.../install.sh ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'

# Logo
echo ""
echo -e "${CYAN}${BOLD}"
echo "    ╔═══════════════════════════════════════════════════════════════╗"
echo "    ║                                                               ║"
echo "    ║     █████╗ ███████╗██╗ ██████╗██╗  ██╗                       ║"
echo "    ║    ██╔══██╗██╔════╝██║██╔════╝██║ ██╔╝                       ║"
echo "    ║    ███████║█████╗  ██║██║     █████╔╝                        ║"
echo "    ║    ██╔══██║██╔══╝  ██║██║     ██╔═██╗                        ║"
echo "    ║    ██║  ██║███████╗██║╚██████╗██║  ██╗                       ║"
echo "    ║    ╚═╝  ╚═╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝                       ║"
echo "    ║                                                               ║"
echo "    ║          ███╗   ██╗███████╗██╗    ██╗████████╗               ║"
echo "    ║          ████╗  ██║██╔════╝██║    ██║╚══██╔══╝               ║"
echo "    ║          ██╔██╗ ██║█████╗  ██║ █╗ ██║   ██║                  ║"
echo "    ║          ██║╚██╗██║██╔══╝  ██║███╗██║   ██║                  ║"
echo "    ║          ██║ ╚████║███████╗╚███╔███╔╝   ██║                  ║"
echo "    ║          ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝    ╚═╝                  ║"
echo "    ║                                                               ║"
echo "    ╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}    ⚠️  Running as root is not recommended${NC}"
    echo ""
fi

# Check Node.js
echo -e "${WHITE}    Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}    ✗ Node.js not found. Please install Node.js 22+ from https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${RED}    ✗ Node.js 22+ required (found $(node -v))${NC}"
    exit 1
fi

echo -e "${GREEN}    ✓ Node.js $(node -v)${NC}"
echo ""

# Create temp directory
INSTALL_DIR="/tmp/airis-install-$$"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Clone repository
echo -e "${CYAN}${BOLD}    Downloading AIRIS...${NC}"
git clone --depth 1 https://github.com/YOUR_USERNAME/AIRIS-CLI.git . 2>/dev/null || {
    echo -e "${RED}    ✗ Failed to clone repository${NC}"
    echo -e "${YELLOW}    Make sure git is installed and you have internet access${NC}"
    rm -rf "$INSTALL_DIR"
    exit 1
}

echo -e "${GREEN}    ✓ Repository downloaded${NC}"
echo ""

# Install
echo -e "${CYAN}${BOLD}    Installing AIRIS...${NC}"
npm install --ignore-scripts --no-audit --no-fund 2>&1 | sed 's/^/          /'
npm run build 2>&1 | sed 's/^/          /'
npm link 2>&1 | sed 's/^/          /'

# Cleanup
cd /
rm -rf "$INSTALL_DIR"

# Create config directory
mkdir -p ~/.airis/agent/{extensions,skills,prompts,sessions}

echo ""
echo -e "${GREEN}${BOLD}    ╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}    ║                    ✅ INSTALLATION COMPLETE!                 ║${NC}"
echo -e "${GREEN}${BOLD}    ╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${WHITE}    Quick start:${NC}"
echo -e "${CYAN}        airis --help${NC}      ${GRAY}# Show help${NC}"
echo -e "${CYAN}        airis${NC}              ${GRAY}# Start interactive mode${NC}"
echo ""
echo -e "${YELLOW}    Don't forget to set your API key:${NC}"
echo -e "${GRAY}        export GEMINI_API_KEY=\"your-key-here\"${NC}"
echo ""
echo -e "${GREEN}    Happy coding with AIRIS! 🚀${NC}"
echo ""
