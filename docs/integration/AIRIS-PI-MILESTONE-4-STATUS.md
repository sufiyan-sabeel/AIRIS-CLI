# AIRIS × Pi — Milestone 4 Status

**Date:** 19 November 2026 · **Branch:** `integration/pi-runtime` @ `a73306200` · **PR:** #64 (unmerged)

## Verdict

**The `airis` command does not yet launch through the Pi runtime.** This milestone delivered the security core and the analysis that makes the remaining wiring concrete; it did **not** achieve the definition of done, and this document does not claim it did.

| Phase | State |
|---|---|
| 0 — Baseline | **done** |
| 1 — Real CLI wiring | **not done** (blocker below) |
| 2 — Command compatibility matrix | **done** (this document, §3) |
| 3 — Security unification | **core implemented and tested; not attached** (§4) |
| 4 — Feature preservation audit | **done** (feature matrix, classifications) |
| 5 — Real CLI integration tests | **not done** — depends on Phase 1 |
| 6 — Regression & quality | **done for what exists** (§5) |
| 7 — Release readiness | **not ready** (§6) |

---

## 1. Phase 0 — baseline (verified)

| Item | Value |
|---|---|
| Branch / HEAD | `integration/pi-runtime` @ `c897d8f57` at start, clean tree |
| Pinned Pi commit | `1f6f319b` (`vendor/pi/UPSTREAM.md`), unchanged |
| Adapter | `integration/airis-runtime` — 5 source files after this milestone |
| CLI entry point | `packages/coding-agent/src/cli.ts:62` → `main(args)` in `src/main.ts:477` |
| AIRIS tests before changes | `agent` 165 passed, `tui` 679 passed, adapter unit 5 |
| PRs | #62, #63, #64 all open; #62/#63 untouched |

---

## 2. Phase 1 — why the CLI wiring is not done

The honest blocker, with evidence rather than a guess:

1. **`main()` is a 1,300+ line orchestration function** (`src/main.ts:477`) that selects between interactive TUI, print mode, JSON mode and RPC, then constructs `InteractiveMode`, which owns the render loop, the editor, keybindings and the AIRIS banner. Wiring a Pi `AgentSession` into that loop means replacing the message pipeline inside `InteractiveMode`, not calling one function.
2. **The runtime cannot be executed in this environment.** `chord` exceeds the 2 GB sandbox (Go/esbuild OOM) and `pi-ai` needs network hydration; only CI builds them. So any wiring written here could not be run even once locally — it would be unverifiable code, which the directive forbids ("do not claim functionality without implementation and evidence").
3. **No provider credential exists** (no API-key env vars, no `~/.airis/auth.json`, no `~/.pi/auth.json`), so even a correct wiring could not demonstrate a live turn.

**What would unblock it:** a CI job that (a) builds `vendor/pi`, (b) runs a headless `airis --engine pi --print "..."` against a fixture workspace, and (c) executes a live turn only when a repository secret is present. That job can be written now; it cannot pass until the wiring exists. Doing the wiring blind, then iterating on CI failures, is the next step — but it is a multi-cycle effort, not something to claim in one pass.

---

## 3. Phase 2 — command compatibility matrix

AIRIS commands stay AIRIS-native; Pi commands are **not** substituted. "Delegate" means the command's execution path would eventually use the Pi runtime.

