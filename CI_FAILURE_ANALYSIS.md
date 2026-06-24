# CI Failure Analysis Report

## Root Cause
The GitHub Actions CI workflow failed during the "Install dependencies" step because `npm ci --ignore-scripts` exited with code 1, printing npm usage/help information.

The underlying error was:
```
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error Missing: @sufiyan-sabeel/airis-cli@0.79.3 from lock file
```

The root cause was a **package-lock.json out of sync with package.json**:
- The workspace package `packages/coding-agent` has `"name": "@sufiyan-sabeel/airis-cli"` in its package.json
- The package-lock.json contained an entry for `@earendil-works/airis-coding-agent` pointing to `packages/coding-agent` (old package name)
- The lockfile was missing the `@sufiyan-sabeel/airis-cli` entry entirely
- This mismatch caused `npm ci` to fail because it requires exact lockfile synchronization

## Affected Workflow File
- `.github/workflows/ci.yml` (line 33: `npm ci --ignore-scripts`)
- `.github/workflows/build-binaries.yml` (line 117: `npm ci --ignore-scripts`)

## Exact Fix Applied
Regenerated the root `package-lock.json` to match the current workspace package.json files:

```bash
npm install --package-lock-only --ignore-scripts
```

This command:
1. Reads all package.json files in the workspace
2. Resolves dependencies fresh
3. Updates package-lock.json to match current package.json specifications
4. Correctly links all workspace packages including `@sufiyan-sabeel/airis-cli`

## Files Changed
- `package-lock.json` - Regenerated to include correct workspace package entries:
  - `@earendil-works/airis-agent-core` → `packages/agent` (link: true)
  - `@earendil-works/airis-ai` → `packages/ai` (link: true)
  - `@earendil-works/airis-tui` → `packages/tui` (link: true)
  - `@sufiyan-sabeel/airis-cli` → `packages/coding-agent` (link: true)
  - `pi-extension-custom-provider-anthropic` → `packages/coding-agent/examples/extensions/custom-provider-anthropic` (link: true)
  - `pi-extension-custom-provider-gitlab-duo` → `packages/coding-agent/examples/extensions/custom-provider-gitlab-duo` (link: true)
  - `pi-extension-gondolin` → `packages/coding-agent/examples/extensions/gondolin` (link: true)
  - `pi-extension-sandbox` → `packages/coding-agent/examples/extensions/sandbox` (link: true)
  - `pi-extension-with-deps` → `packages/coding-agent/examples/extensions/with-deps` (link: true)

## Validation Results

### Package-lock.json Synchronization ✓
- All workspace packages now correctly listed with `"link": true`
- `@sufiyan-sabeel/airis-cli@0.79.3` now present in lockfile
- No "Missing from lock file" errors

### Workflow Syntax ✓
- `.github/workflows/ci.yml` - Valid YAML, correct npm ci usage
- `.github/workflows/build-binaries.yml` - Valid YAML, correct npm ci usage
- Node version 22 matches project requirement (`engines.node: ">=22.19.0"`)
- `--ignore-scripts` flag is valid for npm ci

### Dependency Installation ✓
- `npm ci --ignore-scripts` now passes the lockfile sync check
- Workspace linking configured correctly in lockfile

### Build/Check Commands (Structure Verified) ✓
- `npm run build` - Defined in root package.json, builds all packages in order
- `npm run check` - Runs biome, pinned-deps, ts-imports, shrinkwrap, tsgo, browser-smoke
- `npm test` - Runs vitest across workspaces

## Notes
- The workflow files themselves did not require modification - the syntax was already correct
- The fix addresses the root cause (lockfile drift) rather than working around it
- Both CI workflows (ci.yml and build-binaries.yml) will now pass the install step
- No changes to source code or package.json files were required
- The `--ignore-scripts` flag is appropriate for CI to avoid running lifecycle scripts during dependency installation