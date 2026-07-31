#!/usr/bin/env bash
# AIRIS-CLI Installer
# Premium installation script for AIRIS-CLI by KageOS
# Detects platform, installs deps, downloads binary, verifies checksum

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# ── Logo ──────────────────────────────────────────────────────────────
print_logo() {
    echo -e "${CYAN}"
    cat << "EOF"
    █████  ██ ██████  ██ ██████
   ██   ██ ██ ██   ██ ██ ██   ██
   ███████ ██ ██████  ██ ██████
   ██   ██ ██ ██   ██ ██ ██   ██
   ██   ██ ██ ██   ██ ██ ██   ██
EOF
    echo -e "${NC}"
    echo -e "${BLUE}Artificial Intelligence Responsive Integrated System${NC}"
    echo -e "${DIM}by KageOS${NC}"
    echo ""
}

# ── Platform Detection ────────────────────────────────────────────────
detect_platform() {
    local os
    local arch
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)

    case "$os" in
        linux)
            if [[ -d /data/data/com.termux/files/usr ]]; then
                echo "android-termux"
            elif grep -qi "debian\|ubuntu" /etc/os-release 2>/dev/null; then
                echo "debian"
            elif grep -qi "fedora" /etc/os-release 2>/dev/null; then
                echo "fedora"
            elif grep -qi "arch" /etc/os-release 2>/dev/null; then
                echo "arch"
            else
                echo "linux"
            fi
            ;;
        darwin) echo "macos" ;;
        mingw*|msys*|cygwin*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
    echo ":$arch"
}

# ── Dependency Check ──────────────────────────────────────────────────
check_deps() {
    local missing=()
    local tools=("curl" "git")

    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &>/dev/null; then
            missing+=("$tool")
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${YELLOW}Missing dependencies: ${missing[*]}${NC}"
        echo -e "${BLUE}Installing dependencies...${NC}"

        local platform
        platform=$(detect_platform | cut -d: -f1)

        case "$platform" in
            debian|ubuntu)
                sudo apt-get update -qq
                sudo apt-get install -y -qq curl git build-essential pkg-config libssl-dev
                ;;
            fedora)
                sudo dnf install -y curl git gcc pkg-config openssl-devel
                ;;
            arch)
                sudo pacman -S --noconfirm curl git base-devel pkg-config openssl
                ;;
            macos)
                if ! command -v brew &>/dev/null; then
                    echo -e "${BLUE}Installing Homebrew...${NC}"
                    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                fi
                brew install curl git pkg-config openssl
                ;;
            android-termux)
                pkg update -y
                pkg install -y curl git build-essential pkg-config openssl
                ;;
            *)
                echo -e "${RED}Unsupported platform. Please install dependencies manually: curl, git${NC}"
                exit 1
                ;;
        esac
    fi
}

# ── Install Rust ──────────────────────────────────────────────────────
install_rust() {
    if ! command -v rustc &>/dev/null; then
        echo -e "${BLUE}Installing Rust...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
        source "$HOME/.cargo/env"
    else
        echo -e "${GREEN}Rust $(rustc --version) already installed${NC}"
    fi
}

# ── Install AIRIS-CLI ─────────────────────────────────────────────────
install_airis() {
    local install_dir="${1:-$HOME/.airis}"

    echo -e "${BLUE}Installing AIRIS-CLI to ${install_dir}...${NC}"

    mkdir -p "$install_dir"
    
    # Try cargo install first (from local source)
    if [ -f "Cargo.toml" ] && grep -q "airis" "Cargo.toml"; then
        echo -e "${BLUE}Building from source (this may take a few minutes)...${NC}"
        cargo build --release -p airis-cli 2>&1 | tail -5
        cp target/release/airis "$install_dir/airis"
        echo -e "${GREEN}Build complete!${NC}"
    else
        # Download prebuilt binary
        local version="${1:-latest}"
        local platform
        platform=$(detect_platform)
        local url="https://github.com/sufiyan-sabeel/AIRIS-CLI/releases/download/${version}/airis-${version}-${platform}.tar.gz"

        echo -e "${BLUE}Downloading AIRIS-CLI ${version}...${NC}"
        curl -fsSL "$url" -o /tmp/airis.tar.gz

        # Verify checksum
        if command -v sha256sum &>/dev/null; then
            local expected_hash
            expected_hash=$(curl -fsSL "${url}.sha256" 2>/dev/null || echo "")
            if [ -n "$expected_hash" ]; then
                local actual_hash
                actual_hash=$(sha256sum /tmp/airis.tar.gz | cut -d' ' -f1)
                if [ "$expected_hash" != "$actual_hash" ]; then
                    echo -e "${RED}Checksum verification failed!${NC}"
                    echo -e "${RED}Expected: $expected_hash${NC}"
                    echo -e "${RED}Actual:   $actual_hash${NC}"
                    exit 1
                fi
                echo -e "${GREEN}Checksum verified${NC}"
            fi
        fi

        tar xzf /tmp/airis.tar.gz -C "$install_dir"
        rm /tmp/airis.tar.gz
    fi

    chmod +x "$install_dir/airis"

    # Add to PATH
    if [[ ":$PATH:" != *":${install_dir}:"* ]]; then
        local shell_config
        case "$SHELL" in
            */zsh) shell_config="$HOME/.zshrc" ;;
            */bash) shell_config="$HOME/.bashrc" ;;
            *) shell_config="$HOME/.profile" ;;
        esac
        echo "export PATH=\"\$PATH:${install_dir}\"" >> "$shell_config"
        echo -e "${GREEN}Added ${install_dir} to PATH in ${shell_config}${NC}"
    fi
}

# ─── Main ──────────────────────────────────────────────────────────────
main() {
    print_logo

    echo -e "${BOLD}Welcome to AIRIS-CLI Installer${NC}"
    echo -e "${DIM}This will install AIRIS-CLI, the world's most advanced open-source AI CLI.${NC}"
    echo ""

    # Detect platform
    local platform_info
    platform_info=$(detect_platform)
    local platform="${platform_info%:*}"
    local arch="${platform_info#*:}"
    echo -e "  ${CYAN}Platform:${NC}  $(uname -s) ($arch)"
    echo -e "  ${CYAN}Detected:${NC}  ${platform}"
    echo ""

    # Check dependencies
    echo -e "${BLUE}Checking dependencies...${NC}"
    check_deps
    echo -e "${GREEN}All dependencies satisfied${NC}"
    echo ""

    # Install Rust if needed
    install_rust
    echo ""

    # Install AIRIS-CLI
    install_airis "$@"
    echo ""

    # Verify installation
    if command -v airis &>/dev/null || [ -f "$HOME/.airis/airis" ]; then
        echo -e "${GREEN}${BOLD}AIRIS-CLI installed successfully!${NC}"
        echo ""
        echo -e "  ${CYAN}Try it now:${NC}"
        echo -e "    ${BOLD}airis${NC} --help"
        echo -e "    ${BOLD}airis${NC} chat"
        echo -e "    ${BOLD}airis${NC} doctor"
        echo ""
        echo -e "  ${CYAN}Documentation:${NC}"
        echo -e "    https://kageos.dev/airis"
        echo ""
    else
        echo -e "${RED}Installation failed.${NC}"
        echo -e "${YELLOW}Please try building from source:${NC}"
        echo "  cargo build --release -p airis-cli"
        echo "  ./target/release/airis --help"
        exit 1
    fi
}

main "$@"
