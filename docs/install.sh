#!/bin/sh
# AIRIS CLI - Binary Installer
# curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh

set -eu

REPO="sufiyan-sabeel/AIRIS-CLI"
VERSION="${VERSION:-v0.79.5}"
BINDIR="${BINDIR:-/usr/local/bin}"

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

download_and_install() {
    PLATFORM="$(detect_platform)"
    echo "Downloading AIRIS CLI ${VERSION} for ${PLATFORM}..."

    TMPDIR="$(mktemp -d)"
    trap 'rm -rf "$TMPDIR"' EXIT

    if [ "$(echo "$PLATFORM" | cut -d- -f1)" = "windows" ]; then
        URL="https://github.com/${REPO}/releases/download/${VERSION}/airis-${PLATFORM}.zip"
        curl -fsSL "$URL" -o "$TMPDIR/airis.zip"
        unzip -q "$TMPDIR/airis.zip" -d "$TMPDIR"
        mkdir -p "$BINDIR"
        cp "$TMPDIR/airis/airis.exe" "$BINDIR/airis.exe"
        chmod +x "$BINDIR/airis.exe"
        INSTALLED="$BINDIR/airis.exe"
    else
        URL="https://github.com/${REPO}/releases/download/${VERSION}/airis-${PLATFORM}.tar.gz"
        curl -fsSL "$URL" | tar -xz -C "$TMPDIR"
        mkdir -p "$BINDIR"
        cp "$TMPDIR/airis/airis" "$BINDIR/airis"
        chmod +x "$BINDIR/airis"
        INSTALLED="$BINDIR/airis"
    fi

    echo "Installed to $INSTALLED"

    echo "Verifying installation..."
    if command -v airis >/dev/null 2>&1; then
        airis --version
        echo "AIRIS CLI installed successfully!"
    else
        echo "Warning: airis not found in PATH. Ensure ${BINDIR} is in your PATH."
    fi
}

download_and_install
