#!/bin/sh
# Hermetic test suite for install.sh.
#
# Builds a fake release (fixture binary + checksums) served from a file:// base,
# then exercises every management command against a throwaway HOME. It never
# touches a real installation and never reaches the network.
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
INSTALLER="$REPO_ROOT/install.sh"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/airis-installer-tests.XXXXXX")
trap 'rm -rf "$WORK"' EXIT INT TERM

PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
fail() { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

# ── fixture release ──────────────────────────────────────────────────────
build_release() {
  version=$1; dir="$WORK/releases/v$version"
  mkdir -p "$dir" "$WORK/build/airis"
  cat > "$WORK/build/airis/airis" <<BIN
#!/bin/sh
[ "\${1:-}" = "--version" ] && echo "$version" && exit 0
echo "airis fixture $version"
BIN
  chmod +x "$WORK/build/airis/airis"
  printf '{"name":"airis"}\n' > "$WORK/build/airis/package.json"
  ( cd "$WORK/build" && tar -czf "$dir/airis-linux-x64.tar.gz" airis )
  ( cd "$dir" && sha256sum airis-linux-x64.tar.gz > checksums.txt )
}

build_release 0.79.9
build_release 0.80.0

export AIRIS_RELEASE_BASE_URL="file://$WORK/releases"
export AIRIS_ALLOW_INSECURE_BASE=1
HOME_DIR="$WORK/home"; mkdir -p "$HOME_DIR"
export HOME="$HOME_DIR"
# Keep the test hermetic: the sandbox may already set these to real paths.
export XDG_CONFIG_HOME="$HOME_DIR/.config"
export XDG_DATA_HOME="$HOME_DIR/.local/share"
PREFIX="$WORK/data"; BIN="$WORK/bin"

run() { sh "$INSTALLER" "$@" --prefix "$PREFIX" --bin-dir "$BIN" --no-modify-path; }

printf '\nAIRIS installer test suite\n'

# 1. fresh install
if run --version 0.79.9 >/dev/null 2>&1; then pass "fresh install"; else fail "fresh install"; fi
check "launcher created"        "[ -x '$BIN/airis' ]"
check "version dir created"     "[ -d '$PREFIX/versions/0.79.9' ]"
check "binary runs"             "[ \"\$('$BIN/airis' --version)\" = '0.79.9' ]"

# 2. version / list
check "version reports 0.79.9"  "[ \"\$(run version)\" = '0.79.9' ]"
check "list marks current"      "run list | grep -q '^\\* 0.79.9'"

# 3. idempotent re-install
if run --version 0.79.9 >/dev/null 2>&1; then pass "reinstall is idempotent"; else fail "reinstall is idempotent"; fi

# 4. upgrade then rollback
if run --version 0.80.0 >/dev/null 2>&1; then pass "upgrade to 0.80.0"; else fail "upgrade to 0.80.0"; fi
check "upgraded binary runs"    "[ \"\$('$BIN/airis' --version)\" = '0.80.0' ]"
if run rollback >/dev/null 2>&1; then pass "rollback"; else fail "rollback"; fi
check "rollback restored 0.79.9" "[ \"\$('$BIN/airis' --version)\" = '0.79.9' ]"

# 5. repair
if run repair >/dev/null 2>&1; then pass "repair"; else fail "repair"; fi
check "repair kept launcher"    "[ -x '$BIN/airis' ]"

# 6. doctor
check "doctor runs"             "run doctor | grep -q 'installed version'"

# 7. checksum mismatch must abort and change nothing
cp "$WORK/releases/v0.80.0/checksums.txt" "$WORK/checksums.bak"
echo "0000000000000000000000000000000000000000000000000000000000000000  airis-linux-x64.tar.gz" > "$WORK/releases/v0.80.0/checksums.txt"
before=$("$BIN/airis" --version)
if run --version 0.80.0 >/dev/null 2>&1; then fail "checksum mismatch aborts"; else pass "checksum mismatch aborts"; fi
check "mismatch preserved install" "[ \"\$('$BIN/airis' --version)\" = \"$before\" ]"
cp "$WORK/checksums.bak" "$WORK/releases/v0.80.0/checksums.txt"

# 8. missing checksums must abort unless explicitly allowed
mv "$WORK/releases/v0.80.0/checksums.txt" "$WORK/checksums.hidden"
if run --version 0.80.0 >/dev/null 2>&1; then fail "missing checksums aborts"; else pass "missing checksums aborts"; fi
if run --version 0.80.0 --allow-unverified >/dev/null 2>&1; then pass "--allow-unverified overrides explicitly"; else fail "--allow-unverified overrides explicitly"; fi
mv "$WORK/checksums.hidden" "$WORK/releases/v0.80.0/checksums.txt"

# 9. unsupported architecture
if AIRIS_FORCE_ARCH=sparc run --version 0.79.9 >/dev/null 2>&1; then fail "unsupported arch rejected"; else pass "unsupported arch rejected"; fi

# 10. missing asset
if run --version 9.9.9 >/dev/null 2>&1; then fail "missing release rejected"; else pass "missing release rejected"; fi

# 11. configuration is preserved across uninstall
mkdir -p "$HOME/.config/airis"; printf 'keep\n' > "$HOME/.config/airis/settings.json"
if run uninstall >/dev/null 2>&1; then pass "uninstall"; else fail "uninstall"; fi
check "launcher removed"        "[ ! -e '$BIN/airis' ]"
check "config preserved"        "[ -f '$HOME/.config/airis/settings.json' ]"

# 12. purge removes configuration
if run uninstall --purge >/dev/null 2>&1; then pass "uninstall --purge"; else fail "uninstall --purge"; fi
check "config purged"           "[ ! -f '$HOME/.config/airis/settings.json' ]"

# 13. dry-run changes nothing
if run --version 0.79.9 --dry-run >/dev/null 2>&1; then pass "dry-run"; else fail "dry-run"; fi
check "dry-run installed nothing" "[ ! -d '$PREFIX/versions/0.79.9' ]"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
