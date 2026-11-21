# AIRIS × Pi — Milestone 4 Final Report

**Commit:** `e80b70d29` · **Branch:** `integration/pi-runtime` · **PR:** #64 (base restored to `remediation/baseline`, unmerged)
**CI (both green):** AIRIS [44570040842](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44570040842) · Pi Runtime [44570041058](https://github.com/sufiyan-sabeel/AIRIS-CLI/actions/runs/44570041058)

## Acceptance criteria

| # | Criterion | State | Evidence |
|---|---|---|---|
| 1 | Real AIRIS CLI launches Pi | **partial** | `--engine pi` exists and routes to the adapter; the runtime turn through the CLI is **not** demonstrated (see Limitations 1) |
| 2 | A real message reaches the Pi runtime | **yes** | deterministic E2E, real `AgentSession` |
| 3 | Deterministic mock provider response | **yes** | Pi `faux` provider, scripted responses |
| 4 | A permitted tool call executes | **yes** | real `tool_execution_*` events asserted |
| 5 | A denied tool call is blocked before execution | **yes** | `touch <marker>` scripted; marker file never created |
| 6 | AIRIS audit records the decision | **yes** | JSONL audit contains a `deny` record |
| 7 | Session persistence and restoration | **yes** | `SessionManager.create/open/inMemory` covered by integration tests |
| 8 | Existing AIRIS tests green | **yes** | 2,836 passed, 0 failed |
| 9 | Full CI passes | **yes** | both workflows green (above) |
| 10 | No existing feature removed | **yes** | only additive changes under `packages/coding-agent/src/cli` + `main.ts` |

## Task 1 — deterministic faux authentication (done)

`Error: No API key found for "faux"` came from Pi resolving auth through `ModelRuntime` (`model-registry.ts:95`). Two upstream APIs fixed it:

```ts
const runtime = await ModelRuntime.create({ allowModelNetwork: false });
runtime.registerNativeProvider(faux.provider);          // model-runtime.ts:928
await runtime.setRuntimeApiKey("faux", "faux-test-key"); // model-runtime.ts:624
await createAgentSession({ modelRuntime: runtime, model: faux.getModel(), ... });
```

`setRuntimeApiKey` alone was **not** sufficient — the provider had to be registered first. CI proved both halves: the first attempt still failed with the same auth error until `registerNativeProvider` was added.

Also corrected: `FauxResponseStep` is `AssistantMessage | FauxResponseFactory` (`faux.ts:117`), not a `{ message }` wrapper — CI's typecheck caught the invented shape.

## Task 2 — AIRIS permission extension (done, enforced)

`integration/airis-runtime/src/guard-extension.ts` generates `<agentDir>/extensions/airis-guard.ts`, the location Pi discovers extensions from (`loader.ts:833`). The generated module:

- imports the guard implementation (policy logic not duplicated);
- registers `pi.on("tool_call")` and returns Pi's own `ToolCallEventResult { block, reason }`;
- registers `pi.on("tool_result")` to record outcomes;
- appends every decision to a JSONL audit file.

**Enforcement is proven, not assumed:** with `denyExec: ["touch"]`, the runtime is scripted to run `touch <marker>`; the test asserts a `deny` audit record exists **and** that the marker file was never created.

## Task 3 — CLI integration (partial)

| Flag | State |
|---|---|
| `--engine pi` | **implemented** — routes to the adapter, exits 1 with a build instruction when the runtime is absent |
| `--print` | **pre-existing**, reused by the Pi path |
| `--model` | **not implemented** for the Pi path (parsed, not applied) |
| `--continue` | **not implemented** for the Pi path |

`src/cli/pi-engine.ts` resolves the adapter through a computed specifier so AIRIS stays buildable without `vendor/pi`. Verified locally: `--version` → `0.79.9` unchanged; `--help` lists `--engine <name>`; `--engine airis --version` unchanged; `--engine pi --print "hello"` → `airis: the Pi runtime adapter is not available. Build it first: ...`.

## Task 4 — deterministic E2E (done)

4 tests against the real runtime: streamed text deltas; real tool-execution events; guard allow+deny with audit records; and blocked-before-execution with a filesystem side-effect assertion.

## Task 5 — verification

| Suite | Result |
|---|---|
| AIRIS `agent` | **165 passed** |
| AIRIS `ai` | **350 passed**, 731 skipped |
| AIRIS `coding-agent` | **1,642 passed**, 45 skipped |
| AIRIS `tui` | **679 passed**, 0 failed |
| Adapter unit + guard | **20 passed** |
| Adapter integration (real runtime) | **6 passed** |
| Deterministic E2E | **4 passed** |
| AIRIS typecheck | **passed in CI** (could not complete in the 2 GB sandbox) |

## Installation

```bash
npm ci                                   # AIRIS (338 packages)
cd vendor/pi && npm ci                   # pinned runtime
npm run hydrate:model-data               # gitignored model data (network)
# build in topological order: telemetry, schema, chord, tui, codemode, mcp,
#   ai, durable, env, agent, coding-agent
cd ../../integration/airis-runtime && npm install
```

## Verified CLI usage

```bash
airis --version                      # 0.79.9   (unchanged)
airis --help                         # lists --engine <name>
airis --engine airis --version       # 0.79.9   (default engine unchanged)
airis --engine pi --print "hello"    # exits 1 with a build instruction when the runtime is absent
```

## Remaining limitations

1. **No CLI-level Pi turn yet.** The CLI path has no way to inject the faux provider, and no credential exists, so `airis --engine pi --print` cannot be shown completing a turn. The runtime turn is proven at the adapter level (Task 4), not through the CLI.
2. **`--model` and `--continue` are not wired** for the Pi engine.
3. **The guard extension is not installed by the CLI.** `writeGuardExtension` targets `<agentDir>/extensions`, but the CLI path does not yet pass `~/.airis/agent` as `agentDir`, so the Pi CLI path would use Pi's default agent dir and run **ungated**. This is the most important remaining gap.
4. **Audit records go to a JSONL file**, not to AIRIS's existing `core/audit-log.ts` schema. Unifying them is outstanding.
5. **Android/Termux** unverified; the Android bridge file is still absent.
6. **Live provider E2E: NOT RUN** — no credentials, and none were requested or committed.
7. The Rust `CI/CD` workflow still fails on the pre-existing `toml` crate error; untouched by this milestone.
