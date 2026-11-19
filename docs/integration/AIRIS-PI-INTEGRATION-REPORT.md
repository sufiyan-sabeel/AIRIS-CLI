# AIRIS × Pi — Integration Report: Milestone 2

**Status:** **architecture settled and adapter verified; end-to-end LLM session not demonstrated.**
**Date:** 19 November 2026
**Branch:** `integration/pi-runtime` · **PR:** #64 (stacked on `remediation/baseline`, unmerged)

> **What is real:** the runtime builds, the adapter type-checks against genuine Pi declarations, and integration tests start a real Pi `AgentSession` in CI.
> **What is not:** a full prompt → stream → tool → result turn against a live model. That needs a provider credential this environment does not have. It is not claimed.

---

## Milestone 3 status (19 Nov 2026)

**Implemented and verified:** session persistence, restoration, diagnostics and session listing in the adapter, plus integration tests for all of them. CI run [44533332314](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44533332314): adapter typecheck clean, 5 unit tests, **6 integration tests against the real Pi runtime** (no skip warning — the runtime was importable and real sessions were created).

**Not implemented — the single remaining gate:** the live end-to-end turn (prompt → streamed response → tool call → tool result → completed turn → persist → restore → continue). **No provider credential exists in this environment** (no API-key env vars, no `~/.airis/auth.json`, no `~/.pi/auth.json`), so it is reported **NOT RUN**. A mocked response would not count and is not reported as one.

**Also not done:** the `airis` CLI does not yet launch through the adapter (deliberate: wiring it before the E2E works would only move the failure), model switching is not exposed, and the vendored dependency tree is not yet security-audited.

New documents: `AIRIS-PI-SECURITY-REPORT.md`, `AIRIS-PI-PERFORMANCE-REPORT.md`, `AIRIS-PI-MIGRATION-ROLLBACK.md`.

**Measured baseline:** AIRIS CLI startup `--version` = median **0.182 s** (n=5). No post-integration number exists, because the Pi path cannot run in this sandbox — stated rather than invented.


---

## 1. Starting state verified

| Check | Result |
|---|---|
| Branch / HEAD | `integration/pi-runtime` @ `ab7737bfb` (now `a78536fb7`), tree clean |
| PRs | #62, #63 untouched; #64 is this branch |
| Pi upstream | `1f6f319b` — `v1.5.2-303-g1f6f319bb` (**303 commits after the 1.5.2 tag**) |
| Previous runtime CI | green (all 11 packages built) |

---

## 2. Consumption architecture — decided, with evidence

### C. Published upstream packages — **rejected**

All packages except `pi-evals` are published at `1.5.2`, which looked attractive until the tag was checked:

```
$ git describe --tags 1f6f319b
v1.5.2-303-g1f6f319bb
```

The vendored commit is **303 commits ahead** of the `1.5.2` release. Depending on `@earendil-works/*@1.5.2` would have installed different code from the source this project vendored and reviewed — a silent provenance swap. Rejected on correctness, not convenience.

### B. Bundled runtime artifact — **deferred**

Cleanest distribution boundary, but it adds a bundling step and artifact passing to every consumer, and buys nothing over A while the runtime lives in this repository. Revisit if AIRIS ships without `vendor/pi`.

### A. Built-artifact linking — **selected**

```json
"dependencies": { "@earendil-works/pi-coding-agent": "file:../../vendor/pi/packages/coding-agent" }
```

Verified by prototype in a clean directory, not assumed:

- `npm install` creates **only a symlink** (`added 1 package`) — no registry copy of any `@earendil-works/*` package, so no duplicate module instances.
- Import resolves to the vendored build: `file:///…/vendor/pi/packages/schema/dist/index.js`.
- The linked package's own dependencies resolve from `vendor/pi/node_modules` (Node resolves from the real path), so the runtime keeps its own dependency tree and **AIRIS's lockfile is untouched**.
- Inside this repo the same install succeeds: 52 packages, `pi-coding-agent -> ../../../../vendor/pi/packages/coding-agent`.

**Requirement:** `vendor/pi` must be installed *and built* before the adapter is type-checked or tested. The `Pi Runtime` workflow does exactly that, in order.

---

## 3. The adapter

Location: `integration/airis-runtime` — deliberately **outside `packages/*`** so AIRIS's existing workspaces, lockfile and gates are unaffected.

| File | Role |
|---|---|
| `src/index.ts` | AIRIS-owned interface: `AirisRuntime`, `AirisRuntimeOptions`, `AirisTurnResult`, `AirisRuntimeUnavailableError`, `normalizeRuntimeError`. **No Pi imports.** |
| `src/pi-runtime.ts` | The **only** file in AIRIS that imports Pi. |
| `test/unit.test.ts` | Pure unit tests — run anywhere (5 tests). |
| `test/integration.test.ts` | Require the built runtime; run in CI after the build (4 tests). |
| `README.md` | Architecture decision and its evidence. |

### Every Pi symbol was read from the vendored source first

