# Milestone 5 — Phase 1 Architecture Report

**Baseline:** `c5c18b851` · **PR:** #64 · **Status:** audit complete, **no implementation this turn**

This report answers the question Phase 1 asks: *can Pi become the engine behind the
existing interactive TUI without a rewrite?* The answer is yes, but **not** by
swapping the session — and that distinction changes the plan.

## 1. What the audit found

### 1.1 The TUI is coupled to a concrete session, not an engine interface

`interactive-mode.ts` (5,700+ lines) consumes the session through
`this.session.subscribe(...)` (`:3037`) and then dispatches AIRIS's own
`AgentSessionEvent` union in `handleEvent`.

Measured surface — **59 distinct `this.session.*` members** are used:

| Member | Uses | Pi equivalent |
|---|---|---|
| `modelRegistry` | 30 | partial (Pi `ModelRuntime`) |
| `resourceLoader` | 14 | none |
| `prompt` | 12 | yes |
| `extensionRunner` | 12 | none (different extension model) |
| `isStreaming` | 10 | yes |
| `scopedModels` | 9 | partial |
| `agent` | 4 | yes |
| `navigateTree`, `exportToHtml`, `steer`, `followUp`, `retryAttempt`, `getContextUsage`, … | ~30 more | mostly none |

**Consequence:** substituting a Pi session object behind the TUI is not viable. It
would require a 59-member facade whose majority are AIRIS subsystems with no Pi
counterpart — or a TUI rewrite, which the directive forbids.

### 1.2 There is a clean seam one level lower

`AgentSession` takes its agent by injection:

```ts
readonly agent: Agent;              // agent-session.ts:289
this.agent = config.agent;          // agent-session.ts:359
```

And `Agent` exposes replaceable public members (`agent.ts:166+`):

| Seam | Meaning for Pi |
|---|---|
| `streamFn: StreamFn` | **the model-streaming seam** — Pi can supply the stream |
| `beforeToolCall` / `afterToolCall` | tool gating hooks — where AIRIS permission applies |
| `subscribe()` / `prompt()` / `abort()` / `steer()` / `followUp()` | already the semantics the TUI expects |
| `toolExecution` | tool execution mode |

So the integration point is the **agent loop**, not the session.

## 2. Two candidate architectures

### A. Pi-backed streaming (`streamFn`) — recommended

AIRIS keeps its `Agent`, loop, tools, TUI, extensions, session tree and audit.
Pi supplies model inference and its provider/model registry through `streamFn`.

- **TUI changes required: none.** Streaming, tool events, approval/denial,
  cancellation, session restoration and model switching are existing AIRIS
  features that keep working, now fed by Pi's stream.
- Permissions stay in `beforeToolCall` → `builtin-sandbox`, one evaluator.
- Audit stays in `AuditLog`, one schema, rotation intact.
- Risk: low. Reversible by unsetting the engine flag.

### B. Pi's `AgentSession` as the engine

Pi runs the turn; AIRIS's session delegates and translates events.

- Gets Pi's own loop, tool set, MCP and skills.
- Requires event translation (`message_update`/`tool_execution_*` → `AgentSessionEvent`),
  tool bridging, permission bridging, and touching the 59-member surface.
- Risk: high, and the largest source of regression in a 5,700-line TUI.

**Recommendation: A for Phase 2**, with B as a later, separately reviewed step if
Pi's own tool/MCP/skill set is required. A satisfies "Pi is an execution
foundation, not AIRIS's identity" without disturbing the surface the directive
requires be preserved.

## 3. Phases 3 and 4 are tractable independently of that choice

**Phase 3 (unified security).** `builtin-sandbox` already reads
`~/.airis/agent/sandbox.json` and `<cwd>/.airis/sandbox.json`. Today the Pi path
reads the same files through `pi-engine.ts`, but with its own matcher
(`guard.ts`). To make one policy source authoritative, `guard.ts` should consume
`builtin-sandbox`'s parsed policy and matcher rather than re-implementing glob
matching. Fail-closed behaviour and the "no bypass through extensions" property
already hold: the guard blocks in `tool_call`, which runs before execution.

**Phase 4 (unified audit).** The Pi path writes `<agentDir>/audit.jsonl` in
AIRIS's `AuditEntry` schema but bypasses `AuditLog`, so `maxEntries` rotation
does not apply. The fix is to route guard decisions through the `AuditLog`
instance (or its `log()` path) instead of a raw `appendFileSync`, which also
brings redaction and error handling with it.

## 4. What was verified this turn (evidence, not claims)

- Session injection point: `agent-session.ts:289` (`readonly agent`), `:359` (`config.agent`).
- Streaming seam and tool hooks are public on `Agent` (`agent.ts:166+`).
- TUI event entry point: `interactive-mode.ts:3037`, `handleEvent` switch.
- 59 distinct `this.session.*` members (measured with `grep -o | sort -u | wc -l`).
- Policy files read by `builtin-sandbox`: `~/.airis/agent/sandbox.json`, `<cwd>/.airis/sandbox.json`.

## 5. Why implementation did not start this turn

Phase 1 asks for a report **before** implementation, and the finding above is a
genuine architectural fork: A and B are not variations of the same change, and B
risks the very TUI the directive requires be preserved. Choosing between them is
a decision with real trade-offs, so it belongs in front of you rather than being
assumed.

**If A is approved**, Phase 2 proceeds as: `streamFn` implementation against Pi's
model runtime → wire `--engine pi` to it → deterministic faux-provider tests for
streaming, cancellation and tool gating → existing TUI suite as regression.

## 6. Remaining limitations (unchanged from Milestone 4)

1. Live-provider E2E: **NOT RUN** — no credential.
2. `--engine pi` remains single-shot until Phase 2 lands.
3. Audit rotation not shared with the Pi path (Phase 4).
4. `builtin-sandbox` not yet the single matcher (Phase 3).
5. Android/Termux and non-x64 platforms unverified.
