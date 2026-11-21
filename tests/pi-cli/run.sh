#!/bin/sh
# CLI-level end-to-end for `airis --engine pi`.
#
# Requires the vendored Pi runtime and the AIRIS build to exist. The model is
# Pi's own `faux` provider with a scripted response (set by AIRIS_PI_TEST_RESPONSE),
# so this proves the real CLI -> adapter -> Pi session path without a network
# model or a credential. It is NOT a live-provider test and does not claim to be.
set -eu

REPO_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$REPO_ROOT"

CLI="packages/coding-agent/dist/cli.js"
[ -f "$CLI" ] || { echo "SKIP: $CLI missing (run npm run build)"; exit 0; }
[ -d vendor/pi/packages/coding-agent/dist ] || { echo "SKIP: Pi runtime not built"; exit 0; }

WORK=$(mktemp -d "${TMPDIR:-/tmp}/airis-cli-e2e.XXXXXX")
trap 'rm -rf "$WORK"' EXIT INT TERM

export HOME="$WORK/home"; mkdir -p "$HOME"
export XDG_CONFIG_HOME="$HOME/.config" XDG_DATA_HOME="$HOME/.local/share"
export AIRIS_PI_TEST_RESPONSE="AIRIS-PI-E2E-OK"

PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ok   $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }

echo "AIRIS --engine pi CLI end-to-end"

out=$(node "$CLI" --engine pi --print "hello from the cli test" 2>"$WORK/err.txt") || true
if printf '%s' "$out" | grep -q "AIRIS-PI-E2E-OK"; then
  pass "CLI streamed the scripted Pi response"
else
  fail "CLI streamed the scripted Pi response"
  echo "--- stdout ---"; printf '%s\n' "$out" | head -5
  echo "--- stderr ---"; head -5 "$WORK/err.txt"
fi

AGENT_DIR="$HOME/.airis/agent"
if [ -f "$AGENT_DIR/extensions/airis-guard.ts" ]; then
  pass "permission extension installed into agentDir"
else
  fail "permission extension installed into agentDir"
fi

if [ -f "$AGENT_DIR/audit.jsonl" ]; then
  pass "audit log written to <agentDir>/audit.jsonl"
  # Unified schema: { timestamp, type, sessionId, data }
  if head -1 "$AGENT_DIR/audit.jsonl" | grep -q '"sessionId"'; then
    pass "audit entries use the AIRIS AuditEntry schema"
  else
    fail "audit entries use the AIRIS AuditEntry schema"
  fi
else
  echo "  note  no audit entries this run (a text-only turn issues no tool calls)"
fi

# Existing engine must still work.
if node "$CLI" --version >/dev/null 2>&1; then pass "default engine still works"; else fail "default engine still works"; fi

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
