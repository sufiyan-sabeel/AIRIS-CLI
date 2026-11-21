#!/bin/sh
# AIRIS-CLI installer — install, update, repair, roll back and uninstall.
#
#   curl -fsSL https://raw.githubusercontent.com/sufiyan-sabeel/AIRIS-CLI/main/install.sh | sh
#
# Assets are resolved by their real published names (see scripts/build-binaries.sh):
#   airis-<os>-<arch>.tar.gz   (unix)   airis-<os>-<arch>.zip   (windows)
#
# Checksums are verified against the release's checksums.txt. If a release does
# not publish one, installation aborts unless the user passes --allow-unverified.
set -eu

REPO="sufiyan-sabeel/AIRIS-CLI"
# Test-only override; the real base is the GitHub release download URL.
RELEASE_BASE="${AIRIS_RELEASE_BASE_URL:-https://github.com/${REPO}/releases/download}"

# Downloads must be HTTPS. A non-HTTPS base is only allowed when a test harness
# explicitly opts in, so the guarantee cannot be weakened by accident.
case "$RELEASE_BASE" in
  https://*) ;;
  *) [ "${AIRIS_ALLOW_INSECURE_BASE:-0}" = "1" ] || \
       { printf 'error: refusing non-HTTPS release base: %s\n' "$RELEASE_BASE" >&2; exit 1; } ;;
esac

AIRIS_HOME="${AIRIS_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/airis}"
AIRIS_BIN="${AIRIS_BIN:-$HOME/.local/bin}"
AIRIS_CONFIG="${AIRIS_CONFIG:-${XDG_CONFIG_HOME:-$HOME/.config}/airis}"

CHANNEL="stable"
WANT_VERSION=""
ALLOW_UNVERIFIED=0
DRY_RUN=0
ASSUME_YES=0
MODIFY_PATH=1
PURGE=0
COMMAND=""

# ── output ───────────────────────────────────────────────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$(printf '\033[0m'); C_BOLD=$(printf '\033[1m'); C_DIM=$(printf '\033[2m')
  C_CYAN=$(printf '\033[0;36m'); C_GREEN=$(printf '\033[0;32m')
  C_YELLOW=$(printf '\033[0;33m'); C_RED=$(printf '\033[0;31m')
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""
fi

info()  { printf '%s\n' "$*"; }
ok()    { printf '%s%s%s\n' "$C_GREEN" "$*" "$C_RESET"; }
warn()  { printf '%s%s%s\n' "$C_YELLOW" "$*" "$C_RESET" >&2; }
die()   { printf '%serror:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
AIRIS-CLI installer

Usage:
  install.sh [command] [options]

Commands:
  (none), install   Install the latest release
  update, upgrade   Update an existing installation
  rollback          Switch back to the previously installed version
  repair            Re-link the binary and verify the current version
  uninstall         Remove AIRIS-CLI (keeps configuration unless --purge)
  doctor            Diagnose an existing installation
  version           Print the installed version
  list              List installed versions

Options:
  --version <v>          Install a specific release, e.g. --version 0.79.9
  --channel stable|nightly   Release channel (default: stable)
  --prefix <dir>         Install root (default: ~/.local/share/airis)
  --bin-dir <dir>        Where to place the `airis` launcher (default: ~/.local/bin)
  --allow-unverified     Proceed even if the release publishes no checksums
  --no-modify-path       Do not touch shell configuration
  --purge                With uninstall: also delete configuration
  --dry-run              Show what would happen, change nothing
  -y, --yes              Do not prompt
  -h, --help             This help
USAGE
}