| Command / area | Owner | Status |
|---|---|---|
| Interactive mode (TUI, banner, logo) | **AIRIS-native** | unchanged; not yet driven by Pi |
| `--help`, `--version` | **AIRIS-native** | unchanged; verified (`0.79.9`, exit 0) |
| Model selection | **AIRIS-native** for now | Pi exposes `model` in `CreateAgentSessionOptions`; not yet surfaced |
| Provider management | **AIRIS-native** | 19 provider modules unchanged (350 tests) |
| Configuration (`~/.airis`, `.airis`) | **AIRIS-native** | unchanged; Pi path would need a credential migration (see security report) |
| Memory | **AIRIS-native** | unchanged, not connected to Pi sessions |
| Plan mode | **AIRIS-native** | unchanged; still 0 tests |
| Missions | **AIRIS-native** | unchanged; still 0 tests |
| Skills | **AIRIS-native** | unchanged |
| Extensions | **AIRIS-native** (two models exist) | Pi extension model not bridged |
| Android automation | **AIRIS-native** | **BLOCKED** — `python/android_automation/bridge.py` absent |
| Vision | **AIRIS-native** | unchanged, unverified |
| Dashboard | **AIRIS-native** | `cli/dashboard.ts` unchanged; `advanced-dashboard.ts` deferred |
| AIRIS Ship | **AIRIS-native** | unchanged, 2 test files |
| Termux | **AIRIS-native** | **BLOCKED** — no Termux environment |

Rule applied: nothing was replaced by a Pi equivalent. Where Pi has an overlapping feature (plan mode, sub-agents, extensions), AIRIS keeps its own until a behaviour comparison and tests exist.

---

## 4. Phase 3 — security unification

### Implemented and tested (real code, 15 tests)

`integration/airis-runtime/src/guard.ts`:

- **Deny rules enforced** for read paths, write paths and shell commands, with `*`/`**` globbing and `~` expansion.
- **Fail closed**: malformed call → block; unresolvable pattern → block; internal error → block. `failClosed: false` exists only as an explicit opt-out.
- **Audit recording** for every decision, allow and deny, with tool, decision, reason and target.
- **Redaction**: audit records never carry file contents or credentials — asserted by a test that writes `API_KEY=sk-super-secret-value` and checks the value never appears in the record.
- **Pi-compatible result shape**: `{ block, reason, terminate }`, matching `ToolCallEventResult` (`extensions/types.ts:1475`).

Tests cover denied, allowed and interrupted operations, fail-closed paths, audit recording and pattern matching.

### Not done: the guard is not attached

**This is the honest gap.** The guard decides; nothing yet calls it. Attachment requires Pi to load it as an extension, and Pi discovers extensions from `<agentDir>/extensions` and `<cwd>/.pi/extensions` (`resource-loader.ts:1034`, `:1040`). The plan is to have AIRIS write its guard extension into `<agentDir>/extensions/` (agentDir being `~/.airis/agent`) so Pi loads it through its supported discovery path — no `ResourceLoader` reimplementation, no invented API.

Until that exists, **Pi tool calls are not gated and are not recorded in AIRIS's audit log.** Stated plainly because the alternative — implying the blocker is closed — would be false.

---

## 5. Phase 6 — what was actually run

| Suite | Result |
|---|---|
| Adapter unit + guard tests | **20 passed** (local, no runtime needed) |
| Adapter integration (real Pi runtime) | **6 passed** (CI run [44534067011](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44534067011)) |
| AIRIS `agent` | **165 passed** |
| AIRIS `tui` | **679 passed, 0 failed** |
| AIRIS `packages/` diff vs branch base | **0 lines** — no AIRIS source changed |
| Live E2E | **NOT RUN** — no provider credential |

---

## 6. Phase 7 — release readiness

**Not ready.** Missing, in order of severity:

1. CLI does not launch through Pi (Phase 1).
2. Guard not attached, so no permission enforcement and no audit records for Pi tool calls (Phase 3).
3. Vendored dependency tree is not `npm audit`ed.
4. No live end-to-end evidence.
5. No CLI-level integration tests (they depend on 1).
6. Android/Termux unverified; Android bridge file absent.

---

## 7. Next actions, in order

1. Write the guard extension file into `<agentDir>/extensions/` and prove Pi loads it (observable: a denied tool call returns `block: true`). Verify in CI where the runtime builds.
2. Add a headless `airis --engine pi --print` path that uses the adapter, defaulting to the existing engine.
3. Add the CI job described in §2, with the live turn gated on a secret and reported `NOT RUN` when absent.
4. Only then claim the definition of done.
