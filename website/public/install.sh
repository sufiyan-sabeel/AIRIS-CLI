#!/bin/sh
# AIRIS CLI - Adaptive binary installer
# curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh

set -eu

REPO="sufiyan-sabeel/AIRIS-CLI"
VERSION="${VERSION:-latest}"
USER_HOME="${HOME:-.}"
BINDIR="${BINDIR:-}"
INSTALL_DIR="${AIRIS_INSTALL_DIR:-}"
PLATFORM=""
INSTALLED=""
TMPDIR=""

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    BOLD='\033[1m'
    DIM='\033[2m'
    GREEN='\033[32m'
    CYAN='\033[36m'
    YELLOW='\033[33m'
    RED='\033[31m'
    NC='\033[0m'
else
    BOLD=''
    DIM=''
    GREEN=''
    CYAN=''
    YELLOW=''
    RED=''
    NC=''
fi

info() { printf '%s\n' "${CYAN}==>${NC} $*"; }
success() { printf '%s\n' "${GREEN}✓${NC} $*"; }
warn() { printf '%s\n' "${YELLOW}Warning:${NC} $*"; }
fail() { printf '%s\n' "${RED}Error:${NC} $*" >&2; exit 1; }

is_termux() {
    printf '%s' "${PREFIX:-}" | grep -q 'com.termux'
}

is_windows_shell() {
    case "$(uname -s | tr '[:upper:]' '[:lower:]')" in
        mingw*|msys*|cygwin*) return 0 ;;
        *) return 1 ;;
    esac
}

am_root() {
    [ "$(id -u 2>/dev/null || echo 1)" = "0" ]
}

choose_bindir() {
    if [ -n "$BINDIR" ]; then
        printf '%s\n' "$BINDIR"
        return 0
    fi

    if is_windows_shell; then
        printf '%s\n' "${USER_HOME}/.local/bin"
        return 0
    fi

    if is_termux; then
        printf '%s\n' "${PREFIX:-${USER_HOME}/.local}/bin"
        return 0
    fi

    if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
        printf '%s\n' "/usr/local/bin"
        return 0
    fi

    printf '%s\n' "${USER_HOME}/.local/bin"
}

choose_install_dir() {
    if [ -n "$INSTALL_DIR" ]; then
        printf '%s\n' "$INSTALL_DIR"
        return 0
    fi

    if is_windows_shell; then
        printf '%s\n' "${USER_HOME}/.local/share/airis"
        return 0
    fi

    if is_termux; then
        printf '%s\n' "${PREFIX:-${USER_HOME}/.local}/opt/airis"
        return 0
    fi

    if am_root || { [ -d "/opt" ] && [ -w "/opt" ]; }; then
        printf '%s\n' "/opt/airis"
        return 0
    fi

    printf '%s\n' "${USER_HOME}/.local/share/airis"
}

detect_platform() {
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH="$(uname -m)"

    case "$OS" in
        linux|darwin) ;;
        mingw*|msys*|cygwin*) OS="windows" ;;
        *) fail "Unsupported OS: $OS" ;;
    esac

    case "$ARCH" in
        x86_64|amd64) ARCH="x64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *) fail "Unsupported CPU architecture: $ARCH. AIRIS release binaries support x64 and arm64." ;;
    esac

    echo "${OS}-${ARCH}"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        fail "Missing required command: $1"
    fi
}

make_tmpdir() {
    mktemp -d 2>/dev/null || mktemp -d -t airis
}

download_url() {
    ASSET="$1"
    if [ "$VERSION" = "latest" ]; then
        echo "https://github.com/${REPO}/releases/latest/download/${ASSET}"
    else
        echo "https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"
    fi
}