# ── platform detection ───────────────────────────────────────────────────
detect_os() {
  # Test-only override so platform branches can be exercised without the hardware.
  [ -n "${AIRIS_FORCE_OS:-}" ] && { echo "$AIRIS_FORCE_OS"; return 0; }
  os=$(uname -s 2>/dev/null || echo unknown)
  case "$os" in
    Linux)
      if [ -n "${TERMUX_VERSION:-}" ] || [ -n "${ANDROID_ROOT:-}" ] || \
         { [ -n "${PREFIX:-}" ] && printf '%s' "$PREFIX" | grep -q 'com.termux'; }; then
        echo "termux"
      else
        echo "linux"
      fi ;;
    Darwin) echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

detect_arch() {
  # Test-only override, mirroring AIRIS_FORCE_OS.
  [ -n "${AIRIS_FORCE_ARCH:-}" ] && { echo "$AIRIS_FORCE_ARCH"; return 0; }
  arch=$(uname -m 2>/dev/null || echo unknown)
  case "$arch" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "unknown" ;;
  esac
}

is_musl() {
  [ -f /lib/ld-musl-x86_64.so.1 ] || [ -f /lib/ld-musl-aarch64.so.1 ] && return 0
  if command -v ldd >/dev/null 2>&1; then
    ldd --version 2>&1 | grep -qi musl && return 0
  fi
  return 1
}

# Maps the detected platform to a published asset name, or explains why not.
resolve_asset() {
  os=$1; arch=$2
  if [ "$os" = "unknown" ] || [ "$arch" = "unknown" ]; then
    die "unsupported platform: $(uname -s 2>/dev/null || echo '?')/$(uname -m 2>/dev/null || echo '?'). Published builds: linux x64/arm64, macOS x64/arm64, windows x64/arm64."
  fi
  case "$os" in
    termux)
      # No Termux/Android binary is published. Say so instead of installing a
      # glibc build that would fail at runtime.
      die "Termux/Android is not yet supported: no Android release binary is published. Use the source install documented in INSTALL.md, or wait for an Android build."
      ;;
    linux)
      if is_musl; then
        die "Alpine/musl is not supported: the published Linux binary is glibc-linked. Install 'gcompat' or use the source install documented in INSTALL.md."
      fi
      echo "airis-linux-${arch}.tar.gz" ;;
    darwin) echo "airis-darwin-${arch}.tar.gz" ;;
    windows) echo "airis-windows-${arch}.zip" ;;
    *) die "unsupported OS: $os" ;;
  esac
}

# ── release resolution ───────────────────────────────────────────────────
api_get() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --proto '=https' --tlsv1.2 -H 'Accept: application/vnd.github+json' "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O - "$1"
  else
    die "neither curl nor wget is available; install one and retry"
  fi
}

download() {
  case "$1" in
    file://*) cp "${1#file://}" "$2" 2>/dev/null || return 1; return 0 ;;
  esac
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --proto '=https' --tlsv1.2 -o "$2" "$1"
  else
    wget -q -O "$2" "$1"
  fi
}

# Extracts a tag from GitHub's JSON, which may be minified or pretty-printed.
tag_from_json() {
  sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1
}

resolve_version() {
  if [ -n "$WANT_VERSION" ]; then
    case "$WANT_VERSION" in
      v*) echo "$WANT_VERSION" ;;
      *) echo "v$WANT_VERSION" ;;
    esac
    return 0
  fi

  if [ "$CHANNEL" = "nightly" ]; then
    # Nightly = newest prerelease; fall back to the newest release if none.
    json=$(api_get "https://api.github.com/repos/${REPO}/releases?per_page=10") \
      || die "could not reach the GitHub API to resolve a nightly release"
    tag=$(printf '%s' "$json" | tag_from_json)
    [ -n "$tag" ] || die "no nightly (prerelease) build is published for ${REPO}"
    echo "$tag"
    return 0
  fi

  json=$(api_get "https://api.github.com/repos/${REPO}/releases/latest") \
    || die "could not reach the GitHub API to resolve the latest release (rate limited? pass --version <v>)"
  tag=$(printf '%s' "$json" | tag_from_json)
  [ -n "$tag" ] || die "the latest release has no tag_name; pass --version <v> explicitly"
  echo "$tag"
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1
  elif command -v openssl >/dev/null 2>&1; then openssl dgst -sha256 "$1" | sed 's/.*= //'
  else die "no sha256 tool available (sha256sum, shasum or openssl)"; fi
}

