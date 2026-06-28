# CLEANUP PLAN

Generated: 2025-06-19
Project: AIRIS-CLI at /storage/emulated/0/Download/AIRIS-CLI

## SAFE_TO_DELETE

| Path | Size | Reason |
|------|------|--------|
| `.crush/` | 387K | Entire directory is for the separate `crush` tool (charmbracelet/crush). Contains its own `.git` submodule, `crush.db`, automation-guide.md, prompts, skills. Not part of AIRIS. Zero references in AIRIS source. |
| `crush/` | 39M | Complete separate Go project (charmbracelet/crush) with its own go.mod, go.sum, main.go, internal/, docs/, scripts/. Not part of AIRIS at all. |
| `logs/` | 12K | Contains `automation.log` - old runtime log from another system. Not referenced anywhere in AIRIS code. |
| `python/android_automation/__pycache__/` | 120K | Python bytecode cache (`.pyc` files) that should never be in source control and is useless without the editor. |
| `.aider.chat.history.md` | 20K | Aider AI editor session history. Unrelated to AIRIS. |
| `.aider.input.history` | 4K | Aider AI editor input history. Unrelated to AIRIS. |
| `.aider.conf.yml` | 350B | Aider AI editor config. Unrelated to AIRIS. |
| `docs/` | 80K | Outdated duplicate of `website/` directory. `docs/install.sh` is identical to root `install.sh` (old v2.0 with ANSI effects). `website/` contains the modern deployed version. `docs/` is not referenced by any AIRIS source, build, or CI script. Only reference is itself. |
| `.netlify/` | 14K | Stale Netlify deploy functions internal artifacts. Not referenced in source. |
| `website/.netlify/` | -- | Duplicate stale Netlify artifacts nested inside website/. |
| `airis-test.bat` | -- | Duplicate of `pi-test.bat`. Both call `pi-test.ps1` internally. Redundant wrapper. |
| `airis-test.ps1` | -- | Byte-identical to `pi-test.ps1`. Completely redundant copy. |
| `airis-test.sh` | -- | Nearly identical to `pi-test.sh`. Both are test harness scripts for the same `airis` tool. `pi-test.*` is canonical (referenced in `AGENTS.md`). |
| `packages/agent/test/scratch/simple.ts` | -- | Scratch/test file with only 59 lines, uses old `.pi/` paths instead of `.airis/`, not referenced by any test runner or import. |

## REVIEW_REQUIRED

| Path | Reason |
|------|--------|
| `.pi/` | Contains same files as `.airis/` (same prompts, skills, extensions, git, npm) except `settings.json` vs `automation-guide.md`. Legacy directory from original upstream project. The code references `.pi/` for backwards compatibility in tests and docs. Verify no runtime code reads from root-level `.pi/` before removing. |
| `website/` | Contains deploy-ready site for GitHub Pages (`sufiyan-sabeel.github.io/AIRIS-CLI/`). Slightly differs from `docs/` (modern install.sh). May be needed for deploys or README links. Verify if this is the authoritative deploy artifact. |
| `.pi/settings.json` | Contains `{"androidAutomation": true}`. If `.pi/` is removed, this setting may be lost. Check if android automation reads from `.pi/` or `.airis/`. |
| root `install.sh` | Same content as `docs/install.sh` (old v2.0). Not referenced by README (which points to website/install.sh). Could be considered duplicate but keeping for safety. |

## KEEP

- `.airis/` - Active AIRIS config directory with prompts, skills, extensions, automation-guide.md
- `packages/` - All source code (agent, ai, coding-agent, tui)
- `packages/*/dist/` - Build outputs used by development/runtime
- `node_modules/` - Required npm dependencies
- `python/android_automation/*.py` - Android automation source code (excluded per task)
- `scripts/` - Active build, release, and utility scripts
- `setup.sh`, `install.sh`, `test.sh` - Root-level project scripts
- `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `LICENSE`, `SECURITY.md` - Project documentation
- `.env.example`, `.gitignore`, `.npmrc`, `biome.json`, `tsconfig*.json`, `package.json`, `package-lock.json` - Config files
- `.github/`, `.husky/`, `.kilo/` - CI/CD and git hooks
- `.git/` - Git repository
- `website/` - (REVIEW_REQUIRED, but will keep during initial cleanup)
- `.pi/` - (REVIEW_REQUIRED, but will keep during initial cleanup)

## Notes

- `.env`, `.env.local`, user `auth.json`, API keys, credentials: No `.env` file found in repo. `.env.example` is safe. Do not touch any actual secrets.
- Android automation logic: Excluded per task instructions.
- No architecture changes, no feature rewrites.
