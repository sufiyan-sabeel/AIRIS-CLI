# AIRIS-CLI Installer — Phase 0 Repository Audit

**Date:** 21 November 2026 · **Commit audited:** `c2baf753f` · **Branch:** `integration/pi-runtime`

Everything below was read from the repository or the GitHub API. Nothing is assumed.

## 1. What is actually distributed

| Fact | Value | Source |
|---|---|---|
| npm package (CLI) | `@sufiyan-sabeel/airis-cli@0.79.9`, bin `airis → dist/cli.js` | `packages/coding-agent/package.json` |
| Workspace packages | `airis-agent-core`, `airis-ai`, `airis-cli`, `airis-tui` — all `0.79.9` | `packages/*/package.json` |
| Latest GitHub release | `v0.79.9` (18 Jul 2026) | `gh release list` |
| Release assets | 6, listed below | `gh release view --json assets` |

### Published release assets (v0.79.9) — the only real binaries

| Asset | Size |
|---|---|
| `airis-darwin-arm64.tar.gz` | 26.6 MB |
| `airis-darwin-x64.tar.gz` | 28.9 MB |
| `airis-linux-arm64.tar.gz` | 43.1 MB |
| `airis-linux-x64.tar.gz` | 43.6 MB |
| `airis-windows-arm64.zip` | 43.3 MB |
| `airis-windows-x64.zip` | 45.4 MB |

Produced by `scripts/build-binaries.sh` using `bun build --compile`, so each archive is a **self-contained executable** (no Node.js required at runtime) plus support files (`package.json`, `README.md`, `CHANGELOG.md`, `photon_rs_bg.wasm`, `theme/`, `assets/`, `core/export-html/`). Unix archives wrap everything in a top-level `airis/` directory.

**No checksum asset is published with any release.** `gh release view` lists exactly six assets; there is no `checksums.txt` or `*.sha256`.

## 2. The existing installer is broken — three incompatible naming schemes

| Source | Assumed asset name |
|---|---|
| `install.sh:141` (current installer) | `airis-${version}-${platform}.tar.gz` → e.g. `airis-0.79.9-linux-x86_64.tar.gz` |
| `.github/workflows/ci-cd.yml:165` | `airis-${ref_name}-linux-x86_64.tar.gz` |
| `scripts/build-binaries.sh:18-23` and the real release | `airis-linux-x64.tar.gz` (no version, `x64` not `x86_64`) |

The published assets match **only** the third. So `install.sh`'s download URL points at an asset that does not exist, and its fallback is to clone the repo and build from Rust source (`cargo build --release`), which the shipped releases do not need.

It also attempts `${url}.sha256` (`install.sh:149`), which is not published either, so verification silently degrades to nothing — a direct violation of the "never silently skip checksum verification" rule.

## 3. Other installers present

| File | Lines | Purpose |
|---|---|---|
| `install.sh` | 234 | binary installer (broken URL pattern, see §2) |
| `setup.sh` | 166 | source setup |
| `setup-termux.sh` | 62 | Termux source setup |
| `setup-standalone-deploy.sh` | — | deployment helper |

Four overlapping scripts already exist. A new installer must not become a fifth competing entry point.

## 4. Documentation state

`README.md:21` instructs users to run:

```
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash
```

That is a GitHub Pages URL, and a `deploy-pages.yml` workflow exists, but **this audit could not verify that the URL serves the current script** (the sandbox has no access to that host). It must be verified before it is advertised as the official installer.

## 5. What exists that the installer can rely on

| Capability | Status |
|---|---|
| `airis doctor` command | **exists** (`packages/coding-agent/src/cli/airis-commands.ts:156`, `:280`) |
| `airis --version` | works (`0.79.9`) |
| GitHub Releases with 6 platform binaries | **real** |
| npm publishing workflow | exists (`npm-publish.yml`) |
| Rust crates | exist, but the shipped binaries do not need them |

## 6. Platform reality check

The six published assets mean **linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64, windows-arm64 are genuinely built**. Two caveats:

- **Alpine/musl** is *not* a separate build. A glibc-compiled Bun binary will not run on musl without `gcompat`, so Alpine cannot be claimed as supported without testing.
- **Termux/Android ARM64** is not a published asset either. Termux needs a compatible binary; this is unverified.

Claiming either as supported would be fabrication. They will be detected and reported honestly.

## 7. Consequences for the implementation

1. Rewrite `install.sh` to resolve the **real** asset names; do not add a fifth script.
2. Publish checksums (`checksums.txt`) from the release workflow so verification is possible; until a release carries them, the installer must **refuse** to install unverified binaries unless the user explicitly opts in.
3. Detect Termux, musl and unsupported architectures and say so plainly rather than guessing.
4. Preserve `~/.config/airis` and `~/.airis` on install/update/uninstall.
5. Keep `airis doctor` as the post-install health check rather than inventing a second one.
