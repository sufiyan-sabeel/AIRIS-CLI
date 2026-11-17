# Step 0 — CI reliability repair

This change makes CI able to fail. It changes no application code, no package
manifest, no dependency and no runtime behaviour.

## The defect

Every verification step in `.github/workflows/ci.yml` was suffixed with
`|| echo "::warning::…"`. In GitHub Actions a step succeeds if its script exits
zero, and `cmd || echo …` always exits zero — so the job reported success no
matter what happened. The same pattern existed in two other workflows
(`npm-audit.yml` and `deploy-pages.yml`).

## What actually runs today (measured, not assumed)

Executed on `main` at `71ed2c7f` under Node 22.19.0, the version CI pins:

| Stage | Command | Exit | Result |
|---|---|---|---|
| Install | `npm install --ignore-scripts --no-audit --no-fund` | 0 | passes |
| Build | `npm run build` | 0 | passes (~3 min) |
| Pinned deps | `npm run check:pinned-deps` | **1** | unpinned deps in `website/package.json` |
| TS imports | `npm run check:ts-imports` | 0 | passes |
| Type check | `npx tsc --noEmit -p tsconfig.json` | **2** | 4 × TS2345 |
| Tests | `npm test` | **1** | 3 of 4 workspaces cannot start; 1 real test failure |

All six reported green before this change.

## Changes

1. `.github/workflows/ci.yml` — every `|| echo` removed; the three checks in the
   combined step split into separate steps so a failure names its own stage;
   `timeout-minutes: 30` added; npm cache enabled.
2. `.github/workflows/npm-audit.yml` — `npm audit … || true` removed. The audit
   currently reports 9 production advisories (1 critical, 4 high, 2 moderate,
   2 low), so this job will fail until dependencies are updated. That is the
   point of a security gate.
3. `.github/workflows/deploy-pages.yml` — post-deploy reachability check now
   retries five times (propagation tolerance) and then fails with `::error::`
   instead of always passing.

## Known red stages (pre-existing, not caused by this change)

These are real defects in the repository that the masking hid. They are not
fixed here because doing so would change application source, which Step 0
excludes.

- **Type check** — `packages/agent/test/scratch/simple.ts`,
  `packages/coding-agent/examples/extensions/summarize.ts`,
  `packages/coding-agent/examples/sdk/02-custom-model.ts`,
  `packages/coding-agent/test/utilities.ts`: four stale model identifiers
  (`gpt-5.5`, `gpt-5.2`, `claude-opus-4-5`, `claude-sonnet-4-5`).
- **Tests** — `package-lock.json` contains no `rollup` entry although
  `vite@7.3.5` depends on it, so `vitest` cannot start in the `agent`, `ai` and
  `coding-agent` workspaces. With `rollup` supplied manually, one genuine test
  failure remains: `test/agent.test.ts > Agent > should create an agent
  instance with custom initial state`.
- **Pinned deps** — `website/package.json` uses `^` ranges for `postcss`,
  `tailwindcss`, `tailwindcss-animate`, `typescript`.

## Deliberately unchanged

- `npm install` retained over `npm ci`: the lockfile cannot reproduce the tree
  (see above), so `npm ci` would fail for the wrong reason. Fixing the lockfile
  is a separate reviewable change.
- `build-binaries.yml` `continue-on-error: true` on the release-upload step:
  release path, out of scope.
- `daily-facts.yml` push fallback and the `|| true` inside a conditional
  defensive copy in `deploy-pages.yml`: neither masks a quality gate.

## Verification

An isolated harness executed every `run:` body of the old and new `ci.yml`
under `bash -e` (GitHub's default shell) with a deliberately failing command
injected at one stage at a time:

| Scenario | Old job | New job | New fails at |
|---|---|---|---|
| everything green | PASS | PASS | — |
| build error | PASS | **FAIL** | `npm run build` |
| type error | PASS | **FAIL** | `npx tsc --noEmit -p tsconfig.json` |
| pinned-deps error | PASS | **FAIL** | `npm run check:pinned-deps` |
| test failure | PASS | **FAIL** | `npm test` |

The deploy reachability step was verified with an unreachable endpoint: five
attempts, then exit 1 (previously exit 0).
