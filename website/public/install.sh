#!/bin/sh
# AIRIS CLI - Binary Installer
# curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh

set -eu

REPO="sufiyan-sabeel/AIRIS-CLI"
VERSION="${VERSION:-latest}"
USER_HOME="${HOME:-.}"
BINDIR="${BINDIR:-}"
INSTALL_DIR="${AIRIS_INSTALL_DIR:-${USER_HOME}/.airis/bin/airis}"

is_termux() {
    [ -n "${ANDROID_ROOT:-}" ] || [ -d "/data/data/com.termux/files/usr" ] || printf '%s' "${PREFIX:-}" | grep -q 'com.termux'
}

choose_bindir() {
    if [ -n "$BINDIR" ]; then
        printf '%s\n' "$BINDIR"
        return 0
    fi

    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    case "$OS" in
        mingw*|msys*|cygwin*)
            printf '%s\n' "${USER_HOME}/.local/bin"
            return 0
            ;;
    esac

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

detect_platform() {
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH="$(uname -m)"

    case "$OS" in
        linux|darwin) ;;
        mingw*|msys*|cygwin*) OS="windows" ;;
        *) echo "Unsupported OS: $OS"; exit 1 ;;
    esac

    case "$ARCH" in
        x86_64|amd64) ARCH="x64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *) echo "Unsupported arch: $ARCH"; exit 1 ;;
    esac

    echo "${OS}-${ARCH}"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing required command: $1"
        exit 1
    fi
}

download_url() {
    ASSET="$1"
    if [ "$VERSION" = "latest" ]; then
        echo "https://github.com/${REPO}/releases/latest/download/${ASSET}"
    else
        echo "https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"
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

    echo "Warning: $BINDIR is not in PATH. Add it before running airis globally:"
    echo "  export PATH=\"$BINDIR:\$PATH\""
}

download_and_install() {
    require_command curl
    PLATFORM="$(detect_platform)"
    BINDIR="$(choose_bindir)"
    echo "Downloading AIRIS CLI ${VERSION} for ${PLATFORM}..."
    echo "Installing command to ${BINDIR}"
    echo "Installing package files to ${INSTALL_DIR}"

    TMPDIR="$(mktemp -d)"
    trap 'rm -rf "$TMPDIR"' EXIT

    mkdir -p "$INSTALL_DIR" "$BINDIR"

    if [ "$(echo "$PLATFORM" | cut -d- -f1)" = "windows" ]; then
        require_command unzip
        URL="$(download_url "airis-${PLATFORM}.zip")"
        curl -fsSL "$URL" -o "$TMPDIR/airis.zip"
        unzip -q "$TMPDIR/airis.zip" -d "$TMPDIR"
        rm -rf "${INSTALL_DIR:?}"/*
        cp -R "$TMPDIR/airis/." "$INSTALL_DIR/"
        chmod +x "$INSTALL_DIR/airis.exe"
        link_binary "$INSTALL_DIR/airis.exe" "$BINDIR/airis.exe"
        INSTALLED="$BINDIR/airis.exe"
    else
        require_command tar
        URL="$(download_url "airis-${PLATFORM}.tar.gz")"
        curl -fsSL "$URL" | tar -xz -C "$TMPDIR"
        rm -rf "${INSTALL_DIR:?}"/*
        cp -R "$TMPDIR/airis/." "$INSTALL_DIR/"
        chmod +x "$INSTALL_DIR/airis"
        link_binary "$INSTALL_DIR/airis" "$BINDIR/airis"
        INSTALLED="$BINDIR/airis"
    fi

    echo "Installed to $INSTALLED"
    echo "Package files installed to $INSTALL_DIR"

    echo "Verifying installation..."
    if "$INSTALLED" --version >/dev/null 2>&1; then
        "$INSTALLED" --version
        echo "AIRIS CLI installed successfully!"
    else
        echo "Warning: AIRIS was installed but verification failed."
        exit 1
    fi

    if ! command -v airis >/dev/null 2>&1; then
        warn_path
    fi
}

download_and_install
