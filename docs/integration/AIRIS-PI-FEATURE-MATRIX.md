# AIRIS × Pi — Feature Reconciliation Matrix

**Status as of Milestone 1.** Pi is vendored and partially built; **nothing is wired yet**. "Pi implementation" describes what exists in the pinned upstream commit, not what AIRIS currently uses. No feature below is claimed as working through Pi.

Legend for *Current status*: `AIRIS-only` (exists in AIRIS, not in Pi), `Pi-only` (exists upstream, not used by AIRIS yet), `Both` (both have one), `Deferred` (present but disabled/unwired).

---

## Priority features

| Feature | Pi implementation | AIRIS implementation | Current status | Tests | Missing | Integration approach | Compatibility risk | Verification evidence |
|---|---|---|---|---|---|---|---|---|
| **Memory** | none | `core/memory-store.ts` (182 LOC) | AIRIS-only, working | 1 test | nothing on the Pi side to reuse | keep AIRIS module; persist through the runtime's session layer when wired | low — self-contained | type-checked (was in the 17/19), tests pass |
| **Plan mode** | **none** — upstream README states Pi skips plan mode and sub-agents | `core/builtin-plan-mode.ts` (509 LOC) | AIRIS-only, **untested** | **0 tests** | tests | keep as an AIRIS-layer feature; never patch upstream core for it | medium — behaviour unverified | type-checked; **no test coverage** |
| **Android automation** | none | `src/automation/` (5 files, 1,140 LOC) | AIRIS-only, **partial** — the Python ADB bridge (`python/android_automation/bridge.py`) is absent from the repo | 1 test reference | the bridge itself | keep in the AIRIS layer; resolve the missing bridge as a separate decision | high — feature cannot run from a clean clone | type-checked; device test **not performed** |
| **Vision** | image models inside `pi-ai` | `src/vision/` (5 files, 628 LOC) | Both, differently | 1 test reference | — | compare `pi-ai` image APIs against AIRIS `image-runner`/`image-safety`; adapt rather than replace | medium | type-checked |
| **Missions** | none | `core/missions/` (150 LOC) | AIRIS-only, **untested** | **0 tests** | tests | AIRIS layer | low | type-checked |
| **Audit log** | `pi-telemetry` (different purpose: usage telemetry) | `core/audit-log.ts` (337 LOC) | Both, **not equivalent** | 2 tests | — | keep AIRIS audit log as the security record; Pi telemetry stays opt-in and separate | medium — do not conflate the two | type-checked, tested |
| **Termux** | none | `setup-termux.sh`, 20 referencing files | AIRIS-only, untested here | — | a real Termux run | AIRIS installer; add explicit node-version checks | medium | **not performed** (no Termux device) |
| **Extensions** | `packages/coding-agent/src/extensions/` + docs | `core/extensions/`, `builtin-extensions.ts`, examples | Both | several | API reconciliation | map AIRIS built-ins onto Pi's extension API; keep AIRIS API where it is richer | **high** — two extension models | type-checked |
| **Skills** | `docs/skills.md`, harness support | `packages/agent/src/harness/skills.ts` | Both | — | — | compare loading/format; prefer Pi's if compatible | medium | type-checked |
| **Dashboard** | `apps/p2` (upstream app) | `src/cli/dashboard.ts` (580 LOC) | Both, different surfaces | 1 test | — | keep AIRIS CLI dashboard; evaluate `p2` separately | low | type-checked, tested |
| **Providers** | `pi-ai` (471 files, provider registry) | `packages/ai` 19 provider modules | Both | 350 tests (ai) | — | Pi registry as the base; port AIRIS-only providers (bedrock, oauth, images) as plugins | **high** — two provider stacks | 350 passed / 731 skipped |
| **Project Trust** | `examples/extensions/project-trust.ts` (example only) | `core/airis-trust-onboarding.ts` (51 LOC) | Both, thin | **0 tests** | tests | AIRIS layer, modelled on Pi's example | medium | type-checked |
| **AIRIS Ship** | none | `core/ship/` (4 files, 842 LOC) | AIRIS-only, working | 2 test files | — | AIRIS layer | low | type-checked, tested |

---

## Deferred modules

