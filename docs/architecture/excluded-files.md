# Excluded from type checking — findings and decisions

Two source files remain excluded from `tsc` in `tsconfig.json`. **Type coverage is 17 of 19 files — it is not complete.**

**Decision (2026-11-19): both files are preserved and deferred.** Neither is deleted, neither is rewritten, and no adapter or replacement API is invented. Both are marked **deferred / unsupported** and will be revisited during Pi extension-architecture reconciliation. The exclusions stay explicit until then.

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

### Decision: preserve and defer (deferred / unsupported)

**Status: deferred, unsupported, unwired.** The implementation and its tests are kept as they are. Nothing was deleted and no adapter was invented.

When Pi's extension architecture is reconciled (Step 1 onward), compare against whatever Pi offers for dynamic/runtime-registered tools before deciding whether to retire, adapt, or port this module. The comparison should weigh API shape, wiring cost, and whether Pi's extension API already covers the use case — not just the file's line count.

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

### Decision: preserve and defer (disabled, unsupported)

**Status: disabled, unsupported.** The source and its tests are kept. The type-check exclusion stays documented. No `session.entries` getter, theme colour, or other replacement API was fabricated.

The feature is currently **disabled** — its import in `interactive-mode.ts` is commented out, so no user sees it. The three API decisions recorded above remain open and must be settled during AIRIS feature reconciliation before the component is either wired in or retired.

---

## 3. Status summary

| File | Type-checked | State |
|---|---|---|
| `dynamic-tools.ts` | ❌ excluded | Orphaned; no callers; needs retire-or-complete decision |
| `advanced-dashboard.ts` | ❌ excluded | Disabled; needs feature decision + 2 API decisions |

**Type coverage is 17 of 19 files. It is not complete, and this report does not claim otherwise.**

### Follow-up

| Item | Status | Revisit |
|---|---|---|
| `dynamic-tools.ts` | Preserved, deferred, unwired, unsupported | Pi extension-architecture reconciliation |
| `advanced-dashboard.ts` | Preserved, disabled, unsupported; 3 API decisions open | AIRIS feature reconciliation |

Neither blocks the Pi integration: both are AIRIS-layer files, and the migration plan already assigns AIRIS-only code to `airis-*` packages rather than the vendored engine.
