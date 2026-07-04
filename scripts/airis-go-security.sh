#!/usr/bin/env bash
# AIRIS Go Security Wrapper
# Bridges AIRIS CLI with Go security tooling.
# Usage: airis-go-security.sh <command> [args...]
# Passes through to tools/go/airis-security/airis-security binary.
# Builds the binary automatically if missing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GO_MOD_DIR="$PROJECT_ROOT/tools/go/airis-security"
GO_BINARY="$GO_MOD_DIR/airis-security"

# Check Go availability
if ! command -v go &>/dev/null; then
  echo "Error: Go is not installed. Install Go >= 1.22 to use security tools." >&2
  echo "  See: https://go.dev/doc/install" >&2
  exit 1
fi

# Build binary if missing or stale
if [ ! -x "$GO_BINARY" ] || [ "$GO_MOD_DIR/go.mod" -nt "$GO_BINARY" ]; then
  echo "Building airis-security..." >&2
  (cd "$GO_MOD_DIR" && go build -o "$GO_BINARY" ./cmd/airis-security) || {
    echo "Error: Failed to build airis-security." >&2
    exit 1
  }
fi

exec "$GO_BINARY" "$@"