# ── install ──────────────────────────────────────────────────────────────
cmd_install() {
  os=$(detect_os); arch=$(detect_arch); asset=$(resolve_asset "$os" "$arch")
  tag=$(resolve_version)
  version=${tag#v}

  info "${C_BOLD}${C_CYAN}AIRIS-CLI${C_RESET} ${C_DIM}install${C_RESET}"
  info "  platform:  ${os}/${arch}"
  info "  release:   ${tag} (${CHANNEL})"
  info "  asset:     ${asset}"
  info "  target:    ${AIRIS_HOME}/versions/${version}"

  if [ "$DRY_RUN" -eq 1 ]; then
    ok "dry run: no changes made"
    return 0
  fi

  tmp=$(mktemp -d "${TMPDIR:-/tmp}/airis-install.XXXXXX") || die "cannot create a temporary directory"
  trap 'rm -rf "$tmp"' EXIT INT TERM

  url="${RELEASE_BASE}/${tag}/${asset}"
  info "  downloading ${url}"
  download "$url" "$tmp/$asset" || die "download failed. Check the release exists and your network connection."

  # ── checksum verification (never silently skipped) ──
  checksums_url="${RELEASE_BASE}/${tag}/checksums.txt"
  if download "$checksums_url" "$tmp/checksums.txt" 2>/dev/null; then
    expected=$(grep " ${asset}\$" "$tmp/checksums.txt" | cut -d' ' -f1 || true)
    [ -n "$expected" ] || die "checksums.txt exists but lists no entry for ${asset}; refusing to install"
    actual=$(sha256_of "$tmp/$asset")
    if [ "$expected" != "$actual" ]; then
      die "checksum mismatch for ${asset}
  expected: ${expected}
  actual:   ${actual}
Nothing was installed; any previous installation is untouched."
    fi
    ok "  checksum verified (sha256)"
  else
    if [ "$ALLOW_UNVERIFIED" -ne 1 ]; then
      die "release ${tag} publishes no checksums.txt, so ${asset} cannot be verified.
Refusing to install an unverified binary. Options:
  - install a release that publishes checksums, or
  - re-run with --allow-unverified to accept the risk explicitly."
    fi
    warn "  WARNING: no checksums published; installing unverified binary (--allow-unverified)"
  fi

  dest="${AIRIS_HOME}/versions/${version}"
  mkdir -p "${AIRIS_HOME}/versions" "$AIRIS_BIN"
  stage="$tmp/stage"; mkdir -p "$stage"

  case "$asset" in
    *.zip) (cd "$stage" && unzip -q "$tmp/$asset") || die "could not extract ${asset}" ;;
    *.tar.gz) (cd "$stage" && tar -xzf "$tmp/$asset") || die "could not extract ${asset}" ;;
  esac

  # Archives wrap their contents in a top-level "airis" directory.
  src="$stage/airis"
  [ -d "$src" ] || src="$stage"
  [ -f "$src/airis" ] || [ -f "$src/airis.exe" ] || die "archive did not contain an airis executable"

  # Atomic: stage into a temp sibling, then rename into place.
  rm -rf "${dest}.partial"
  mkdir -p "${dest}.partial"
  cp -R "$src"/. "${dest}.partial"/
  chmod +x "${dest}.partial/airis" 2>/dev/null || true
  rm -rf "$dest"
  mv "${dest}.partial" "$dest" || die "could not move the installation into place"

  link_launcher "$version"
  maybe_update_path
  print_summary "$version" "$os" "$arch"
}

