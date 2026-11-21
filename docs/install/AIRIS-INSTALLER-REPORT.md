# AIRIS-CLI Installer — Final Report

**Commit:** `e34268ec6` · **Branch:** `integration/pi-runtime` · **PR:** #64 (unmerged)
**CI:** [44859517167](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44859517167) — Installer workflow green (shellcheck, 27 tests, asset drift check)

## 1. Changed files

| File | Change |
|---|---|
| `install.sh` | **rewritten** (was broken, see §5) — real asset names, checksum enforcement, install/update/rollback/repair/doctor/list/uninstall |
| `install.ps1` | **new** — Windows equivalent (x64/arm64), user-level PATH, no admin |
| `tests/installer/run.sh` | **new** — 27 hermetic checks against a `file://` fixture release |
| `.github/workflows/installer.yml` | **new** — syntax, shellcheck, test suite, asset-name drift check |
| `.github/workflows/build-binaries.yml` | generates and uploads `checksums.txt` with each release |
| `docs/install/AIRIS-INSTALLER-AUDIT.md` | Phase 0 audit |
| `docs/install/PLATFORM-MATRIX.md` | supported-platform matrix |
| `INSTALL.md`, `INSTALLATION.md`, `UNINSTALL.md`, `TROUBLESHOOTING.md` | user documentation |

## 2. Supported platforms (honest status)

| Platform | Arch | Published | Installer executed | Status |
|---|---|---|---|---|
| Linux glibc | x86_64 | yes | **yes (CI)** | **Supported** |
| Linux glibc | arm64 | yes | no | Published; untested |
| macOS | arm64 / x64 | yes | no | Published; untested |
| Windows | x64 / arm64 | yes | no | Published; PowerShell untested |
| Alpine/musl | x86_64/arm64 | **no** | — | **Refused with explanation** |
| Termux/Android | arm64 | **no** | — | **Refused with explanation** |

**Only Linux x86_64 has been demonstrated end to end.** Every other row is marked
unverified, because no such machine was available.

## 3. Actual release artifact matrix (verified from GitHub Releases)

`v0.79.9` publishes exactly six assets:

```
airis-darwin-arm64.tar.gz   26.6 MB
airis-darwin-x64.tar.gz     28.9 MB
airis-linux-arm64.tar.gz    43.1 MB
airis-linux-x64.tar.gz      43.6 MB
airis-windows-arm64.zip     43.3 MB
airis-windows-x64.zip       45.4 MB
```

No `checksums.txt` — which is why the installer **refuses** this release by
default. Future releases will carry one (§5).

## 4. Installation commands

```sh
# Unix
curl -fsSL https://raw.githubusercontent.com/sufiyan-sabeel/AIRIS-CLI/main/install.sh | sh
sh install.sh --version 0.79.9
sh install.sh update | rollback | repair | doctor | list | version
sh install.sh uninstall [--purge]
```

```powershell
# Windows
irm https://raw.githubusercontent.com/sufiyan-sabeel/AIRIS-CLI/main/install.ps1 | iex
.\install.ps1 -Command doctor
```

## 5. Security verification

| Requirement | Implementation | Evidence |
|---|---|---|
| HTTPS-only downloads | `--proto '=https' --tlsv1.2`; a non-HTTPS base aborts unless a test harness opts in | test suite uses `file://` only via `AIRIS_ALLOW_INSECURE_BASE=1` |
| SHA-256 verification | compared against the release's `checksums.txt` | test: **checksum mismatch aborts** and the existing install is preserved |
| Never silently skip verification | no `checksums.txt` ⇒ **abort** with instructions | verified against the **real** `v0.79.9` release: exit 1, nothing installed |
| Explicit opt-out only | `--allow-unverified` / `-AllowUnverified` prints a warning | test: flag path succeeds, default path refuses |
| Strict asset names | derived from OS/arch, no user-controlled path components | unknown OS/arch rejected |
| Safe temp dirs | `mktemp -d`, removed via `trap` | — |
| Atomic install | staged into `<version>.partial`, then renamed | interrupted download cannot leave a broken version |
| No sudo / root | user-space paths only; PATH edits limited to one rc file | no `sudo` in `install.sh` |
| No secrets | no tokens read or written | — |
| No arbitrary command execution from the manifest | the manifest is parsed for a hash only; nothing from it is executed | — |

**The old installer violated the checksum rule** — it fetched a `.sha256` that
was never published and continued when it was missing.

## 6. Test results

`tests/installer/run.sh` — **27 passed, 0 failed**, executed locally and in CI on
Linux x86_64: fresh install, launcher/version dir/binary-run checks, `version`,
`list`, idempotent reinstall, upgrade, rollback, repair, doctor, checksum
mismatch abort, missing-checksums abort, explicit override, unsupported
architecture, missing release, uninstall (config preserved), `--purge`, dry-run.

Real-release behaviour, executed here: installing `v0.79.9` **aborts** with
"publishes no checksums.txt … Refusing to install an unverified binary", exit 1,
nothing installed.

**Not executed:** macOS (either arch), Windows (PowerShell), Linux ARM64,
Alpine, Termux. No device or runner was available.

## 7. CI

- Installer: [44859517167](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44859517167) — green
- The workflow also fails if the installer's expected asset names drift from what
  the latest release publishes — the exact defect that broke the old installer.

## 8. Known limitations

1. **No release publishes checksums yet**, so `v0.79.9` cannot be installed
   without `--allow-unverified`. The workflow now generates `checksums.txt`; the
   benefit arrives with the next release. Publishing checksums for existing
   releases would mean modifying published releases, which needs your approval.
2. **The release upload step still has `continue-on-error: true`**, so a failed
   asset upload would pass silently. Untouched here, but it is a real
   success-masking pattern on the release path.
3. **The README still advertises** `https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh`.
   That URL could not be verified from this environment; the documented command
   now uses `raw.githubusercontent.com`, which is verifiable but only serves the
   installer **after this branch merges**.
4. `install.ps1` has not been executed on Windows — it is syntax-reviewed only.
5. Alpine/Termux are refused, not supported; that needs new build targets.

## 9. Remaining work

1. Merge, then cut a release that includes `checksums.txt`, and verify a real
   end-to-end install from the published asset.
2. Run `install.ps1` on Windows x64 and ARM64, and `install.sh` on macOS (both
   arches), Linux ARM64 and Termux; record the results in the platform matrix.
3. Add Alpine/musl and Android build targets to `scripts/build-binaries.sh` if
   those platforms are to be claimed.
4. Remove `continue-on-error` from the release upload once uploads are reliable.
