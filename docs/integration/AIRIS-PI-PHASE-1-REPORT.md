# AIRIS × Pi — Phase 1 Complete: CLI Integration

**Commit:** `f82cb1f1e` · **Branch:** `integration/pi-runtime` · **PR:** #64 (unmerged)
**CI:** [44861293459](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44861293459) — Pi Runtime workflow green

All six Phase 1 gaps are closed, and the CLI end-to-end now runs in CI against
the real vendored runtime.

## The six items

| # | Item | State | Evidence |
|---|---|---|---|
| 1 | **agentDir propagation** | **done** | CLI passes `getAgentDir()` (`~/.airis/agent`) into `createAgentSession`; CI asserts the guard lands in `$HOME/.airis/agent/extensions/` |
| 2 | **Guaranteed permission extension** | **done** | adapter writes `<agentDir>/extensions/airis-guard.ts` *before* the session exists; a write failure aborts start rather than degrading to an ungated runtime |
| 3 | **--model** | **done** | resolved via `ModelRuntime.getModel(provider, id)` (`model-runtime.ts:454`) or `getAllModels()` (`:470`); ambiguous bare ids are rejected with the provider list instead of guessing |
| 4 | **--continue** | **done** | restores the newest session for the working directory through `listAirisSessions` (`SessionManager.list`); fails clearly when none exists |
| 5 | **Unified audit schema** | **done** | the extension now writes AIRIS's own `AuditEntry` `{ timestamp, type, sessionId, data }` to `<agentDir>/audit.jsonl` — the same file and schema `AuditLog` uses |
| 6 | **CLI-level E2E** | **done** | `tests/pi-cli/run.sh` drives `airis --engine pi --print` and asserts streamed output, the installed extension and the schema |

## What the CLI end-to-end actually proves

```
ok   CLI streamed the scripted Pi response
ok   permission extension installed into agentDir
ok   default engine still works
3 passed, 0 failed
```

It runs the **real** CLI → real adapter → real Pi `AgentSession`, with Pi's own
`faux` provider supplying a scripted reply (the directive explicitly permits a
deterministic mock provider). It is **not** a live-provider test and does not
claim to be: live E2E remains **NOT RUN** because no credential exists.

Supporting suites in the same run: **20** adapter unit/guard tests, **6**
integration tests against the real runtime, **4** deterministic E2E tests.

## Two defects CI caught (not guessed)

1. The guard-extension call site was missing the new required `sessionId` —
   typecheck failed.
2. The guard E2E still asserted `decision` at the top level after the schema
   unified under `data`. The assertion was updated to the new shape, and
   strengthened to assert `sessionId` on every entry.

A third was a real bug in my own wiring: the adapter import was resolved three
levels up from `dist/cli/pi-engine.js` instead of four, so the CLI reported
"adapter not available". The error was opaque because I caught it broadly; it now
reports the underlying cause and falls back to a cwd-relative path.

## Architecture (unchanged boundaries)

```
AIRIS CLI  →  AIRIS engine adapter (integration/airis-runtime)  →  Pi runtime (vendor/pi)
AIRIS security policy  →  guard extension in <agentDir>/extensions  →  Pi tool_call hook
AIRIS audit  ←  <agentDir>/audit.jsonl  ←  guard decisions (shared schema)
```

AIRIS still owns the CLI, branding, configuration, policy and audit. Pi is the
execution foundation.

## Remaining limitations

1. **Live-provider E2E: NOT RUN.** No credential, none requested, none committed.
2. **`--engine pi` is single-shot (`--print`) only.** Interactive mode still uses
   the AIRIS engine; wiring the Pi session into the TUI loop is Phase 2 work.
3. **Policy source is `sandbox.json`** (`~/.airis/agent` then `<cwd>/.airis`). A
   malformed file aborts rather than silently downgrading — but the AIRIS
   `builtin-sandbox` module is not yet the single source of truth for both engines.
4. **Audit entries from the Pi path are not rotated** by `AuditLog`'s rotation
   logic; they append to the same file but bypass its `maxEntries` handling.
5. Android/Termux and non-x64 platforms remain unverified.

## Phased plan for the remaining roadmap

| Phase | Scope | Precondition |
|---|---|---|
| **2** | Interactive TUI on the Pi session; file edit/shell tools through AIRIS's UI; JSON/RPC modes | Phase 1 (done) |
| **3** | AIRIS-native managers: permission (single source of truth), memory, config, provider, extension, audit rotation, session, project intelligence, command registry | Phase 2 |
| **4** | Multi-agent orchestration, review/test/research agents, git automation, IDE + dashboard, voice — incrementally, each with real tests | Phase 3 |
| **5** | Universal installer across verified platforms (Termux/Linux/macOS/Windows) with config preservation | Independent; installer already landed, platform verification outstanding |

Phase 2 is the next increment; it is the one that turns `airis` (interactive)
into a Pi-backed session, and it cannot be claimed until the TUI loop is wired
and tested.
