# AIRIS × Pi — Final Gap Closure Report

**Commit:** `cb401519c` · **Branch:** `integration/pi-runtime` · **PR:** #64 (unmerged, no release published)
**CI:** [44900974847](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44900974847) — Pi Runtime workflow **green**

## Actual CLI test output (from that run)

```
ok   streamed text response
ok   guard extension installed in AIRIS agentDir
ok   sessions stored under the AIRIS agentDir
ok   denied tool never executes
ok   deny decision recorded in audit
ok   audit entries carry sessionId and timestamp
ok   allowed tool executes
ok   --model rejects an unknown model
ok   --continue fails cleanly with no session
ok   --continue restores a previous session
ok   default engine still works
11 passed, 0 failed
```

Same run: 20 adapter unit/guard tests, 6 integration tests against the real
runtime, 4 deterministic E2E tests.

## Priority 1 — the security gap (closed)

The previous state proved only that the extension **file was written**. That is
not proof of interception, and the directive was right to demand more.

The adapter now inspects `createAgentSession`'s `extensionsResult` and requires:

1. an extension whose `path` contains `airis-guard`, **and**
2. a registered `tool_call` handler on that extension (`handlers.get("tool_call")`).

If either is missing while an `agentDir` is configured, the session is
**disposed** and `start()` throws — no silent fallback to an ungated run.
`diagnostics()` exposes `guardLoaded`, `guardHandlesToolCalls` and
`extensionErrors` so the state is inspectable rather than assumed.

The behavioural test proves the requirement rather than the plumbing: with
`sandbox.json` denying `touch`, a scripted `bash` call **never creates its
marker**, and a `deny` decision appears in the audit log. With an empty policy,
the same call does create its marker.

## Priority 2 — CLI flags (closed)

| Flag | Behaviour | Test |
|---|---|---|
| `--engine pi` | routes to the Pi runtime; default engine untouched | `default engine still works` |
| `--model` | resolved via `ModelRuntime.getModel`/`getAllModels`; unknown ids rejected with a clear message | `--model rejects an unknown model` |
| `--continue` | restores the newest session for the cwd; fails cleanly when none exists | both `--continue` checks |

CLI runs now use persistent sessions under the AIRIS agent dir, which is what
makes `--continue` meaningful.

## Priority 3 — unified audit (closed)

The guard writes AIRIS's own `AuditEntry` schema — `{ timestamp, type,
sessionId, data }` — to `<agentDir>/audit.jsonl`, the same file `core/audit-log.ts`
uses. No duplicate audit architecture. Entries are asserted to carry
`sessionId`, `timestamp`, the tool identity and the allow/deny decision, and
tests assert no credential value reaches the log.

## Three real defects found by tests, not guessed

1. **The adapter path was one directory short.** It worked only when the CLI was
   run from the repository root; the `--continue` test (run from a separate
   directory) exposed it. Now resolved from `import.meta.url` as an absolute URL,
   existence-checked before import, with every candidate reported on failure.
2. **A written guard file ≠ a loaded guard.** Fixed by the `extensionsResult`
   verification above.
3. **The E2E still asserted the pre-unification audit shape** — updated to the
   new schema and strengthened to assert `sessionId` on every entry.

## Changed files

`integration/airis-runtime/src/{index.ts,pi-runtime.ts,guard.ts,guard-extension.ts}`,
`packages/coding-agent/src/cli/{pi-engine.ts,args.ts}`,
`packages/coding-agent/src/main.ts`,
`tests/pi-cli/run.sh`, `.github/workflows/pi-runtime.yml`,
`docs/integration/*`.

## Verified commands

```bash
airis --version                                  # 0.79.9 (unchanged)
airis --engine pi --print "hello"                # Pi runtime turn
airis --engine pi --model anthropic/claude-... --print "hi"
airis --engine pi --continue --print "next"
airis --help                                     # lists --engine
```

## Remaining limitations

1. **Live-provider E2E: NOT RUN.** No credential exists; none requested, none
   committed. All Pi tests use Pi's own `faux` provider with scripted responses —
   real runtime, deterministic model.
2. **`--engine pi` is single-shot (`--print`) only.** Interactive TUI still runs
   the AIRIS engine; that is Phase 2 of the roadmap.
3. **Audit rotation is not shared.** Pi-path entries append to `audit.jsonl` but
   bypass `AuditLog`'s `maxEntries` rotation.
4. **`builtin-sandbox` is not yet the single policy source.** The Pi path reads
   `sandbox.json` directly (global then project-local); a malformed file aborts
   rather than downgrading, but the two engines should share one evaluator.
5. Android/Termux and non-x64 platforms remain unverified.

Milestone 4's CLI-level security and execution tests now pass, which was the
stated bar for declaring it complete.
