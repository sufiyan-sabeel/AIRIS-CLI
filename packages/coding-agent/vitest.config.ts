import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const aiSrcIndex = fileURLToPath(new URL("../ai/src/index.ts", import.meta.url));
const aiSrcOAuth = fileURLToPath(new URL("../ai/src/oauth.ts", import.meta.url));
const agentSrcIndex = fileURLToPath(new URL("../agent/src/index.ts", import.meta.url));
const tuiSrcIndex = fileURLToPath(new URL("../tui/src/index.ts", import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		testTimeout: 30000,
		exclude: [
			"test/advanced-dashboard.test.ts",
			"test/explore-task.test.ts",
			"test/agent-settled-event.test.ts",
			"test/prompt-loading.test.ts",
			"test/prompt-loading-ar.test.ts",
			"test/agent-session-retry-fallback.test.ts",
			"test/cache-stats.test.ts",
			"test/memory-store.test.ts",
			"test/builtin-sandbox.test.ts",
			"test/project-learning.test.ts",
			"test/audit-log.test.ts",
			"test/provider-resilience.test.ts",
			"test/security-auditor.test.ts",
		],
		server: {
			deps: {
				external: [/@silvia-odwyer\/photon-node/],
			},
		},
	},
	resolve: {
		alias: [
			{ find: /^@earendil-works\/airis-ai$/, replacement: aiSrcIndex },
			{ find: /^@earendil-works\/airis-ai\/oauth$/, replacement: aiSrcOAuth },
			{ find: /^@earendil-works\/airis-agent-core$/, replacement: agentSrcIndex },
			{ find: /^@earendil-works\/airis-tui$/, replacement: tuiSrcIndex },
			{ find: /^@mariozechner\/airis-ai$/, replacement: aiSrcIndex },
			{ find: /^@mariozechner\/airis-ai\/oauth$/, replacement: aiSrcOAuth },
			{ find: /^@mariozechner\/airis-agent-core$/, replacement: agentSrcIndex },
			{ find: /^@mariozechner\/airis-tui$/, replacement: tuiSrcIndex },
			{ find: /^@earendil-works\/airis-ai$/, replacement: aiSrcIndex },
			{ find: /^@earendil-works\/airis-agent-core$/, replacement: agentSrcIndex },
			{ find: /^@earendil-works\/airis-tui$/, replacement: tuiSrcIndex },
		],
	},
});
