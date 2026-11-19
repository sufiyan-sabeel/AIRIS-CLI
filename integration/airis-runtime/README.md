# `@sufiyan-sabeel/airis-runtime`

The AIRIS ↔ Pi adapter. **The only place in AIRIS that imports Pi.**

## Why this package exists

AIRIS must run on the genuine Pi runtime without losing its own identity. That
needs one boundary: Pi imports live in `src/pi-runtime.ts` and nowhere else.
Everything else in AIRIS talks to the interfaces in `src/index.ts`.

## Consumption architecture: built-artifact linking (approach A)

Three approaches were evaluated against the real repository, not in the abstract.

### C — published upstream packages: rejected

All packages except `pi-evals` are published at `1.5.2`, but **the vendored commit
is not that release**:

```
$ git describe --tags 1f6f319b
v1.5.2-303-g1f6f319bb        # 303 commits after the 1.5.2 tag
```

Depending on `@earendil-works/*@1.5.2` would silently install code 303 commits
older than the source this project vendored and reviewed. That is a provenance
mismatch, not a convenience.

### B — bundled runtime artifact: deferred

Bundling the runtime into one artifact is the cleanest distribution boundary, but
it adds a bundling step and artifact passing to every consumer. It buys nothing
that A does not already provide while the runtime lives in the same repository.
Revisit if AIRIS is ever distributed without `vendor/pi`.

### A — built-artifact linking: selected

```json
"dependencies": {
  "@earendil-works/pi-coding-agent": "file:../../vendor/pi/packages/coding-agent"
}
```

Verified behaviour (prototype, clean directory):

- `npm install` creates **only a symlink** — `added 1 package`, no registry copy of
  any `@earendil-works/*` package. So there are no duplicate module instances.
- The import resolves to the vendored build:
  `file:///…/vendor/pi/packages/schema/dist/index.js`
- The linked package's own dependencies resolve from `vendor/pi/node_modules`
  (Node resolves from the package's real path), so the runtime keeps its own
  dependency tree and AIRIS's lockfile is untouched.

**Requirement:** `vendor/pi` must be installed *and built* before this package is
type-checked or tested. That is exactly what the `Pi Runtime` workflow does.

## Tests

| Script | Needs the built runtime? | Runs where |
|---|---|---|
| `npm run test` | no | anywhere — pure unit tests over the AIRIS-owned interface |
| `npm run test:integration` | **yes** | `Pi Runtime` workflow, after the build steps |
| `npm run typecheck` | **yes** (for Pi's `.d.ts`) | `Pi Runtime` workflow |

Integration tests skip with an explicit message when the runtime is absent, so the
suite never reports a false pass.

## Not yet implemented

- **End-to-end LLM session** (prompt → streamed response → tool execution → result)
  requires a real provider credential. It is not claimed as working; see the
  integration report for its status.
- Model selection is not exposed through this interface yet; the runtime uses Pi's
  configured default.
