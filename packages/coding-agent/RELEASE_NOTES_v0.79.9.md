# AIRIS-CLI v0.79.9 Release Notes

**Release Date:** 2026-07-15
**Version:** 0.79.9 (patch release)

## Major Highlights

v0.79.9 focuses on **security hardening**, **observability**, and **operational reliability**. This release introduces 6 new security and diagnostics slash commands, provider health tracking, dangerous command detection, server-side timeout enforcement, and a dependency audit framework — all built on existing AIRIS infrastructure with no breaking API changes.

### Security Improvements

- **Dangerous Command Detection**: The bash tool now supports `deniedCommands` and `warnOnCommands` pattern lists in `BashToolOptions`. Commands matching denied patterns are blocked before execution; matching warning patterns are logged for audit.
- **Server-Side Timeout Cap**: The bash tool enforces a configurable `maxTimeout` (seconds) that caps any caller-provided timeout. Prevents runaway commands.
- **Security Audit Command** (`/security`): Runs 6 checks: sandbox status, project trust configuration, environment file exposure, dependency pinning, audit logging, and shell environment safety.
- **Dependency Audit Command** (`/deps-audit`): Scans `package.json` for pinned vs. ranged versions, lifecycle scripts, and known vulnerabilities. Reports exact version counts and warnings.
- **Provider Health Tracking**: New `ProviderHealthTracker` class persists per-provider/model health data to `.airis/memory/provider-health.json`. Tracks call counts, latency (avg/p50/p95), error breakdown by type, and computes a health score (0.0–1.0) with recovery recommendations.
- **Extension Security Awareness**: Extension warnings displayed for lifecycle hooks and untrusted sources.

### Reliability Improvements

- **Provider Health Command** (`/provider-health`): Shows health scores, recent failures, latency stats, and error breakdown with actionable recovery recommendations. Supports filtering by provider.
- **Health Check Command** (`/health`): Runs system health checks including agent directory accessibility, memory usage (with warning thresholds at 80% and 95%), core tool availability, and sessions directory.
- **Diagnostics Command** (`/diagnostics`): Displays version, session count, loaded extensions, skills, active tools, available commands, config paths, Node.js version, platform, heap usage, and uptime.
- **Models Command** (`/models`): Lists all configured providers with default models and model counts for quick reference.

### New Slash Commands

| Command | Purpose |
|---------|---------|
| `/health` | System health check (agent dir, memory, tools, sessions) |
| `/diagnostics` | System configuration and version info |
| `/security` | Full security audit (6 checks) |
| `/deps-audit` | Dependency version safety audit |
| `/provider-health` | Provider health scores and failure diagnostics |
| `/models` | List providers and default models |

All commands are runtime-reachable through the interactive mode's slash command handler, registered in `BUILTIN_SLASH_COMMANDS`, and display results in the TUI chat container.

### Files Changed

**New Files (6):**
- `packages/coding-agent/src/core/health-service.ts` — System health checks and diagnostics
- `packages/coding-agent/src/core/provider-health.ts` — Provider health tracking and scoring
- `packages/coding-agent/src/core/security-auditor.ts` — Security audit and dependency checks
- `packages/coding-agent/test/health-service.test.ts` — 25 tests
- `packages/coding-agent/test/provider-health.test.ts` — 28 tests
- `packages/coding-agent/test/security-auditor.test.ts` — 16 tests

**Modified Files (4):**
- `packages/coding-agent/src/core/slash-commands.ts` — Added 6 new commands
- `packages/coding-agent/src/core/tools/bash.ts` — Added `maxTimeout`, `deniedCommands`, `warnOnCommands` to `BashToolOptions`
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts` — Added 6 command handler methods + dispatch entries
- `packages/coding-agent/CHANGELOG.md` — Updated unreleased section

### Upgrade Instructions

```bash
# Via npm (recommended)
npm install -g @sufiyan-sabeel/airis-cli@0.79.9

# Or from source
git pull
npm ci --ignore-scripts
npm run build
```

### Migration Notes

**No breaking changes.** All v0.79.8 features, configuration, and session files remain fully compatible.

- New slash commands are available immediately after upgrade — no configuration needed.
- The bash tool's `maxTimeout`, `deniedCommands`, and `warnOnCommands` are optional. Default behavior is unchanged.
- Provider health tracking starts recording automatically when provider calls are made — no setup required.
- Audit trail format is unchanged.

### Security Readiness Score: 7/10

| Category | Score |
|----------|-------|
| Tool Security | 6/10 (baseline + timeout cap + denied commands; no allowlist/denylist at session level) |
| Secrets Protection | 4/10 (env file detection; no automatic secret redaction) |
| Extension Security | 5/10 (trust model exists; no signing or permission declarations) |
| Session Security | 7/10 (audit logging, trust decisions; no transcript masking) |
| Supply Chain Security | 6/10 (dependency pinning check; no npm audit integration) |

### Overall Release Readiness Score: 8/10

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Runtime reachable | Yes | All commands registered in `BUILTIN_SLASH_COMMANDS` and dispatched in `interactive-mode.ts` |
| Integrated | Yes | New services extend existing patterns (audit-log, project-learning, session-manager) |
| Tested | Yes | 69 new test assertions across 3 test files |
| User accessible | Yes | Accessed via `/health`, `/diagnostics`, `/security`, `/deps-audit`, `/provider-health`, `/models` |
| Documented | Yes | CHANGELOG updated, this release notes document |
| No breaking changes | Yes | All additions are optional extensions to existing types |
| No regression risk | Yes | Bash tool defaults unchanged; new options are opt-in |
