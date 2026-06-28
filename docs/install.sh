#!/bin/sh
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  AIRIS CLI - Installer                                                  ║
# ║  Artificial Intelligence Responsive Integrated System                   ║
# ║  curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh   ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
set -e

# ═══════════════════════════════════════════════════════════════════════════
#  COLORS
# ═══════════════════════════════════════════════════════════════════════════
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# ═══════════════════════════════════════════════════════════════════════════
#  SPINNER
# ═══════════════════════════════════════════════════════════════════════════
spinner() {
    pid=$1
    delay=0.1
    spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while kill -0 "$pid" 2>/dev/null; do
        i=0
        while [ $i -lt ${#spin} ]; do
            i=$((i + 1))
            char=$(printf "%s" "$spin" | cut -c$i)
            printf "\r    %s" "$char"
            sleep $delay
        done
    done
    printf "\r    "
}

# ═══════════════════════════════════════════════════════════════════════════
#  UI HELPERS
# ═══════════════════════════════════════════════════════════════════════════
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

# ═══════════════════════════════════════════════════════════════════════════
#  ASCII BANNER
# ═══════════════════════════════════════════════════════════════════════════
print_banner() {
    echo ""
    echo -e "  ${CYAN}    _ ___ _____    _   _     _      ___  _  __${NC}"
    echo -e "  ${CYAN}   / \\\\__ \\_   \\  / \\\\| |   / \\\\    / _ \\\\/ |/ /${NC}"
    echo -e "  ${CYAN}  / _ \\ / / |) |/ _ \\\\ |  / _ \\\\  | | | )   / ${NC}"
    echo -e "  ${CYAN} / ___/ _\\/ __/ ___ \\\\ | / ___ \\\\ | |_| / \\\\ \\  ${NC}"
    echo -e "  ${CYAN}/_/   /_______/_/   \\_\\\\_/_/   \\_\\\\___/_/  \\_\\\\${NC}"
    echo ""
    echo -e "  ${DIM}Artificial Intelligence Responsive Integrated System${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════
#  ENVIRONMENT DETECTION
# ═══════════════════════════════════════════════════════════════════════════
detect_environment() {
    ENV_TYPE="unknown"
    
    # Check for Termux
    if [ -d "/data/data/com.termux" ] || [ -n "$TERMUX_VERSION" ] || command -v pkg >/dev/null 2>&1; then
        ENV_TYPE="termux"
        return
    fi
    
    # Check for proot / proot-distro
    if [ -f "/etc/proot.d" ] || [ -n "$PROOT_DISTRO" ] || [ -f "/etc/lsb-release" ] && grep -qi "proot" /proc/version 2>/dev/null; then
        ENV_TYPE="proot"
        return
    fi
    
    # Check for Ubuntu
    if [ -f "/etc/os-release" ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu)  ENV_TYPE="ubuntu" ;;
            debian)  ENV_TYPE="debian" ;;
            linuxmint|pop) ENV_TYPE="ubuntu" ;;
            *)       ENV_TYPE="linux" ;;
        esac
        return
    fi
    
    # Check for Debian-based
    if [ -f "/etc/debian_version" ]; then
        ENV_TYPE="debian"
        return
    fi
    
    # Generic Linux
    if [ "$(uname -s)" = "Linux" ]; then
        ENV_TYPE="linux"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
#  MAIN INSTALLER
# ═══════════════════════════════════════════════════════════════════════════
main() {
    print_banner
    
    # Step 1: Detect environment
    step "Preparing AIRIS..."
    detect_environment
    
    UNAME_S=$(uname -s 2>/dev/null || echo "Unknown")
    UNAME_M=$(uname -m 2>/dev/null || echo "Unknown")
    info "Platform: ${ENV_TYPE} (${UNAME_S} / ${UNAME_M})"
    sleep 0.3
    
    # Step 2: Check runtime
    step "Checking environment..."
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VER=$(node -v 2>/dev/null)
        NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
        success "Node.js ${NODE_VER}"
        if [ "$NODE_MAJOR" -lt 22 ] 2>/dev/null; then
            warn "Node.js 22+ recommended (found v${NODE_MAJOR})"
        fi
    else
        fail "Node.js is not installed"
        echo ""
        warn "Install Node.js 22+ first:"
        case "$ENV_TYPE" in
            termux)
                info "  pkg install nodejs"
                ;;
            proot|ubuntu|debian)
                info "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
                info "  sudo apt-get install -y nodejs"
                ;;
            *)
                info "  Visit https://nodejs.org/"
                ;;
        esac
        echo ""
        exit 1
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        NPM_VER=$(npm -v 2>/dev/null)
        success "npm ${NPM_VER}"
    else
        fail "npm is not installed"
        exit 1
    fi
    
    sleep 0.3
    
    # Step 3: Install
    step "Installing AIRIS..."
    info "Package: @sufiyan-sabeel/airis-cli"
    
    npm install -g @sufiyan-sabeel/airis-cli 2>/tmp/airis-npm-err.log &
    NPM_PID=$!
    spinner $NPM_PID
    wait $NPM_PID
    NPM_EXIT=$?
    
    echo ""
    
    # Handle npm failure
    if [ $NPM_EXIT -ne 0 ]; then
        cat /tmp/airis-npm-err.log 2>/dev/null | tail -1
        echo ""
        warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        warn "  AIRIS package is not yet published."
        warn "  Visit https://sufiyan-sabeel.github.io/AIRIS-CLI/ for updates."
        warn ""
        warn "  Or install from source:"
        warn "  git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git"
        warn "  cd AIRIS-CLI && ./install.sh"
        warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        rm -f /tmp/airis-npm-err.log
        exit 0
    fi
    
    rm -f /tmp/airis-npm-err.log
    success "Package installed"
    sleep 0.3
    
    # Step 4: Verify
    step "Verifying installation..."
    
    if command -v airis >/dev/null 2>&1; then
        AIRIS_VER=$(airis --version 2>/dev/null || echo "unknown")
        success "airis ${AIRIS_VER}"
    else
        warn "airis command not found in PATH"
        info "Try: npx @sufiyan-sabeel/airis-cli --help"
    fi
    sleep 0.3
    
    # Success
    echo ""
    echo -e "  ${GREEN}${BOLD}Installation completed successfully.${NC}"
    echo ""
    echo -e "  ${CYAN}▸${NC} ${BOLD}airis --help${NC}        ${GRAY}Show command reference${NC}"
    echo -e "  ${CYAN}▸${NC} ${BOLD}airis --version${NC}     ${GRAY}Display version${NC}"
    echo -e "  ${CYAN}▸${NC} ${BOLD}airis${NC}                ${GRAY}Launch interactive mode${NC}"
    echo -e "  ${CYAN}▸${NC} ${BOLD}airis -p \"hello\"${NC}     ${GRAY}Quick prompt mode${NC}"
    echo ""
    echo -e "  ${YELLOW}⚠${NC}  Set your API key before running:"
    echo -e "     ${BOLD}export GEMINI_API_KEY=\"your-key-here\"${NC}"
    echo ""
    echo -e "  ${GRAY}GitHub: https://github.com/sufiyan-sabeel/AIRIS-CLI${NC}"
    echo -e "  ${GRAY}Brand: KageOS  |  Creator: Umaiz Sufiyan${NC}"
    echo ""
}

main
