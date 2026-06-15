#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  AIRIS CLI - Installer                                                  ║
# ║  Artificial Intelligence Responsive Integrated System                    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Clear screen
clear

# Display Logo
echo ""
echo -e "${CYAN}${BOLD}"
cat << 'LOGO'

    ╔═══════════════════════════════════════════════════════════════════════╗
    ║                                                                       ║
    ║     █████╗ ███████╗██╗ ██████╗██╗  ██╗     ███████╗██╗   ██╗███████╗ ║
    ║    ██╔══██╗██╔════╝██║██╔════╝██║ ██╔╝     ██╔════╝╚██╗ ██╔╝██╔════╝ ║
    ║    ███████║█████╗  ██║██║     █████╔╝      ███████╗ ╚████╔╝ ███████╗ ║
    ║    ██╔══██║██╔══╝  ██║██║     ██╔═██╗      ╚════██║  ╚██╔╝  ╚════██║ ║
    ║    ██║  ██║███████╗██║╚██████╗██║  ██╗     ███████║   ██║   ███████║ ║
    ║    ╚═╝  ╚═╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝     ╚══════╝   ╚═╝   ╚══════╝ ║
    ║                                                                       ║
    ║          ███████╗██╗   ██╗███████╗███████╗████████╗                   ║
    ║          ██╔════╝╚██╗ ██╔╝██╔════╝██╔════╝╚══██╔══╝                   ║
    ║          ███████╗ ╚████╔╝ █████╗  ███████╗   ██║                      ║
    ║          ╚════██║  ╚██╔╝  ██╔══╝  ╚════██║   ██║                      ║
    ║          ███████║   ██║   ███████╗███████║   ██║                      ║
    ║          ╚══════╝   ╚═╝   ╚══════╝╚══════╝   ╚═╝                      ║
    ║                                                                       ║
    ╚═══════════════════════════════════════════════════════════════════════╝

LOGO
echo -e "${NC}"

# Animated dots
echo -ne "${CYAN}${BOLD}    Initializing AIRIS installer"
for i in {1..3}; do
    echo -ne "."
    sleep 0.3
done
echo -e "${NC}"
echo ""

# System info
echo -e "${GRAY}    ┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${GRAY}    │${NC} ${WHITE}${BOLD}System Information${NC}                                        ${GRAY}│${NC}"
echo -e "${GRAY}    ├─────────────────────────────────────────────────────────────┤${NC}"
echo -e "${GRAY}    │${NC} ${GREEN}✓${NC} OS:        ${WHITE}$(uname -s)${NC}                                    ${GRAY}│${NC}"
echo -e "${GRAY}    │${NC} ${GREEN}✓${NC} Arch:      ${WHITE}$(uname -m)${NC}                                    ${GRAY}│${NC}"
echo -e "${GRAY}    │${NC} ${GREEN}✓${NC} Node.js:   ${WHITE}$(node -v 2>/dev/null || echo 'Not installed')${NC}                     ${GRAY}│${NC}"
echo -e "${GRAY}    │${NC} ${GREEN}✓${NC} npm:       ${WHITE}$(npm -v 2>/dev/null || echo 'Not installed')${NC}                     ${GRAY}│${NC}"
echo -e "${GRAY}    └─────────────────────────────────────────────────────────────┘${NC}"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${RED}${BOLD}    ✗ Error: Node.js 22 or higher required${NC}"
    echo -e "${GRAY}      Current: $(node -v 2>/dev/null || echo 'Not installed')${NC}"
    echo -e "${GRAY}      Install: https://nodejs.org/${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}${BOLD}    ✓ Node.js version check passed${NC}"
echo ""

# Installation steps
echo -e "${MAGENTA}${BOLD}    ╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}${BOLD}    ║                    INSTALLATION STEPS                       ║${NC}"
echo -e "${MAGENTA}${BOLD}    ╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Install dependencies
echo -e "${YELLOW}${BOLD}    [1/4]${NC} ${WHITE}Installing dependencies...${NC}"
echo -e "${GRAY}    ─────────────────────────────────────────────────────────────${NC}"
npm install --ignore-scripts --no-audit --no-fund 2>&1 | sed 's/^/          /'
echo -e "${GREEN}${BOLD}    ✓ Dependencies installed${NC}"
echo ""

