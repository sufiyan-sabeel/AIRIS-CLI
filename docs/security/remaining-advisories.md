# AIRIS — Advisory Status: Zod 4 Applied

**Status:** Zod 4.6.7 applied (Option A, approved 2026-11-19). **Production advisories: 0. Development advisories: 11.** The two are reported separately below — "zero" applies to production only.
**Baseline:** `remediation/baseline`, Node 22.19.0, npm 10.9.4.
**Commands:** `npm audit --omit=dev --json` (production) and `npm audit --json` (production + development). Threshold unchanged; nothing suppressed; no `--force`.

---

## 1. Result

| Scope | Before | After |
|---|---|---|
| **Production** (`--omit=dev`) | 2 (high `zod`, high `sandbox-runtime`) | **0** |
| **Development** (full audit) | 11 (not previously reported) | 11 (2 critical, 3 high, 5 moderate, 1 low) |

Two honest points about that table:

1. The earlier "9 → 2" progression was measured with `--omit=dev` only. The full audit was not reported before this round, so the 11 development findings are newly surfaced here rather than newly introduced.
2. **Zero is a production-only statement.** The development toolchain still carries findings, including two critical ones, described in §5.

---

## 2. What was applied

### 2.1 Root override

```json
"overrides": {
  "zod": "4.6.7",
  "@anthropic-ai/sandbox-runtime": { "zod": "3.25.76" }
}
```

The global override moves every consumer that declares zod 4 support onto 4.6.7. The **scoped** override keeps `@anthropic-ai/sandbox-runtime` on zod 3.25.76, because that package declares `^3.24.1` only and forcing 4 on it would be the "incompatible SDK behaviour" that was explicitly ruled out.

### 2.2 Reclassification of the example dependency

`packages/coding-agent/examples/extensions/sandbox/package.json`: `@anthropic-ai/sandbox-runtime` moved from `dependencies` to `devDependencies`.

That package is `private: true`, unpublished, and exists only as a workspace example. Declaring it as a runtime dependency of the workspace was inaccurate, and it is why `npm audit --omit=dev` counted a dev-only tool as production. **This is a classification correction, not suppression** — the finding still appears in the development audit below.

---

## 3. Verification the override was safe

### 3.1 Every production consumer's declared range (checked before applying)

| Consumer (resolved version) | Declared zod range | Accepts 4.6.7 |
|---|---|---|
| `@anthropic-ai/sdk@0.91.1` | `^3.25.0 \|\| ^4.0.0` | **yes** |
| `@mistralai/mistralai@2.2.1` | `^3.25.0 \|\| ^4.0.0` | **yes** |
| `openai@6.26.0` | `^3.25 \|\| ^4.0` | **yes** |
| `zod-to-json-schema@3.25.2` | `^3.25.28 \|\| ^4` | **yes** |
| `@anthropic-ai/sandbox-runtime@0.0.26` | `^3.24.1` | no — dev only, handled by the scoped override |

AIRIS itself imports zod nowhere: `grep -rn 'from "zod"' packages/*/src` → 0 results.

### 3.2 Resolved tree before

```
├─┬ @anthropic-ai/sandbox-runtime@0.0.26
│ └── zod@3.25.76
└─┬ @sufiyan-sabeel/airis-ai@0.79.9
  ├─┬ @anthropic-ai/sdk@0.91.1      └── zod@3.25.76 deduped
  ├─┬ @mistralai/mistralai@2.2.1
  │ ├─┬ zod-to-json-schema@3.25.2   └── zod@3.25.76 deduped
  │ └── zod@3.25.76 deduped
  └─┬ openai@6.26.0                 └── zod@3.25.76 deduped
```

### 3.3 Resolved tree after

```
├─┬ @anthropic-ai/sandbox-runtime@0.0.26 overridden
│ └── zod@3.25.76 overridden
└─┬ @sufiyan-sabeel/airis-ai@0.79.9
  ├─┬ @anthropic-ai/sdk@0.91.1      └── zod@4.6.7 overridden
  ├─┬ @mistralai/mistralai@2.2.1
  │ ├─┬ zod-to-json-schema@3.25.2   └── zod@4.6.7 deduped
  │ └── zod@4.6.7 deduped
  └─┬ openai@6.26.0                 └── zod@4.6.7 deduped
```