| Symbol | Source |
|---|---|
| `createAgentSession(options?)` → `{ session, extensionsResult, modelFallbackMessage? }` | `src/core/sdk.ts:191` |
| `session.prompt(text, options?)` | `src/core/agent-session.ts:2177` |
| `session.abort()` | `src/core/agent-session.ts:2616` |
| `session.subscribe(listener)` → unsubscribe | `src/core/agent-session.ts:1457` |
| `session.getLastAssistantText()` | `src/core/agent-session.ts:4526` |
| `session.dispose()` | `src/core/agent-session.ts:1481` |
| `SessionManager.inMemory()` | `docs/sdk.md` |
| events `message_update` + `assistantMessageEvent.type === "text_delta"`, and `tool_execution_end` | `src/core/agent-session.ts:210-224`, `1441` |

No class, method, event name or option was invented. The adapter supports start, prompt with streaming deltas, tool-execution counting, abort, dispose, and optional persistent sessions (`SessionManager.inMemory()` is used for the default `memory` mode; `persistent` leaves Pi's default on-disk store in place).

---

## 4. Verification — real CI evidence

Run [44531242837](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44531242837) — **all steps green**:

| Step | Result |
|---|---|
| Install vendored dependencies, hydrate, build 11 packages | ✅ (chord 315 js, ai 210 js, …) |
| Install adapter dependencies | ✅ 52 packages, `pi-coding-agent` symlinked |
| **Typecheck adapter against real Pi declarations** | ✅ 0 errors |
| **Adapter unit tests** | ✅ 5 passed |
| **Adapter integration tests (real Pi runtime)** | ✅ 4 passed |

**The integration tests did not skip.** The suite prints an explicit "runtime not importable" warning when it cannot load Pi; that warning is **absent** from the log (0 occurrences), so `available === true` and the tests executed against a genuine Pi `AgentSession`: `start()` created a real session, `dispose()` released it, and `prompt()` before `start()` correctly rejected.

Two real defects were found and fixed by this loop, not by guessing:
1. `TS2688` — the adapter lacked `@types/node`.
2. `TS1294` — `erasableSyntaxOnly` forbids TypeScript parameter properties; both classes now declare fields explicitly.

---

## 5. AIRIS functionality — compatibility checklist

No AIRIS source file was modified by this milestone, so every feature below remains exactly as it was. The column that matters is *what it will need* when wired.

| Feature | Works unchanged? | Needs adapter? | Needs migration? | Currently broken/unavailable? |
|---|---|---|---|---|
| Plan mode (`builtin-plan-mode.ts`, 509 LOC) | yes — untouched | later, to run inside a Pi session | no | **untested (0 tests)** |
| Memory (`memory-store.ts`, 182 LOC) | yes | persistence adapter | no | no (1 test) |
| Vision (`vision/`, 628 LOC) | yes | provider mapping | no | unverified |
| Android automation (1,140 LOC) | yes | platform adapter | no | **partial — `python/android_automation/bridge.py` absent** |
| Termux | yes | installer work | no | **not performed** (no device) |
| Missions (150 LOC) | yes | no | no | **untested (0 tests)** |
| Audit logging (337 LOC) | yes | no | no | no (2 tests) |
| Skills & extensions | yes | **yes** — two extension models exist | possible | no |
| Provider configuration (19 modules) | yes | **yes** — Pi registry vs AIRIS providers | possible | no (350 tests) |
| Dashboard (`cli/dashboard.ts`, 580 LOC) | yes | no | no | no (1 test) |
| AIRIS Ship (842 LOC) | yes | no | no | no (2 tests) |
| Project Trust (51 LOC) | yes | no | no | **untested (0 tests)** |
| Existing CLI commands | yes | no | no | no |

Nothing was removed or downgraded. Type coverage remains **17 of 19**.

---

## 6. What is NOT done

1. **End-to-end LLM session.** Prompt → streamed response → tool execution → tool result → completed turn against a live model has **not** been demonstrated. It requires a provider credential; none is available in this environment, and a mocked response would not count. This is the single remaining gate for Milestone 2's definition of done.
2. **AIRIS CLI does not yet launch through the adapter.** The adapter is verified in isolation; wiring `airis` to it is the next step and needs the E2E above to be meaningful.
3. **Model selection** is not exposed through the adapter; the runtime uses Pi's configured default.
4. **Android / Termux / Windows / macOS** runtime compatibility not measured.
5. **Performance** not measured (startup, init, first-response latency).
6. **Pi's own package tests** not run — only the build and the adapter suites.

---

## 7. Next steps

1. Obtain a provider credential (or a local/faux provider Pi supports) and write `test/e2e-session.ts`: one prompt, one tool call (a harmless fixture file), streamed deltas, persisted and restored session. Run it in the `Pi Runtime` workflow, gated on the secret being present, and report `NOT RUN` when it is absent.
2. Route `airis` startup through `createAirisRuntime()` behind a flag, so the existing CLI path remains the default until the E2E is green.
3. Then Milestone 2's feature adaptation (memory, audit log, Ship, providers) on top of a runtime that is proven end to end.

---

*Evidence: CI run [44531242837](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44531242837) (all adapter steps green), prototype installs run in clean temporary directories, and the vendored source line references in §3. Nothing is reported as passing that was not executed.*
