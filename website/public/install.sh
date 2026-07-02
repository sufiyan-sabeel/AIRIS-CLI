#!/bin/sh
# AIRIS CLI - Binary Installer
# curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh

set -eu

REPO="sufiyan-sabeel/AIRIS-CLI"
VERSION="${VERSION:-latest}"
BINDIR="${BINDIR:-/usr/local/bin}"
INSTALL_DIR="${AIRIS_INSTALL_DIR:-${HOME}/.airis/bin/airis}"

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

download_and_install() {
    PLATFORM="$(detect_platform)"
    echo "Downloading AIRIS CLI ${VERSION} for ${PLATFORM}..."

    TMPDIR="$(mktemp -d)"
    trap 'rm -rf "$TMPDIR"' EXIT

    mkdir -p "$INSTALL_DIR" "$BINDIR"

    if [ "$(echo "$PLATFORM" | cut -d- -f1)" = "windows" ]; then
        URL="$(download_url "airis-${PLATFORM}.zip")"
        curl -fsSL "$URL" -o "$TMPDIR/airis.zip"
        unzip -q "$TMPDIR/airis.zip" -d "$TMPDIR"
        rm -rf "${INSTALL_DIR:?}"/*
        cp -R "$TMPDIR/airis/." "$INSTALL_DIR/"
        chmod +x "$INSTALL_DIR/airis.exe"
        link_binary "$INSTALL_DIR/airis.exe" "$BINDIR/airis.exe"
        INSTALLED="$BINDIR/airis.exe"
    else
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
        echo "Warning: airis not found in PATH. Ensure ${BINDIR} is in your PATH."
    fi
}

download_and_install
