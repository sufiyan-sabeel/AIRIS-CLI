#!/bin/sh
#
# AIRIS CLI – Installer
# Artificial Intelligence Responsive Integrated System
# curl -fsSL https://airis-cli.netlify.app/install.sh | sh
#
# This installer does NOT git clone. It installs via npm package manager.
# If the npm package is not yet published, it prints a clear message.
#

set -e

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m'
BOLD='\033[1m'

# --- Spinner ---
spinner() {
  pid=$1
  delay=0.1
  spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  while kill -0 "$pid" 2>/dev/null; do
    i=0
    while [ $i -lt ${#spin} ]; do
      char=$(echo "$spin" | cut -c$((i+1)))
      printf "\r    [%c] " "$char"
      i=$((i + 1))
      sleep $delay
    done
  done
  printf "\r    [✓] "
}

# --- Step print ---
step() {
  printf "  ${CYAN}◆${NC} ${BOLD}%s${NC}\n" "$1"
}

info() {
  printf "    ${GRAY}%s${NC}\n" "$1"
}

success() {
  printf "  ${GREEN}✓${NC} %s\n" "$1"
}

warn() {
  printf "  ${YELLOW}⚠${NC} %s\n" "$1"
}

fail() {
  printf "  ${RED}✗${NC} %s\n" "$1"
}

# --- Header ---
clear 2>/dev/null || true
cat << 'EOF'

  ◆ AIRIS CLI - Artificial Intelligence Responsive Integrated System
  ───────────────────────────────────────────────────────────

EOF

# --- Step 1: Check OS ---
step "Preparing AIRIS installer..."

UNAME_S=$(uname -s 2>/dev/null || echo "Unknown")
UNAME_M=$(uname -m 2>/dev/null || echo "Unknown")
info "Detected: ${UNAME_S} / ${UNAME_M}"
sleep 0.3

# --- Step 2: Check runtime ---
step "Checking runtime..."

# Check for node
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v 2>/dev/null)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  success "Node.js ${NODE_VER} found"
  if [ "$NODE_MAJOR" -lt 22 ] 2>/dev/null; then
    warn "Node.js 22+ recommended (found v${NODE_MAJOR})"
  fi
else
  fail "Node.js is not installed."
  fail "Install Node.js 22+ from https://nodejs.org/ then re-run this installer."
  exit 1
fi
sleep 0.3

# Check for npm
if command -v npm >/dev/null 2>&1; then
  NPM_VER=$(npm -v 2>/dev/null)
  success "npm ${NPM_VER} found"
else
  fail "npm is not installed (usually bundled with Node.js)."
  exit 1
fi
sleep 0.3

# --- Step 3: Install via npm ---
step "Installing AIRIS CLI..."
info "Package: @earendil-works/airis-coding-agent"
sleep 0.5

# Run npm install in background so we can show spinner
npm install -g --ignore-scripts @earendil-works/airis-coding-agent &
NPM_PID=$!
spinner $NPM_PID
wait $NPM_PID
NPM_EXIT=$?

echo ""

if [ $NPM_EXIT -ne 0 ]; then
  fail "npm install failed (exit code ${NPM_EXIT})."
  echo ""
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "  AIRIS npm package is not published yet."
  warn "  Publish the package first or use the GitHub release."
  warn ""
  warn "  GitHub: https://github.com/sufiyan-sabeel/AIRIS-CLI"
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 1
fi

success "AIRIS CLI installed successfully"
sleep 0.3

# --- Step 4: Link command ---
step "Linking command..."
# npm -g install creates the bin link automatically
sleep 0.3
success "Command linked"
sleep 0.2

# --- Step 5: Verify ---
step "Verifying installation..."

if command -v airis >/dev/null 2>&1; then
  AIRIS_VER=$(airis --version 2>/dev/null || echo "unknown")
  success "AIRIS CLI ${AIRIS_VER} is ready"
else
  warn "airis command not found in PATH."
  info "Try: npx @earendil-works/airis-coding-agent --help"
  info "Or check your npm global bin directory."
fi
sleep 0.3

# --- Success output ---
echo ""
cat << 'EOF'
  ┌──────────────────────────────────────────────────────────┐
  │                     INSTALLATION COMPLETE                │
  └──────────────────────────────────────────────────────────┘
EOF
echo ""

echo "  ${CYAN}▸${NC} ${BOLD}airis --help${NC}        ${GRAY}# Show command reference${NC}"
echo "  ${CYAN}▸${NC} ${BOLD}airis --version${NC}     ${GRAY}# Display version${NC}"
echo "  ${CYAN}▸${NC} ${BOLD}airis${NC}                ${GRAY}# Launch interactive mode${NC}"
echo "  ${CYAN}▸${NC} ${BOLD}airis -p \"hello\"${NC}     ${GRAY}# Quick prompt mode${NC}"
echo ""
echo "  ${YELLOW}⚠${NC} Set your API key before running:"
echo "     ${BOLD}export GEMINI_API_KEY=\"your-key-here\"${NC}"
echo ""
echo "  ${BLUE}◆${NC} Supported providers: Google Gemini, Anthropic Claude,"
echo "     OpenAI, Groq, Mistral, DeepSeek, OpenRouter, and 20+ more."
echo ""
echo "  ${GRAY}GitHub: https://github.com/sufiyan-sabeel/AIRIS-CLI${NC}"
echo "  ${GRAY}Brand: KageOS  |  Creator: Umaiz Sufiyan${NC}"
echo ""
