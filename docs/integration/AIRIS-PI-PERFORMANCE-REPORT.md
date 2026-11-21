# AIRIS × Pi — Performance (Milestone 3)

**Rule applied:** measure, then report. Nothing below is estimated.

**Environment for all measurements:** 2 vCPU, 2 GB RAM, Debian 12 (gVisor), Node 22.19.0, npm 10.9.4.

## 1. Measured

### AIRIS CLI startup (pre-integration baseline)

`node packages/coding-agent/dist/cli.js --version`, 5 runs:

| Metric | Value |
|---|---|
| min | **0.177 s** |
| median | **0.182 s** |
| max | 0.262 s |
| output | `0.79.9`, exit 0 |

This is the **existing AIRIS engine** — the path in use today. It is the baseline any Pi-based path must be compared against.

### Installation and build

| Operation | Time | Where |
|---|---|---|
| `npm ci` (AIRIS, 338 packages) | **45 s** | this sandbox |
| `npm ci` (`vendor/pi`, 338 packages) | **1 m 23 s** | this sandbox |
| Pi runtime build, 11 packages (incl. hydrate) | **35–45 s** | CI runner |
| `npm install` (adapter, 52 packages) | 27 s | this sandbox |

## 2. Not measured

| Metric | Why not |
|---|---|
| **Runtime initialization time** | Requires the built Pi runtime; `chord` and `ai` cannot be built in this 2 GB sandbox. CI builds them but the job does not instrument timing. |
| **First-token latency** | Requires a live provider credential. None is available. |
| **Streaming throughput** | Same. |
| **Memory consumption of a session** | Same — no session can be run locally, and the CI job does not sample RSS. |
| **Session restoration time** | Restoration is implemented and its code path is covered, but no timing was captured. |

## 3. Honest comparison statement

There is **no post-integration performance number** to compare against the 0.182 s baseline, because the Pi-backed path cannot be executed in this environment. Any claim that "AIRIS on Pi starts in X seconds" would be invented.

What can be said: the adapter adds **no work to the existing startup path**. It is a separate package, imported only by its own tests and (future) opt-in entry point, so the measured 0.182 s baseline is unaffected by this milestone. That is verified by the fact that `airis --version` still resolves and exits 0 in the same repository state.

## 4. How to close the gap

Add timing instrumentation to the `Pi Runtime` workflow (Node `performance.now()` around `createAgentSession`, plus `process.memoryUsage()` after start), and to the E2E script once a credential exists. Both produce numbers from a runner where the runtime actually builds.
