# AIRIS-CLI — Supported Platform Matrix

Every row states whether the platform has a **published binary** and whether the
installer was **actually executed** on it. "Published" is verified from GitHub
Releases; "tested" means the installer ran there. Nothing is marked verified on
the strength of the code alone.

| Platform | Arch | Asset published | Installer tested here | Status |
|---|---|---|---|---|
| Linux (glibc) | x86_64 | `airis-linux-x64.tar.gz` | **yes** — this repository's CI | **Supported** |
| Linux (glibc) | arm64 | `airis-linux-arm64.tar.gz` | no | Published, installer untested |
| macOS | arm64 | `airis-darwin-arm64.tar.gz` | no | Published, installer untested |
| macOS | x64 | `airis-darwin-x64.tar.gz` | no | Published, installer untested |
| Windows | x64 | `airis-windows-x64.zip` | no | Published; PowerShell installer untested |
| Windows | arm64 | `airis-windows-arm64.zip` | no | Published; PowerShell installer untested |
| Alpine / musl | x86_64, arm64 | **none** (glibc-only build) | no | **Not supported** — installer refuses |
| Android / Termux | arm64 | **none** | no | **Not supported** — installer refuses |
| WSL | x86_64 | uses the Linux asset | no | Expected to work; untested |

## What "supported" means in the installer

- **Linux glibc x86_64/arm64 and macOS x64/arm64**: detected, downloaded,
  checksum-verified and installed.
- **Windows x64/arm64**: detected by `install.ps1`; installed to
  `%LOCALAPPDATA%\Programs\airis` with a user-level PATH entry (no admin).
- **Alpine/musl**: detected and refused with an explanation, because the
  published binary is glibc-linked.
- **Termux/Android**: detected and refused, because no Android binary is
  published.

Refusing is deliberate. Installing a glibc binary on musl, or a desktop Linux
binary on Android, produces a broken command that looks installed — worse than a
clear refusal.

## How to extend the matrix

1. Add a build target in `scripts/build-binaries.sh`.
2. Publish the asset and `checksums.txt` via `build-binaries.yml`.
3. Run `install.sh` (or `install.ps1`) on that platform and record the result here.
4. Only then add the row as supported.
