#!/usr/bin/env bash
#
# AIRIS Screenshot Capture Script
#
# Captures professional terminal screenshots for the README using tmux + scrot/screencapture.
#
# Usage:
#   ./demo/capture-screenshots.sh
#
# Requirements:
#   - tmux
#   - scrot (Linux) or screencapture (macOS) or帝img (Windows)
#   - AIRIS installed and configured with an API key
#
# Output: demo/screenshots/ directory with PNG images

set -euo pipefail

SCREENSHOT_DIR="/mnt/sdcard/Download/AIRIS-CLI/demo/screenshots"
TERM_COLS=100
TERM_ROWS=30

mkdir -p "$SCREENSHOT_DIR"

capture() {
  local name="$1"
  local session="airis-capture-$name"

  echo "Capturing: $name"

  # Start tmux session
  tmux new-session -d -s "$session" -x "$TERM_COLS" -y "$TERM_ROWS"

  # Wait for tmux to be ready
  sleep 0.5

  # Capture based on platform
  case "$(uname -s)" in
    Linux)
      if command -v scrot &>/dev/null; then
        tmux capture-pane -t "$session" -p > "/tmp/airis-capture-$name.txt"
      fi
      ;;
    Darwin)
      if command -v screencapture &>/dev/null; then
        echo "Use screencapture for macOS"
      fi
      ;;
  esac

  # For text-based screenshots, capture pane content
  tmux capture-pane -t "$session" -p > "$SCREENSHOT_DIR/$name.txt"

  # Kill session
  tmux kill-session -t "$session" 2>/dev/null || true

  echo "  Saved: $SCREENSHOT_DIR/$name.txt"
}

echo "=== AIRIS Screenshot Capture ==="
echo ""
echo "This script captures terminal content for README screenshots."
echo "For actual PNG screenshots, use a terminal recorder like:"
echo "  - VHS (https://github.com/charmbracelet/vhs)"
echo "  - asciinema + agg"
echo "  - ttyd + browser screenshot"
echo ""

# Note: Automated screenshot capture of a live TUI requires a running AIRIS instance.
# For production screenshots, use VHS or record manually.
echo "Recommended approach for professional screenshots:"
echo ""
echo "1. Install VHS: go install github.com/charmbracelet/vhs@latest"
echo "2. Create a VHS tape file (demo/airis-demo.tape)"
echo "3. Run: vhs demo/airis-demo.tape"
echo ""
echo "See demo/airis-demo.tape for a ready-to-use VHS configuration."

# Create VHS tape file for reference
cat > /mnt/sdcard/Download/AIRIS-CLI/demo/airis-demo.tape <<'EOF'
# AIRIS Demo Recording - VHS Tape File
# Install VHS: go install github.com/charmbracelet/vhs@latest
# Run: vhs demo/airis-demo.tape

output demo/screenshots/airis-demo.gif

set font-size 16
set theme Dracula
set width 100
set height 30
set margin 20
set render-speed 1
set fps 30

type "airis --help"
enter
sleep 3s

type "airis ship --help"
enter
sleep 2s

type "airis ship start \"Add a greeting function\""
enter
sleep 5s

type "airis ship status"
enter
sleep 2s

type "airis ship resume"
enter
sleep 8s

type "airis ship status"
enter
sleep 2s
EOF

echo ""
echo "VHS tape file created: demo/airis-demo.tape"
echo "Run with: vhs demo/airis-demo.tape"
