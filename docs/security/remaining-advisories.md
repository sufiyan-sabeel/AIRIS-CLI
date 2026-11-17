# AIRIS — Remaining Advisory Assessment

**Scope:** the four advisories that remain after the lockfile regeneration and the `undici` bump.
**Baseline:** `remediation/baseline` @ `465ee06f`, npm 10.9.4, Node 22.19.0.
**Command:** `npm audit --omit=dev --audit-level=high` (threshold unchanged; nothing suppressed).

## State

| | Count |
|---|---|
| Advisories at the start of remediation | 9 (1 critical, 4 high, 2 moderate, 2 low) |
| Removed by regenerating the corrupted lockfile | 5 — including the **critical** `shell-quote` (now 1.12.0) and `brace-expansion` (5.0.13) |
| Removed by the `undici` bump (8.5.0 → 8.12.4) | 1 |
| **Remaining** | **4** (2 high, 2 moderate, 0 critical) |

Two of the four are **fixable through dependency updates**; two are **not fixable without an upstream release**. They are separated below rather than lumped into a blanket risk acceptance.

---

## Fixable through dependency updates

### 1. `glob` — GHSA-3g3m-2fjr-6pw4

| Field | Value |
|---|---|
| Advisory | GHSA-3g3m-2fjr-6pw4 — "AbortSignal cancellation bypass allows post-timeout filesystem traversal" |
| Severity | Moderate (CVSS not scored by the advisory) |
| Installed | `glob@13.0.6` (also `glob@10.5.0` nested under `test-exclude`) |
| Affected range | `>=9.0.0 <=14.0.1` |
| Classification | **Production.** `packages/coding-agent/package.json` declares `"glob": "13.0.6"` directly, so it ships with the CLI. The nested 10.5.0 copy is dev-only (via `@vitest/coverage-v8` → `test-exclude`). |
| Dependency path | `@sufiyan-sabeel/airis-cli` → `glob@13.0.6` |
| Runtime reachability | Reachable — the CLI uses `glob` for local file-pattern matching. Exploitation needs a caller-supplied pattern plus an aborted/timed-out traversal; the advisory is about traversal continuing after cancellation. In this product the pattern comes from the user's own prompt and the files being traversed are already inside the local user's trust boundary (see `SECURITY.md`), so practical exposure is **low**, not zero. |
| Fixed version | `14.0.6` |
| Regression risk | **Moderate** — major version bump (13 → 14). API and behaviour changes are possible in path matching and option handling. |
| Recommended action | Bump to 14.0.6, run the full `coding-agent` suite in CI, and keep the bump only if green. This is a real fix, not a workaround. |

### 2. `minimatch` — GHSA-g3hv-75wg-m249

| Field | Value |
|---|---|
| Advisory | GHSA-g3hv-75wg-m249 — "potential denial of service via globparts amplification" |
| Severity | Moderate |
| Installed | `minimatch@10.2.5` (also `9.0.9` nested under the dev-only `glob@10.5.0`) |
| Affected range | `>=7.0.0 <11.0.1` |
| Classification | **Production.** Declared directly in `packages/coding-agent/package.json`. |
| Dependency path | `@sufiyan-sabeel/airis-cli` → `minimatch@10.2.5`; also `glob@10.5.0` → `minimatch@9.0.9` (dev) |
| Runtime reachability | Reachable via the same file-pattern paths as `glob`. ReDoS requires an attacker-controlled pattern with pathological `globparts`. Locally-driven patterns mean **low** practical exposure, but a malicious extension or an `AGENTS.md`-driven instruction could supply one. |
| Fixed version | `11.0.9` |
| Regression risk | **Moderate** — major bump (10 → 11). |
| Recommended action | Bump together with `glob` (they resolve as a pair) and verify in CI. |

---

## Not fixable without an upstream release

### 3. `zod` — GHSA-mrhx-c7xc-m3w5

| Field | Value |
|---|---|
| Advisory | GHSA-mrhx-c7xc-m3w5 — "Zod can exhaust memory while validating oversized constrained collections" |
| Severity | **High** (CVSS 7.5) |
| Installed | `zod@3.25.76` |
| Affected range | `<4.6.6` |
| Classification | **Production**, transitively. Not declared by AIRIS; pulled in by provider SDKs. |
| Dependency path | `@sufiyan-sabeel/airis-ai` → `@anthropic-ai/sdk@0.91.1` → `zod@3.25.76` (deduped with `@mistralai/mistralai@2.2.1`). Also `@anthropic-ai/sandbox-runtime` (dev, see below). |
| Runtime reachability | `zod` validates payloads parsed by the Anthropic and Mistral SDKs. The input is a provider response, not end-user input, so triggering it requires a malicious or compromised upstream API response containing an oversized constrained collection. Practical exposure: **low**, but the consequence (process memory exhaustion / crash) is a denial of service against the local CLI. |
| Fixed version | `zod@4.6.6` or later |
| Why it cannot be fixed here | `@anthropic-ai/sdk@0.91.1` and `@mistralai/mistralai@2.2.1` both pin `zod` to the 3.x line. Forcing zod 4 with a root override would break their type contracts at runtime and compile time. `npm audit fix` correctly reports no non-breaking fix. |
| Regression risk of forcing it | **High** — zod 4 is a breaking rewrite; the SDKs' parsers are written against zod 3. |
| Recommended action | **Track, do not force.** Re-check on each `@anthropic-ai/sdk` / `@mistralai/mistralai` release. If either ships zod 4 support, bump immediately. This is a specific upstream constraint, not an accepted risk in general. |

### 4. `@anthropic-ai/sandbox-runtime`

| Field | Value |
|---|---|
| Advisory | The package itself is flagged (`range=*`); its only advisory is inherited from `zod` above. |
| Severity | High |
| Installed | `0.0.26` |
| Affected range | All versions |
| Classification | **Development only.** Declared in the root `devDependencies` and consumed solely by `packages/coding-agent/examples/extensions/sandbox`, a workspace example. It is not part of the `airis` CLI bundle. |
| Dependency path | root devDependency → `airis-extension-sandbox@1.9.6` (workspace example) → `@anthropic-ai/sandbox-runtime@0.0.26` → `zod@3.25.76` |
| Runtime reachability | **None in production.** Only reachable if a user installs and runs the example extension explicitly. |
| Fixed version | None published |
| Regression risk | n/a |
| Recommended action | Not a production blocker. Either leave it documented as dev-only, or remove the example extension's dependency on a package with no fix. Do **not** describe this as a shipped vulnerability. |

---

## Summary for decision

| Advisory | Shipped? | Fixable? | Action |
|---|---|---|---|
| `glob` GHSA-3g3m-2fjr-6pw4 | yes | **yes** — 14.0.6 (major) | bump + CI verify |
| `minimatch` GHSA-g3hv-75wg-m249 | yes | **yes** — 11.0.9 (major) | bump + CI verify |
| `zod` GHSA-mrhx-c7xc-m3w5 | yes (via SDKs) | **no** — blocked on upstream SDK | track upstream |
| `@anthropic-ai/sandbox-runtime` | **no** (dev example) | no | dev-only; document |

The audit gate (`--audit-level=high`) will keep failing while `zod` remains, and that is the correct behaviour: it is a genuine high-severity advisory in a shipped dependency, and it cannot be resolved without an upstream change. Lowering the threshold to hide it is not acceptable; the honest options are to keep the gate red with this documented rationale, or to scope the audit step to fail on `critical` plus an explicit allow-list entry for this one advisory ID.

No `--force`, no `--audit-level` change, and no suppression has been applied.