run_step() {
    MESSAGE="$1"
    shift

    if [ -t 1 ] && [ "${AIRIS_NO_SPINNER:-0}" != "1" ]; then
        printf '%s' "${CYAN}•${NC} ${MESSAGE} "
        "$@" >/tmp/airis-installer-step.log 2>&1 &
        PID=$!
        SPIN='|/-\\'
        I=1
        while kill -0 "$PID" 2>/dev/null; do
            C=$(printf '%s' "$SPIN" | cut -c "$I")
            printf '\r%s' "${CYAN}•${NC} ${MESSAGE} ${DIM}${C}${NC}"
            I=$((I + 1))
            [ "$I" -gt 4 ] && I=1
            sleep 0.12
        done
        if wait "$PID"; then
            printf '\r%s\n' "${GREEN}✓${NC} ${MESSAGE}"
            rm -f /tmp/airis-installer-step.log
        else
            printf '\r%s\n' "${RED}✗${NC} ${MESSAGE}"
            cat /tmp/airis-installer-step.log >&2 || true
            rm -f /tmp/airis-installer-step.log
            exit 1
        fi
    else
        info "$MESSAGE"
        "$@"
        success "$MESSAGE"
    fi
}

link_binary() {
    SOURCE="$1"
    TARGET="$2"

    rm -f "$TARGET"
    if ln -s "$SOURCE" "$TARGET" 2>/dev/null; then
        return 0
    fi
    cp "$SOURCE" "$TARGET"
}

warn_path() {
    case ":$PATH:" in
        *":$BINDIR:"*) return 0 ;;
    esac

    warn "$BINDIR is not in PATH. Add it before running airis globally:"
    echo "  export PATH=\"$BINDIR:\$PATH\""
}

print_header() {
    printf '%s\n' "${BOLD}AIRIS CLI adaptive installer${NC}"
    printf '%s\n' "${DIM}GitHub: https://github.com/${REPO}${NC}"
}

install_payload() {
    mkdir -p "$INSTALL_DIR" "$BINDIR"
    rm -rf "${INSTALL_DIR:?}"/*
    cp -R "$TMPDIR/airis/." "$INSTALL_DIR/"
}

download_and_install() {
    require_command curl
    require_command cp
    require_command chmod
    require_command mkdir
    require_command rm

    PLATFORM="$(detect_platform)"
    BINDIR="$(choose_bindir)"
    INSTALL_DIR="$(choose_install_dir)"

    print_header
    info "Environment: $(uname -s) $(uname -m)"
    if is_termux; then
        info "Mode: Android Termux"
    elif is_windows_shell; then
        info "Mode: Windows shell"
    elif am_root; then
        info "Mode: root Linux/macOS/proot"
    else
        info "Mode: user Linux/macOS/proot"
    fi
    info "Platform asset: ${PLATFORM}"
    info "Version: ${VERSION}"
    info "Command path: ${BINDIR}"
    info "Package path: ${INSTALL_DIR}"

    TMPDIR="$(make_tmpdir)"
    trap 'rm -rf "$TMPDIR"' EXIT INT TERM

    if [ "$(echo "$PLATFORM" | cut -d- -f1)" = "windows" ]; then
        require_command unzip
        URL="$(download_url "airis-${PLATFORM}.zip")"
        run_step "Download AIRIS" curl -fsSL --retry 2 --retry-delay 1 "$URL" -o "$TMPDIR/airis.zip"
        run_step "Extract AIRIS" unzip -q "$TMPDIR/airis.zip" -d "$TMPDIR"
        run_step "Install AIRIS files" install_payload
        chmod +x "$INSTALL_DIR/airis.exe"
        link_binary "$INSTALL_DIR/airis.exe" "$BINDIR/airis.exe"
        INSTALLED="$BINDIR/airis.exe"
    else
        require_command tar
        URL="$(download_url "airis-${PLATFORM}.tar.gz")"
        run_step "Download AIRIS" curl -fsSL --retry 2 --retry-delay 1 "$URL" -o "$TMPDIR/airis.tar.gz"
        run_step "Extract AIRIS" tar -xzf "$TMPDIR/airis.tar.gz" -C "$TMPDIR"
        run_step "Install AIRIS files" install_payload
        chmod +x "$INSTALL_DIR/airis"
        link_binary "$INSTALL_DIR/airis" "$BINDIR/airis"
        INSTALLED="$BINDIR/airis"
    fi

    run_step "Verify AIRIS" "$INSTALLED" --version

    success "AIRIS CLI installed successfully"
    echo "Installed command: $INSTALLED"
    echo "Installed package: $INSTALL_DIR"
    warn_path
}

download_and_install
