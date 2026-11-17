# AIRIS — Remaining Advisory Assessment and Proposed Policy

**Scope:** the two advisories that remain after remediation.
**Baseline:** `remediation/baseline`, npm 10.9.4, Node 22.19.0.
**Command:** `npm audit --omit=dev --audit-level=high`. Threshold unchanged, nothing suppressed, no `--force`.

## 1. State

| | Count |
|---|---|
| Advisories at the start of remediation | 9 (1 critical, 4 high, 2 moderate, 2 low) |
| Removed by regenerating the corrupted lockfile | 5 — including the **critical** `shell-quote` (now 1.12.0) and `brace-expansion` (5.0.13) |
| Removed by the `undici` bump (8.5.0 → 8.12.4) | 1 |
| Removed by `glob` 14.0.6 and `minimatch` 11.0.9 | 2 |
| **Remaining** | **2** — `zod` (high), `@anthropic-ai/sandbox-runtime` (high) |

## 2. Production vs development exposure

| Advisory | Ships with the CLI? | Why |
|---|---|---|
| `zod` GHSA-mrhx-c7xc-m3w5 | **Yes — production runtime** | Transitive through `@anthropic-ai/sdk`, `@mistralai/mistralai` and `openai`, all of which are runtime dependencies of `@sufiyan-sabeel/airis-ai` |
| `@anthropic-ai/sandbox-runtime` | **No — example only** | Declared by `packages/coding-agent/examples/extensions/sandbox` (`private: true`), a workspace example. Not part of the CLI bundle |

Note on the second row: `npm audit --omit=dev` currently counts it as production **because the example declares it under `dependencies`, not `devDependencies`**. That is a classification artefact of the workspace layout, not evidence that it ships.

## 3. Advisory detail

### 3.1 `zod` — GHSA-mrhx-c7xc-m3w5 (high, CVSS 7.5)

| Field | Value |
|---|---|
| Title | Zod can exhaust memory while validating oversized constrained collections |
| Installed | `zod@3.25.76` |
| Affected range | `<4.6.6` |
| Fixed version | `4.6.6` or later (available: `4.6.7`) |
| Dependency path | `@sufiyan-sabeel/airis-ai` → `@anthropic-ai/sdk@0.91.1` → `zod` (deduped); same node also reached via `@mistralai/mistralai@2.2.1` and `openai@6.26.0` |
| Reachable functionality | Schema validation inside the provider SDKs, applied to API responses. Not applied to end-user input by AIRIS itself |
| Practical exposure | **Low.** Triggering it requires a malicious or compromised upstream API response containing an oversized constrained collection. Impact is local denial of service (memory exhaustion), not data disclosure |
| Does AIRIS import zod? | **No** — `grep -rn 'from "zod"' packages/*/src` returns 0 results |

#### The key finding: zod 4 is already compatible with every production consumer

I checked each consumer's declared range rather than assuming the SDKs blocked it:

| Consumer | Declared zod range | Accepts zod 4? |
|---|---|---|
| `@anthropic-ai/sdk@0.91.1` (installed) | `^3.25.0 \|\| ^4.0.0` | **yes** |
| `@mistralai/mistralai@2.2.1` (installed) | `^3.25.0 \|\| ^4.0.0` | **yes** |
| `openai@6.26.0` (installed) | `^3.25 \|\| ^4.0` | **yes** |
| `zod-to-json-schema@3.25.2` | `^3.25.28 \|\| ^4` | **yes** |
| `@anthropic-ai/sandbox-runtime@0.0.26` (dev example) | `^3.24.1` | no — dev only |

**So the advisory is fixable.** My previous report said it was "not fixable without an upstream SDK release"; that was wrong, and this is the correction. The SDKs already declare zod 4 support. What pins zod to 3 today is simply that nothing requests 4 and npm resolves to the lowest satisfying version.

### 3.2 `@anthropic-ai/sandbox-runtime` (high)