link_launcher() {
  version=$1
  target="${AIRIS_HOME}/versions/${version}/airis"
  [ -f "$target" ] || target="${AIRIS_HOME}/versions/${version}/airis.exe"
  ln -sf "$target" "${AIRIS_BIN}/airis"
  # Remember the current version for rollback.
  printf '%s\n' "$version" > "${AIRIS_HOME}/current"
}

maybe_update_path() {
  [ "$MODIFY_PATH" -eq 1 ] || return 0
  case ":${PATH}:" in
    *":${AIRIS_BIN}:"*) return 0 ;;
  esac
  for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
    [ -f "$rc" ] || continue
    if grep -q "AIRIS-CLI installer" "$rc" 2>/dev/null; then return 0; fi
  done
  rc="$HOME/.profile"
  [ -n "${SHELL:-}" ] && case "$SHELL" in *zsh) [ -f "$HOME/.zshrc" ] && rc="$HOME/.zshrc" ;; esac
  if [ -f "$rc" ] && ! grep -q "${AIRIS_BIN}" "$rc" 2>/dev/null; then
    printf '\n# AIRIS-CLI installer\nexport PATH="%s:$PATH"\n' "$AIRIS_BIN" >> "$rc"
    info "  added ${AIRIS_BIN} to PATH in ${rc} (restart your shell)"
  fi
}

print_summary() {
  version=$1; os=$2; arch=$3
  launcher="${AIRIS_BIN}/airis"
  engines="airis"
  if [ -d "${AIRIS_HOME}/versions/${version}/.airis" ]; then engines="airis, pi (adapter present)"; fi
  runtime_status="not checked"
  if [ -x "$launcher" ]; then
    if "$launcher" --version >/dev/null 2>&1; then runtime_status="ok"; else runtime_status="binary did not run"; fi
  fi
  config_status="absent"
  [ -d "$AIRIS_CONFIG" ] && config_status="present"
  [ -d "$HOME/.airis" ] && config_status="present (~/.airis)"

  printf '\n'
  ok "AIRIS-CLI installed"
  printf '%s\n' "  Created by Umaiz Sufiyan"
  printf '%s\n' "  version:     ${version}"
  printf '%s\n' "  platform:    ${os}/${arch}"
  printf '%s\n' "  install dir: ${AIRIS_HOME}/versions/${version}"
  printf '%s\n' "  launcher:    ${launcher}"
  printf '%s\n' "  engines:     ${engines}"
  printf '%s\n' "  runtime:     ${runtime_status}"
  printf '%s\n' "  config:      ${config_status}"
  printf '\nNext steps:\n  airis --version\n  airis doctor\n  airis\n'
}