| File | Status | Reassessment |
|---|---|---|
| `src/core/tools/dynamic-tools.ts` | **Deferred / unsupported.** Unwired; no production callers; `tools/index.ts` never references it | Compare against `pi-mcp` + Pi's extension/tool registration before deciding retire/adapt/port. Pi has a real tool-registration path; this module duplicates it partially |
| `src/modes/interactive/components/advanced-dashboard.ts` | **Deferred / unsupported.** Disabled (import commented out); three API decisions open | Reassess against Pi's TUI component model and `apps/p2`. Needs `session.entries` → `SessionManager`, `primary`/`info` colour mapping, and `invalidate()` |

Both remain excluded from `tsc`; type coverage is **17 of 19**, unchanged by this milestone.

---

## Capabilities Pi brings that AIRIS does not have

Not yet integrated — listed so the gap is explicit rather than implied:

| Capability | Upstream package | State |
|---|---|---|
| Durable sessions (persistence, crash recovery) | `pi-durable` | vendored, not built in-sandbox, not wired |
| MCP client | `pi-mcp` | **built** in-sandbox, not wired |
| Codemode | `pi-codemode` | **built** in-sandbox, not wired |
| Telemetry | `pi-telemetry` | **built** in-sandbox, not wired |
| Chord orchestration | `chord` | vendored, build blocked in-sandbox (memory) |
| Schema layer | `pi-schema` | **built** in-sandbox, not wired |
| Evals | `pi-evals` | vendored, not built |

**Nothing in this table is advertised as a working AIRIS feature.** Each becomes a claim only after it is wired and tested in Milestone 2/3.

---

## Milestone 3 classification (required inventory)

Vocabulary: **PRESERVED** (unchanged and working as before), **INTEGRATED** (now runs through the Pi runtime), **REGRESSED** (broken by this work), **BLOCKED** (cannot be verified or used, with a stated reason), **DEFERRED** (deliberately not wired yet).

| # | Feature | Classification | Note |
|---|---|---|---|
| 1 | AI providers | **PRESERVED** | AIRIS's 19 provider modules untouched (350 tests pass). Pi's own registry is not wired to AIRIS providers yet. |
| 2 | Configuration & model selection | **PRESERVED** | No config default changed. Pi path does not yet expose model selection. |
| 3 | Memory | **PRESERVED** | `memory-store.ts` untouched; not yet connected to Pi sessions. |
| 4 | Audit log | **PRESERVED** (existing engine) · **DEFERRED** (Pi path) | Pi tool executions are **not** yet recorded in AIRIS's audit log. Real gap, stated in the security report. |
| 5 | Plan mode | **PRESERVED** | Untouched; still has 0 tests. |
| 6 | Missions | **PRESERVED** | Untouched; still has 0 tests. |
| 7 | Android automation | **BLOCKED** | `python/android_automation/bridge.py` is absent from the repo; the feature cannot run from a clean clone. No device test performed. |
| 8 | Vision | **PRESERVED** | Untouched; unverified. |
| 9 | Extensions | **PRESERVED** · **DEFERRED** (Pi path) | AIRIS extension model unchanged; Pi's extension model not yet bridged. |
| 10 | Skills | **PRESERVED** | Untouched. |
| 11 | AIRIS Ship | **PRESERVED** | Untouched; 2 test files pass. |
| 12 | Dashboard | **PRESERVED** | `cli/dashboard.ts` untouched; `advanced-dashboard.ts` remains deferred/unsupported. |
| 13 | Termux | **BLOCKED** | No Termux environment; installer not exercised. |
| 14 | Project Trust | **PRESERVED** | Untouched; still 0 tests. |
| 15 | Terminal UI | **PRESERVED** | Logo, banner, colours, attribution unchanged. |
| 16 | Commands & config compatibility | **PRESERVED** | No CLI command, flag or default changed. |
| — | **Runtime adapter (start, sessions, diagnostics)** | **INTEGRATED** | Verified in CI: 6 integration tests against the real runtime (run 44533332314). |
| — | **End-to-end model turn** | **BLOCKED** | No provider credential in this environment. Reported NOT RUN, not claimed. |

**Nothing is classified REGRESSED**: `packages/` and AIRIS `src/` have zero diff against this branch's base.