| Field | Value |
|---|---|
| Advisory | The package itself is flagged (`range=*`); its only advisory is the `zod` issue above |
| Installed | `0.0.26` |
| Affected range | all versions |
| Fixed version | none published |
| Dependency path | root `devDependencies` → `airis-extension-sandbox@1.9.6` (workspace example, `private: true`) → `@anthropic-ai/sandbox-runtime@0.0.26` → `zod@3.25.76` |
| Reachable functionality | Only if a user installs and runs the example extension. **Not in the shipped CLI** |
| Practical exposure | **None in production** |

---

## 4. Proposed policy — for approval, not applied

### Option A (recommended): fix `zod` properly, reclassify the example

1. **Move zod to 4.x** with a root override `"zod": "4.6.7"`. Every production consumer declares support for `^4`, and AIRIS imports zod nowhere, so this is a supported upgrade rather than a forced one. The dev-only `sandbox-runtime` would be out of range and must be handled by item 2.
2. **Reclassify the example's dependency**: move `@anthropic-ai/sandbox-runtime` from `dependencies` to `devDependencies` in `packages/coding-agent/examples/extensions/sandbox/package.json`. It is a private, unpublished example; declaring it as a runtime dependency of a shipped workspace was always inaccurate. This is a classification correction, **not** suppression — the finding stays in this report either way.
3. Verify with the full test suite (the provider SDKs are exercised by `packages/ai`, 350 tests) and a CI run.

**Expected result:** production advisories drop to **0**, with no exception and no threshold change. The `sandbox-runtime` finding remains documented here as a dev-only item with no fix available.

**Risk:** zod 3 → 4 is a major, and the three SDKs' parsers would run against it. They declare compatibility, but this is a behavioural change worth its own CI run and review. If anything fails, revert — it is one override plus one lockfile regeneration.

### Option B (only if Option A is deferred): a narrowly scoped exception

If you prefer not to take a zod major in this round, this is the exception I would propose. **It is not applied.** Per your instruction, no global threshold change and no silent suppression.

| Field | Value |
|---|---|
| **Exact advisory ID** | `GHSA-mrhx-c7xc-m3w5` |
| **Exact dependency path** | `@sufiyan-sabeel/airis-ai` → `@anthropic-ai/sdk@0.91.1` → `zod@3.25.76` (same node deduped for `@mistralai/mistralai@2.2.1` and `openai@6.26.0`) |
| **Written risk rationale** | AIRIS does not import zod directly. The advisory is reachable only through provider SDK response validation, i.e. against a malicious or compromised upstream API response, with local denial-of-service impact. Both installed SDKs already accept zod 4, so the exposure window closes as soon as the upgrade in Option A is scheduled. Accepted for **at most 30 days**. |
| **Owner** | Umaiz Sufiyan |
| **Review date** | 2026-12-17 (30 days from this report) |
| **Regression check** | A CI step that fails if the affected path changes in any of these ways: (a) `zod` resolves to a version `<4.6.6` **and** the resolved `@anthropic-ai/sdk` still declares `^3.25.0 \|\| ^4.0.0` (i.e. the upgrade is now possible and overdue); (b) a new production consumer of zod appears that is not in the allow-list above; (c) the SDK's declared zod range stops accepting `^4`, which would invalidate the plan. Implementation: `npm ls zod --json` plus `npm view <sdk>@<resolved> peerDependencies.zod`, asserted in a small script next to `check:pinned-deps`. |
| **Mechanism** | A dedicated step (`npm audit --omit=dev --audit-level=high --json` piped through a filter that fails on any advisory **except** the one ID above), **not** a lowered global threshold. The audit step itself stays at `--audit-level=high`. |

I would not apply Option B while Option A is available and cheap. It exists only so that "keep the gate red" is not the only alternative.

---

## 5. What is not being done

- No `npm audit fix --force`.
- No lowering of `--audit-level`.
- No `|| true`, no `continue-on-error`, no suppression file.
- No zod 4 override applied in this round — it is proposed, with evidence, for your approval.