### 3.4 Duplicate majors and schema boundaries

Two zod majors exist in the tree. This is deliberate and bounded:

| Path | Version | Why |
|---|---|---|
| `node_modules/zod` | **4.6.7** | single copy shared by all four production consumers (deduped) |
| `node_modules/@anthropic-ai/sandbox-runtime/node_modules/zod` | 3.25.76 | nested, dev-only, matches that package's `^3.24.1` |

**No incompatible schema boundary exists**, for three concrete reasons:

1. The two copies are in **separate `node_modules` subtrees**, so neither can resolve the other's module.
2. AIRIS code creates no zod schemas at all (0 imports), so no schema object crosses from one major to the other.
3. The production consumers are deduped onto a **single** zod 4 copy, so `@anthropic-ai/sdk`, `@mistralai/mistralai`, `openai` and `zod-to-json-schema` all validate against the same major.

The only risk this leaves is that the dev-only example extension would break if it were run against zod 4 — which is why it keeps its own compatible copy.

---

## 4. Test and build verification with Zod 4

| Check | Result |
|---|---|
| Build | **pass**, no tracked file modified |
| `tsc --noEmit` (17 of 19 files) | **pass**, 0 errors |
| `check:pinned-deps` | **pass** |
| `check:ts-imports` | **pass** |
| `ai` (SDK-facing suite) | **350 passed, 731 skipped** — identical to the pre-Zod-4 baseline |
| `agent` | **165 passed** |
| `tui` | **679 passed, 0 failed** |
| `coding-agent` | run in CI (1,687 tests) — sandbox limit |
| Production audit | **0 advisories** |

---

## 5. Development advisories (reported separately, not fixed)

11 findings, all in build/test tooling, none shipped in the CLI:

| Advisory | Severity | Path | Fix |
|---|---|---|---|
| `tinypool` GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr | **critical** | `vitest` → `tinypool` | `vitest@5.1.1` (major) |
| `vitest` GHSA-82fw-gwwq-j7x9 | **critical** | `vitest@3.2.7` (direct devDependency of three workspaces) | `vitest@5.1.1` (major) |
| `vite` GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw | high | `vitest` → `vite@7.3.5` | `vitest@5.1.1` (major) |
| `zod` GHSA-mrhx-c7xc-m3w5 | high | `@anthropic-ai/sandbox-runtime` → `zod@3.25.76` (dev-only, scoped) | none for that package |
| `@vitest/coverage-v8`, `@vitest/mocker`, `test-exclude` | moderate | vitest toolchain | `@vitest/coverage-v8@5.1.1` (major) |
| `glob` GHSA-3g3m-2fjr-6pw4, `minimatch` GHSA-g3hv-75wg-m249 | moderate | **dev copies** under `test-exclude`; the *production* copies are already on 14.0.6 / 11.0.9 | vitest 5 upgrade |
| `esbuild` GHSA-g7r4-m6w7-qqqr, `vite-node` | low | vitest toolchain | vitest 5 upgrade |

**One upgrade clears most of this**: moving `vitest` from 3.2.7 to 5.1.1 resolves the two critical, the high `vite`, and the moderate toolchain findings together. That is a **dev-tooling major** with real regression risk (test runner API changes across two majors), so it is **not applied here** — it is a separate, reviewable change and was not part of this approval.

`@anthropic-ai/sandbox-runtime` itself has no published fix at any version; it remains a dev-only, example-scoped finding.

---

## 6. Summary

| Statement | Accurate? |
|---|---|
| "Production advisories: 0" | **Yes** — `npm audit --omit=dev` returns 0 |
| "Zero vulnerabilities overall" | **No** — 11 development findings remain, 2 critical |
| "The zod advisory is fixed" | **Yes for production** (4.6.7); the dev-only scoped copy stays on 3.25.76 by design |

Recommended next step, for a separate approval: upgrade `vitest` 3.2.7 → 5.1.1 and re-run the suite. That is the single change that closes the remaining critical and high development findings.
