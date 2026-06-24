#!/usr/bin/env bash
#
# AIRIS Ship Demo Script
#
# This script demonstrates the airis ship workflow in a controlled terminal.
# It starts AIRIS, runs a small task, shows TODO progress, tests, and the proof report.
#
# Usage:
#   ./demo/airis-ship-demo.sh
#
# Requirements:
#   - AIRIS installed (npm link or global install)
#   - tmux (for terminal recording)
#   - GEMINI_API_KEY or another provider key set
#
# The script runs for approximately 60 seconds and produces:
#   - A terminal recording for embedding in the README
#   - A proof report under .airis/evidence/
#
# NEVER expose API keys, tokens, or private paths in recordings.

set -euo pipefail

DEMO_DIR="/tmp/airis-demo-$$"
RECORDING_FILE="/tmp/airis-ship-demo.cast"
TERM_COLS=100
TERM_ROWS=30

cleanup() {
  tmux kill-session -t airis-demo 2>/dev/null || true
  rm -rf "$DEMO_DIR"
}

trap cleanup EXIT

echo "=== AIRIS Ship Demo ==="
echo ""
echo "This script creates a temporary directory and runs a small airis ship workflow."
echo "It requires a valid API key in the environment."
echo ""

# Verify AIRIS is available
if ! command -v airis &>/dev/null; then
  echo "Error: 'airis' not found in PATH."
  echo "Install with: npm link (from the AIRIS-CLI repo) or npm install -g @sufiyan-sabeel/airis-cli"
  exit 1
fi

# Verify API key is set
if [ -z "${GEMINI_API_KEY:-}" ] && [ -z "${OPENAI_API_KEY:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Error: No API key found."
  echo "Set one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY"
  exit 1
fi

# Create demo workspace
mkdir -p "$DEMO_DIR"
cd "$DEMO_DIR"
git init -q
git config user.email "demo@airis.dev"
git config user.name "AIRIS Demo"
cat > package.json <<'EOF'
{
  "name": "airis-demo",
  "version": "1.0.0",
  "scripts": {
    "check": "echo 'Lint passed'",
    "build": "echo 'Build succeeded'"
  }
}
EOF
git add -A && git commit -q -m "Initial commit"

echo "Demo workspace: $DEMO_DIR"
echo ""

# Start tmux session with recording
tmux new-session -d -s airis-demo -x "$TERM_COLS" -y "$TERM_ROWS"

# Start asciinema recording if available
if command -v asciinema &>/dev/null; then
  asciinema rec --command "tmux attach -t airis-demo" "$RECORDING_FILE" &
  RECORD_PID=$!
  sleep 1
fi

# Show airis --help
tmux send-keys -t airis-demo "airis --help" Enter
sleep 3

# Show airis ship help
tmux send-keys -t airis-demo "airis ship --help" Enter
sleep 2

# Start a ship workflow
tmux send-keys -t airis-demo 'airis ship start "Add a greeting function to index.js"' Enter
sleep 5

# Show status
tmux send-keys -t airis-demo "airis ship status" Enter
sleep 2

# Create the implementation file manually
cat > index.js <<'JSEOF'
function greet(name) {
  return `Hello, ${name}! Welcome to AIRIS.`;
}

module.exports = { greet };
JSEOF

# Resume to run formatting and testing
tmux send-keys -t airis-demo "airis ship resume" Enter
sleep 8

# Show final status
tmux send-keys -t airis-demo "airis ship status" Enter
sleep 2

# Show proof report if it exists
tmux send-keys -t airis-demo "cat .airis/evidence/ship-*-proof-report.md 2>/dev/null || echo 'No proof report yet'" Enter
sleep 2

# Capture final pane
echo ""
echo "=== Demo Complete ==="
echo ""
if [ -n "${RECORDING_FILE:-}" ] && [ -f "${RECORDING_FILE:-}" ]; then
  echo "Terminal recording saved to: $RECORDING_FILE"
  echo "Preview with: asciinema play $RECORDING_FILE"
  echo "Convert to GIF: agg $RECORDING_FILE demo.gif"
fi
echo ""
echo "Proof report location: $DEMO_DIR/.airis/evidence/"
echo ""
echo "To embed in README:"
echo "  [![Demo](demo.gif)](https://asciinema.org/a/RECORDING_ID)"

# Stop recording
if [ -n "${RECORD_PID:-}" ]; then
  kill "$RECORD_PID" 2>/dev/null || true
fi

# Keep tmux session alive for inspection
echo ""
echo "tmux session 'airis-demo' is still running."
echo "Attach with: tmux attach -t airis-demo"
echo "Kill with:   tmux kill-session -t airis-demo"
