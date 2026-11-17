# Excluded from type checking — findings and decisions

Two source files remain excluded from `tsc` in `tsconfig.json`. This document records what each is, what the evidence says, and the decision needed. **Type coverage is not complete**; it is 17 of 19 files.

Both files were added on **2026-07-17** and excluded from type checking **the same day**, in commits whose messages say so directly:

- `302fb3ffe` — "fix: Exclude advanced-dashboard and AI test files from root tsc check, fix TSchema import"
- `6f1705660` — "fix: Fix remaining CI type errors - dynamic-tools, termux, extensions exports"
- `796aca086` — "fix: … exclude volatile files from build"

So the exclusions were not architectural decisions. They were the workaround for type errors introduced in the same feature burst (`7abd8e74a` "feat(coding-agent): add capability audit, provider resilience, and 9 new slash commands"). That is the same pattern the Phase 1 audit found in CI: green surface, broken underneath.

---

## 1. `src/core/tools/dynamic-tools.ts` (343 LOC)

### What it is

A registry for "dynamic tools" — tool definitions loaded at runtime from extensions/plugins — plus `executeDynamicTool()` and a `toCoreToolDefinition()` adapter.

### Evidence

| Question | Finding |
|---|---|
| Is it reachable? | **No.** `grep -rn "DynamicToolRegistry\|toCoreToolDefinition" src/` returns nothing outside the file itself. |
| Is it integrated with the tool system? | **No.** `src/core/tools/index.ts` (`createAllToolDefinitions`, used by `agent-session.ts`) contains **zero** references to dynamic tools. The module defines a *second, parallel* `createAllToolDefinitions`. |
| Does it have tests? | **Yes** — `test/dynamic-tools.test.ts`, and those tests pass at runtime. |
| Why does it not type-check? | It builds `{ inputSchema, executionMode, … }` objects, but `ToolDefinition` (in `core/extensions/types.ts`) requires `{ label, parameters, execute }` and has no `inputSchema`. The shape is from an older API generation. |

### Classification

**Unfinished feature, never wired in.** The registry and executor exist; nothing constructs it, and the real tool pipeline bypasses it entirely. It is not an abandoned API that third parties depend on — it was never published, never exported from a package entry point, and never called.

### Recommendation

**Retire it, or complete it — but do not leave it as a half-integrated parallel path.**

- **Retire (recommended).** Move to a `legacy/` directory or delete in a dedicated, reviewed commit. The test file goes with it. This is the honest option: the code has no callers, and keeping a second tool-registry implementation alongside the real one invites exactly the kind of drift that produced this situation.
- **Complete (only if dynamic tools are a wanted feature).** That means: map `inputSchema` → `parameters`, supply `label`, and implement `execute` by delegating to the existing `executeDynamicTool(name, args, context)`. The missing piece is a real `ExtensionContext` → `DynamicToolContext` translation — **I will not invent that adapter**, because its semantics (which session, which trust level, which cancellation signal) are product decisions.

**No temporary exclusion is needed either way** — the choice is retire or complete, and both resolve the type error.

---

## 2. `src/modes/interactive/components/advanced-dashboard.ts` (520 LOC)

### What it is

A TUI component rendering session statistics (message count, branches, tokens), cache analytics, and provider health — an "advanced dashboard" for the interactive mode.

### Evidence

| Question | Finding |
|---|---|
| Is it shown to users? | **No.** Its import in `interactive-mode.ts` is commented out: `// import { DashboardComponent } from "./components/advanced-dashboard.ts";` |
| Does it have tests? | **Yes** — `test/advanced-dashboard.test.ts` (8 KB) imports the component directly and passes. |
| Is there any CLI surface? | `src/cli/dashboard.ts` is a *different*, working dashboard (580 LOC, tested). This component is not it. |
| Why does it not type-check? | 17 errors across three API generations — see below. |

### The three missing-API decisions

| # | Code expects | Reality today | Decision needed |
|---|---|---|---|
| 1 | `session.entries` (lines 120, 291) | `AgentSession` has no `entries`; entries come from `this.sessionManager.getEntries()` (used elsewhere in `agent-session.ts`) | Wire the component to a `SessionManager` instead of `AgentSession`, or expose a read-only accessor on the session. **This is a data-plumbing decision, not a rename.** |
| 2 | `theme.fg("primary", …)`, `theme.fg("info", …)` | `ThemeColor` is a closed union with no `primary` or `info` (it has `accent`, `border`, `borderAccent`, `borderMuted`, `success`, `error`, `warning`, `muted`, `dim`, `text`, …) | Choose the mapping — e.g. `primary` → `accent` or `borderAccent`; `info` → `text` or `muted`. **Visual decision; affects the AIRIS look.** |
| 3 | No `invalidate()` method | `Component` (in `packages/tui/src/tui.ts`) requires `invalidate()`, called on theme change | Add a one-line cache-clear method. Mechanical, no decision needed. |

### Classification

**Intended feature, deliberately disabled, and never finished.** Unlike `dynamic-tools.ts`, this one was clearly meant to be user-visible (it was imported, then commented out), and it has a real test.

### Recommendation

**Decide whether the advanced dashboard is a supported AIRIS feature.**

- **If yes:** the plan is concrete and small — (a) add `invalidate()`; (b) pass a `SessionManager` (or an entries accessor) into the constructor instead of reading `session.entries`; (c) pick the two colour mappings; (d) re-enable the import behind a command (e.g. `/dashboard`) rather than at startup; (e) update the test. Items (a) and (c) are mechanical; (b) and (d) are the real decisions.
- **If no:** retire it alongside `dynamic-tools.ts`, in the same reviewed commit, with the test.

**Do not fabricate a replacement API.** `session.entries` was removed for a reason, and inventing an `entries` getter on `AgentSession` to satisfy a disabled component would put a new public API in place purely to make an unused file compile.

---

## 3. Status summary

| File | Type-checked | State |
|---|---|---|
| `dynamic-tools.ts` | ❌ excluded | Orphaned; no callers; needs retire-or-complete decision |
| `advanced-dashboard.ts` | ❌ excluded | Disabled; needs feature decision + 2 API decisions |

**Type coverage is 17 of 19 files. It is not complete, and this report does not claim otherwise.**

### Follow-up

| Item | Owner | Decision required |
|---|---|---|
| `dynamic-tools.ts` — retire or complete | Umaiz Sufiyan | which, and by when |
| `advanced-dashboard.ts` — support or retire | Umaiz Sufiyan | which, plus `session.entries` and theme-colour mapping if supported |

Neither blocks the Pi integration: both are AIRIS-layer files, and the migration plan already assigns AIRIS-only code to `airis-*` packages rather than the vendored engine.