# Step 2: Build packages
echo -e "${YELLOW}${BOLD}    [2/4]${NC} ${WHITE}Building packages...${NC}"
echo -e "${GRAY}    ─────────────────────────────────────────────────────────────${NC}"
npm run build 2>&1 | sed 's/^/          /'
echo -e "${GREEN}${BOLD}    ✓ Packages built${NC}"
echo ""

# Step 3: Link globally
echo -e "${YELLOW}${BOLD}    [3/4]${NC} ${WHITE}Linking AIRIS globally...${NC}"
echo -e "${GRAY}    ─────────────────────────────────────────────────────────────${NC}"
npm link 2>&1 | sed 's/^/          /'
echo -e "${GREEN}${BOLD}    ✓ AIRIS linked globally${NC}"
echo ""

# Step 4: Create config directory
echo -e "${YELLOW}${BOLD}    [4/4]${NC} ${WHITE}Setting up configuration...${NC}"
echo -e "${GRAY}    ─────────────────────────────────────────────────────────────${NC}"
mkdir -p ~/.airis/agent/{extensions,skills,prompts,sessions}
echo -e "${GREEN}${BOLD}    ✓ Configuration directory created${NC}"
echo ""

# Success message
echo ""
echo -e "${GREEN}${BOLD}    ╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}    ║                                                               ║${NC}"
echo -e "${GREEN}${BOLD}    ║   🎉 INSTALLATION COMPLETE!                                  ║${NC}"
echo -e "${GREEN}${BOLD}    ║                                                               ║${NC}"
echo -e "${GREEN}${BOLD}    ╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Quick start guide
echo -e "${CYAN}${BOLD}    ┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}${BOLD}    │                    🚀 QUICK START                          │${NC}"
echo -e "${CYAN}${BOLD}    ├─────────────────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}    │${NC}                                                             ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}  ${WHITE}1. Set your API key:${NC}                                      ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}     ${YELLOW}export GEMINI_API_KEY=\"your-key-here\"${NC}                    ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}                                                             ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}  ${WHITE}2. Run AIRIS:${NC}                                             ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}     ${GREEN}airis${NC}                      ${GRAY}# Interactive mode${NC}           ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}     ${GREEN}airis --help${NC}               ${GRAY}# Show help${NC}                 ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}     ${GREEN}airis -p \"Hello\"${NC}           ${GRAY}# Quick prompt${NC}               ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}                                                             ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}  ${WHITE}Supported Providers:${NC}                                      ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}     ${MAGENTA}•${NC} Google Gemini    ${MAGENTA}•${NC} Anthropic Claude               ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}     ${MAGENTA}•${NC} OpenAI GPT      ${MAGENTA}•${NC} OpenRouter (Multi)             ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}     ${MAGENTA}•${NC} Mistral         ${MAGENTA}•${NC} Groq                           ${CYAN}│${NC}"
echo -e "${CYAN}    │${NC}                                                             ${CYAN}│${NC}"
echo -e "${CYAN}    └─────────────────────────────────────────────────────────────┘${NC}"
echo ""

# ASCII Art Footer
echo -e "${GRAY}"
cat << 'FOOTER'
           ╔═══════════════════════════════════════════════════════╗
           ║  "The future of coding is AI-assisted."              ║
           ║                                                       ║
           ║  GitHub:  https://github.com/YOUR_USERNAME/AIRIS-CLI ║
           ║  Docs:    https://github.com/YOUR_USERNAME/AIRIS-CLI ║
           ╚═══════════════════════════════════════════════════════╝
FOOTER
echo -e "${NC}"

# Reminder about API key
if [ -z "$GEMINI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}${BOLD}    ⚠️  Reminder: Set your API key before running AIRIS${NC}"
    echo -e "${GRAY}       export GEMINI_API_KEY=\"your-key-here\"${NC}"
    echo ""
fi

echo -e "${GREEN}${BOLD}    Happy coding with AIRIS! 🚀${NC}"
echo ""
