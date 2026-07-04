#!/usr/bin/env bash
# Build the optional Go token estimator for accurate compaction token counting.
# Requires Go 1.21+ installed on the build machine.
#
# Usage: ./tools/go-token-estimator/build.sh
#
# After building, the binary at tools/go-token-estimator/token-estimator
# is automatically detected by the compaction module.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "==> Building token-estimator (Go)..."

if ! command -v go &>/dev/null; then
	echo "!! Go is not installed. Skipping build."
	echo "!! Install Go from https://go.dev/dl/ and re-run this script."
	exit 0
fi

# Download dependencies
go mod download

# Build
go build -ldflags="-s -w" -o token-estimator .

echo "==> Built: $DIR/token-estimator"
echo "==> Size: $(du -h token-estimator | cut -f1)"
echo ""
echo "The compaction module will automatically detect and use this binary."
echo "To test: echo '{\"text\":\"hello world\"}' | ./token-estimator"
