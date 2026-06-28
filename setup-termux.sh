#!/data/data/com.termux/files/usr/bin/bash
# Setup script for AIRIS-CLI in native Termux
# Run from native Termux: bash /sdcard/Download/AIRIS-CLI/setup-termux.sh

set -e

REPO="/sdcard/Download/AIRIS-CLI"
TARGET="$HOME/AIRIS-CLI"
BIN="/data/data/com.termux/files/usr/bin/airis"

echo "=== AIRIS-CLI Termux Setup ==="

# 1. Copy repo to internal storage (supports symlinks)
if [ ! -d "$TARGET" ]; then
    echo "[1/5] Copying repo to $TARGET ..."
    cp -r "$REPO" "$TARGET"
else
    echo "[1/5] Repo already at $TARGET, syncing source files ..."
    # Sync all source files (not node_modules, not .git)
    cd "$REPO"
    find . -not -path './node_modules/*' -not -path './.git/*' -not -path '*/node_modules/*' -type f | while read f; do
        mkdir -p "$(dirname "$TARGET/$f")"
        cp -f "$f" "$TARGET/$f"
    done
fi

# 2. Sync dist folders from /sdcard
echo "[2/5] Syncing built dist files ..."
for pkg_dir in "$REPO"/packages/*/dist; do
    pkg_name=$(basename "$(dirname "$pkg_dir")")
    if [ -d "$pkg_dir" ]; then
        mkdir -p "$TARGET/packages/$pkg_name/dist"
        cp -rf "$pkg_dir"/* "$TARGET/packages/$pkg_name/dist/"
        echo "  synced packages/$pkg_name/dist"
    fi
done

# 3. Remove stale node_modules
echo "[3/5] Cleaning stale node_modules ..."
rm -rf "$TARGET/node_modules"
for pkg in "$TARGET"/packages/*/node_modules; do
    [ -d "$pkg" ] && rm -rf "$pkg"
done

# 4. Install dependencies
echo "[4/5] Installing dependencies ..."
cd "$TARGET"
npm install --ignore-scripts

# 5. Create airis wrapper script
echo "[5/5] Installing airis command ..."
cat > "$BIN" << 'WRAPPER'
#!/data/data/com.termux/files/usr/bin/bash
exec node "$HOME/AIRIS-CLI/packages/coding-agent/dist/cli.js" "$@"
WRAPPER
chmod +x "$BIN"

echo ""
echo "=== Done ==="
echo "airis should now work from any Termux shell."
echo "Test: airis --version"
airis --version
