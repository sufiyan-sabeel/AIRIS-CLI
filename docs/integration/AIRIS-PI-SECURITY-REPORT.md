# AIRIS × Pi — Security Review (Milestone 3)

**Scope:** the adapter (`integration/airis-runtime`), the vendored runtime, and the boundary between them.
**Method:** source review plus executed tests. Nothing here is a claim about behaviour that was not observed.

## 1. Areas reviewed

| Area | Finding | Evidence |
|---|---|---|
| **API-key handling** | The adapter never reads, stores, logs or forwards credentials. It passes no auth options to Pi; Pi resolves its own credentials from its agent dir. | `src/pi-runtime.ts` has no `process.env` access and no key parameter; `diagnostics()` returns only model id, provider, tool names, persistence mode and cwd. |
| **Environment exposure** | No environment variable is read or written by the adapter. | grep of `src/` for `process.env` → 0 matches. |
| **Tool permission boundaries** | Unchanged. The adapter does not add, remove or relax tools; it surfaces whatever Pi activates (`getActiveToolNames()`), and Pi's own permission model applies. | Integration test asserts `diagnostics().tools.length > 0`, i.e. real tools are present and reported verbatim. |
| **Filesystem access** | Default mode is `SessionManager.inMemory(cwd)` — no session files written. Persistent mode uses Pi's session store. Tests run inside an `mkdtemp` workspace and delete it afterwards. | `test/integration.test.ts` (`mkdtempSync`, `rmSync`); persistence test asserts mode only, never writes outside the temp workspace. |
| **Command execution** | Reaches AIRIS only through Pi's built-in tools. No shell access is added by the adapter. | Tool list comes from Pi; adapter contains no `child_process` import. |
| **Session storage** | Owned by Pi's `SessionManager`. The adapter chooses *which* manager, never *how* it serialises. | `SessionManager.create/open/inMemory`, `session-manager.ts:1773/1784/1822`. |
| **Audit logging** | AIRIS's `core/audit-log.ts` is untouched by this milestone and is not yet wired to the Pi runtime. **Not integrated.** | no diff to that file. |
| **Extension isolation** | Extensions load through Pi's own discovery; the adapter adds none. AIRIS extension isolation is unchanged because AIRIS extensions are not yet routed through Pi. | no extension loading code in the adapter. |
| **Error messages / data leakage** | `normalizeRuntimeError()` reduces anything thrown to its message (or JSON), and every adapter error is wrapped in `AirisRuntimeUnavailableError`. Provider payloads are not logged by the adapter. | `src/index.ts` + 4 unit tests covering Error, string, object and circular values. |

## 2. Deliberate non-claims

- **No sandboxing claim.** Pi's own `SECURITY.md` states it runs inside the user's security boundary and relies on the user for containment. The adapter does not change that, and AIRIS's `builtin-sandbox` deny-rule extension is **not** connected to the Pi runtime yet.
- **No credential-handling test.** There is no provider credential in this environment, so credential resolution by Pi is **not exercised**. Reported as not tested.
- **No permission-boundary test.** No test yet asserts that a denied tool call is refused under the Pi runtime.

## 3. Unresolved limitations

1. **Audit logging is not integrated** — Pi tool executions are not yet recorded in AIRIS's audit log. Until they are, an AIRIS user running the Pi path would have weaker audit coverage than the existing engine provides. This is a real gap, not a hypothetical.
2. **Sandbox/permission layer not wired** — AIRIS's deny-rule sandbox does not apply to Pi tool calls yet.
3. **Credential storage path differs** — Pi resolves credentials from its agent dir; AIRIS uses `~/.airis`. No migration exists, so a user would need to configure credentials separately for the Pi path.
4. **Vendored dependencies are not security-scanned in this milestone.** The directive requires not excluding them; the `pi-runtime` workflow builds them but does not yet run `npm audit` against `vendor/pi/package-lock.json`. That is a gap to close before the Pi path becomes default.

## 4. Security posture summary

| Question | Answer |
|---|---|
| Does the adapter weaken any existing AIRIS restriction? | **No.** It adds no tools, no shell, no env access and no credential handling. |
| Is the Pi path ready to be the default engine? | **No.** Audit logging, the permission layer, credential migration and a vendored-dependency audit are all missing. |
| Is anything claimed that was not tested? | No — the untested areas are listed in §2 and §3. |
