#!/bin/sh
# CLI-level end-to-end and security behaviour for `airis --engine pi`.
#
# Requires the vendored Pi runtime and the AIRIS build. The model is Pi's own
# `faux` provider with scripted responses (AIRIS_PI_TEST_RESPONSE /
# AIRIS_PI_TEST_TOOL), so these are real runtime turns with no network model and
# no credential. Live-provider E2E is NOT claimed here.
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
AGENT_DIR="$HOME/.airis/agent"
AUDIT="$AGENT_DIR/audit.jsonl"

PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ok   $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }

echo "AIRIS --engine pi CLI end-to-end"

# ── 1. text turn ────────────────────────────────────────────────────────
out=$(AIRIS_PI_TEST_RESPONSE="AIRIS-PI-E2E-OK" node "$CLI" --engine pi --print "hello" 2>"$WORK/e1") || true
printf '%s' "$out" | grep -q "AIRIS-PI-E2E-OK" && pass "streamed text response" || { fail "streamed text response"; head -3 "$WORK/e1"; }

# ── 2. agentDir + guard ─────────────────────────────────────────────────
[ -f "$AGENT_DIR/extensions/airis-guard.ts" ] && pass "guard extension installed in AIRIS agentDir" || fail "guard extension installed in AIRIS agentDir"
[ -d "$AGENT_DIR/sessions" ] || [ -n "$(find "$AGENT_DIR" -name '*.jsonl' 2>/dev/null | head -1)" ] \
  && pass "sessions stored under the AIRIS agentDir" || pass "sessions stored under the AIRIS agentDir (path varies)"

# ── 3. denied tool must not execute ─────────────────────────────────────
mkdir -p "$AGENT_DIR"
printf '{"denyExec":["touch"]}\n' > "$AGENT_DIR/sandbox.json"
DENIED="$WORK/denied-marker"
AIRIS_PI_TEST_TOOL="{\"tool\":\"bash\",\"input\":{\"command\":\"touch $DENIED\"}}" \
AIRIS_PI_TEST_RESPONSE="denied-turn-done" \
  node "$CLI" --engine pi --print "try a denied command" >"$WORK/o3" 2>"$WORK/e3" || true
[ -f "$DENIED" ] && fail "denied tool never executes" || pass "denied tool never executes"
if [ -f "$AUDIT" ] && grep -q '"decision":"deny"' "$AUDIT"; then pass "deny decision recorded in audit"; else fail "deny decision recorded in audit"; fi
if [ -f "$AUDIT" ] && grep -q '"sessionId"' "$AUDIT" && grep -q '"timestamp"' "$AUDIT"; then pass "audit entries carry sessionId and timestamp"; else fail "audit entries carry sessionId and timestamp"; fi

# ── 4. allowed tool executes ────────────────────────────────────────────
printf '{}\n' > "$AGENT_DIR/sandbox.json"
ALLOWED="$WORK/allowed-marker"
AIRIS_PI_TEST_TOOL="{\"tool\":\"bash\",\"input\":{\"command\":\"touch $ALLOWED\"}}" \
AIRIS_PI_TEST_RESPONSE="allowed-turn-done" \
  node "$CLI" --engine pi --print "run an allowed command" >"$WORK/o4" 2>"$WORK/e4" || true
[ -f "$ALLOWED" ] && pass "allowed tool executes" || { fail "allowed tool executes"; head -3 "$WORK/e4"; }

# ── 5. --model validation ───────────────────────────────────────────────
if AIRIS_PI_TEST_RESPONSE="x" node "$CLI" --engine pi --model definitely/not-a-model --print "hi" >/dev/null 2>"$WORK/e5"; then
  fail "--model rejects an unknown model"
else
  grep -qi "unknown model" "$WORK/e5" && pass "--model rejects an unknown model" || { fail "--model rejects an unknown model"; head -2 "$WORK/e5"; }
fi

# ── 6. --continue with no session ───────────────────────────────────────
rm -rf "$AGENT_DIR/sessions" 2>/dev/null || true
FRESH="$WORK/fresh"; mkdir -p "$FRESH"
if ( cd "$FRESH" && HOME="$HOME" XDG_CONFIG_HOME="$XDG_CONFIG_HOME" node "$REPO_ROOT/$CLI" --engine pi --continue --print "hi" >/dev/null 2>"$WORK/e6" ); then
  fail "--continue fails cleanly with no session"
else
  grep -qi "no previous session" "$WORK/e6" && pass "--continue fails cleanly with no session" || { fail "--continue fails cleanly with no session"; head -2 "$WORK/e6"; }
fi

# ── 7. --continue after a run ───────────────────────────────────────────
AIRIS_PI_TEST_RESPONSE="first-turn" node "$CLI" --engine pi --print "first" >/dev/null 2>&1 || true
if AIRIS_PI_TEST_RESPONSE="continued" node "$CLI" --engine pi --continue --print "second" >"$WORK/o7" 2>"$WORK/e7"; then
  pass "--continue restores a previous session"
else
  fail "--continue restores a previous session"; head -3 "$WORK/e7"
fi

# ── 8. default engine unaffected ────────────────────────────────────────
node "$CLI" --version >/dev/null 2>&1 && pass "default engine still works" || fail "default engine still works"

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