# ── other commands ───────────────────────────────────────────────────────
installed_versions() {
  [ -d "${AIRIS_HOME}/versions" ] || return 0
  for d in "${AIRIS_HOME}/versions"/*; do
    [ -d "$d" ] || continue
    printf '%s\n' "$(basename "$d")"
  done
}

current_version() {
  [ -f "${AIRIS_HOME}/current" ] && cat "${AIRIS_HOME}/current" || true
}

cmd_update() { cmd_install; }

cmd_rollback() {
  cur=$(current_version)
  [ -n "$cur" ] || die "no installation found (missing ${AIRIS_HOME}/current)"
  prev=""
  for v in $(installed_versions); do [ "$v" = "$cur" ] && continue; prev="$v"; done
  [ -n "$prev" ] || die "no other version installed; nothing to roll back to"
  link_launcher "$prev"
  ok "rolled back to ${prev}"
}

cmd_repair() {
  cur=$(current_version)
  [ -n "$cur" ] || die "no installation found to repair"
  [ -d "${AIRIS_HOME}/versions/${cur}" ] || die "version ${cur} is recorded but missing on disk; run: install.sh --version ${cur}"
  link_launcher "$cur"
  ok "re-linked ${AIRIS_BIN}/airis -> ${cur}"
  cmd_doctor
}

cmd_doctor() {
  info "${C_BOLD}AIRIS-CLI doctor${C_RESET}"
  cur=$(current_version)
  printf '%s\n' "  installed version: ${cur:-none}"
  printf '%s\n' "  install root:      ${AIRIS_HOME}"
  if [ -n "$cur" ] && [ -d "${AIRIS_HOME}/versions/${cur}" ]; then
    printf '%s\n' "  version dir:       present"
  else
    printf '%s\n' "  version dir:       MISSING"
  fi
  if [ -x "${AIRIS_BIN}/airis" ]; then
    printf '%s\n' "  launcher:          ${AIRIS_BIN}/airis"
    if v=$("${AIRIS_BIN}/airis" --version 2>/dev/null); then
      printf '%s\n' "  binary runs:       yes (${v})"
    else
      printf '%s\n' "  binary runs:       NO"
    fi
  else
    printf '%s\n' "  launcher:          missing (run: install.sh repair)"
  fi
  case ":${PATH}:" in
    *":${AIRIS_BIN}:"*) printf '%s\n' "  PATH:              contains ${AIRIS_BIN}" ;;
    *) printf '%s\n' "  PATH:              does not contain ${AIRIS_BIN}" ;;
  esac
  [ -d "$AIRIS_CONFIG" ] && printf '%s\n' "  config:            ${AIRIS_CONFIG}" || printf '%s\n' "  config:            not created yet"
}

cmd_uninstall() {
  cur=$(current_version)
  if [ "$DRY_RUN" -eq 0 ]; then
    rm -f "${AIRIS_BIN}/airis"
    rm -rf "${AIRIS_HOME}/versions"
    rm -f "${AIRIS_HOME}/current"
    rmdir "${AIRIS_HOME}" 2>/dev/null || true
    if [ "$PURGE" -eq 1 ]; then
      rm -rf "$AIRIS_CONFIG" "$HOME/.airis"
      ok "removed configuration as well (--purge)"
    fi
  fi
  ok "uninstalled ${cur:-AIRIS-CLI}"
  [ "$PURGE" -eq 1 ] || info "configuration in ${AIRIS_CONFIG} and ~/.airis was preserved"
}

cmd_version() {
  cur=$(current_version)
  [ -n "$cur" ] || die "AIRIS-CLI is not installed in ${AIRIS_HOME}"
  printf '%s\n' "$cur"
}

cmd_list() {
  cur=$(current_version)
  for v in $(installed_versions); do
    if [ "$v" = "$cur" ]; then printf '* %s\n' "$v"; else printf '  %s\n' "$v"; fi
  done
}

# ── argument parsing ─────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    install|update|upgrade|rollback|repair|uninstall|doctor|version|list) COMMAND="$1" ;;
    --version) shift; [ $# -gt 0 ] || die "--version needs a value"; WANT_VERSION="$1" ;;
    --channel) shift; [ $# -gt 0 ] || die "--channel needs a value"; CHANNEL="$1" ;;
    --prefix) shift; [ $# -gt 0 ] || die "--prefix needs a value"; AIRIS_HOME="$1" ;;
    --bin-dir) shift; [ $# -gt 0 ] || die "--bin-dir needs a value"; AIRIS_BIN="$1" ;;
    --allow-unverified) ALLOW_UNVERIFIED=1 ;;
    --no-modify-path) MODIFY_PATH=0 ;;
    --purge) PURGE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
  shift
done

case "$CHANNEL" in stable|nightly) ;; *) die "--channel must be 'stable' or 'nightly'" ;; esac

case "${COMMAND:-install}" in
  install) cmd_install ;;
  update|upgrade) cmd_update ;;
  rollback) cmd_rollback ;;
  repair) cmd_repair ;;
  uninstall) cmd_uninstall ;;
  doctor) cmd_doctor ;;
  version) cmd_version ;;
  list) cmd_list ;;
  *) usage; exit 1 ;;
esac
