/**
 * Bash Spawn Hook Example
 *
 * Adjusts command, cwd, and env before execution.
 *
 * Usage:
 *   airis -e ./bash-spawn-hook.ts
 */

import type { ExtensionAPI } from "@sufiyan-sabeel/airis-cli";
import { createBashTool } from "@sufiyan-sabeel/airis-cli";

export default function (airis: ExtensionAPI) {
	const cwd = process.cwd();

	const bashTool = createBashTool(cwd, {
		spawnHook: ({ command, cwd, env }) => ({
			command: `source ~/.profile\n${command}`,
			cwd,
			env: { ...env, AIRIS_SPAWN_HOOK: "1" },
		}),
	});

	airis.registerTool({
		...bashTool,
		execute: async (id, params, signal, onUpdate, _ctx) => {
			return bashTool.execute(id, params, signal, onUpdate);
		},
	});
}
