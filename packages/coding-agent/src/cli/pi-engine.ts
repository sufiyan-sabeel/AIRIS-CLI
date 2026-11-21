/**
 * `airis --engine pi` — routes a single-shot prompt through the vendored Pi
 * runtime instead of the AIRIS engine.
 *
 * Phase 1 wiring:
 *   - agentDir      : AIRIS's own agent directory (~/.airis/agent), so Pi config,
 *                     sessions and the permission extension live with AIRIS data.
 *   - guard         : the adapter installs <agentDir>/extensions/airis-guard.ts
 *                     before the session starts, so a session can never run
 *                     without AIRIS's permission boundary.
 *   - audit         : decisions are written to <agentDir>/audit.jsonl using
 *                     AIRIS's AuditEntry schema { timestamp, type, sessionId, data }.
 *   - --model       : resolved through Pi's ModelRuntime.
 *   - --continue    : restores the newest session for this working directory.
 *
 * The adapter lives outside the AIRIS workspace, so it is resolved at runtime
 * through a computed specifier: AIRIS must stay buildable without vendor/pi.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "../config.ts";
import type { Args } from "./args.ts";

interface AdapterModule {
	createAirisRuntime: (options: Record<string, unknown>) => {
		start(): Promise<void>;
		prompt(text: string, onDelta?: (delta: string) => void): Promise<{ text: string }>;
		dispose(): Promise<void>;
		diagnostics(): Promise<{ model?: string; provider?: string; tools: string[] }>;
	};
	listAirisSessions: (cwd: string) => Promise<Array<{ path: string }>>;
	DEFAULT_AIRIS_POLICY: Record<string, unknown>;
}

async function loadAdapter(): Promise<AdapterModule> {
	// Resolve relative to this module first (dist/cli/../../.. = repo root), then
	// fall back to the current working directory so a globally linked install
	// still finds the adapter.
	const relative = ["..", "..", "..", "integration", "airis-runtime", "src", "pi-runtime.ts"].join("/");
	const candidates = [relative, join(process.cwd(), "integration", "airis-runtime", "src", "pi-runtime.ts")];
	let lastError: unknown;
	for (const candidate of candidates) {
		try {
			return (await import(candidate)) as AdapterModule;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function fail(message: string): never {
	process.stderr.write(`airis: ${message}\n`);
	process.exit(1);
}

/** Reads AIRIS's sandbox policy so both engines enforce the same rules. */
export function loadPermissionPolicy(agentDir: string, fallback: Record<string, unknown>): Record<string, unknown> {
	const candidates = [join(agentDir, "sandbox.json"), join(process.cwd(), ".airis", "sandbox.json")];
	for (const file of candidates) {
		if (!existsSync(file)) continue;
		try {
			const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
			return {
				denyRead: parsed.denyRead ?? (fallback.denyRead as unknown[]),
				denyWrite: parsed.denyWrite ?? (fallback.denyWrite as unknown[]),
				denyExec: parsed.denyExec ?? (fallback.denyExec as unknown[]),
				failClosed: true,
			};
		} catch (error) {
			// A malformed policy must not silently downgrade to permissive.
			fail(`invalid sandbox policy at ${file}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	return fallback;
}

export async function runPiEngine(parsed: Args): Promise<void> {
	const prompt = parsed.messages[0];
	if (!prompt) fail('--engine pi requires a prompt, e.g. airis --engine pi --print "hello"');

	let adapter: AdapterModule;
	try {
		adapter = await loadAdapter();
	} catch (error) {
		fail(
			`the Pi runtime adapter is not available: ${error instanceof Error ? error.message : String(error)}\n` +
				"Build it first: cd vendor/pi && npm ci && npm run hydrate:model-data, then build the runtime.",
		);
	}

	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const policy = loadPermissionPolicy(agentDir, adapter.DEFAULT_AIRIS_POLICY);

	let restoreFrom: string | undefined;
	if (parsed.continue) {
		try {
			const sessions = await adapter.listAirisSessions(cwd);
			restoreFrom = sessions.length > 0 ? sessions[sessions.length - 1].path : undefined;
		} catch (error) {
			fail(`could not list previous sessions: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (!restoreFrom) fail("--continue was given but no previous session exists for this directory");
	}

	const runtime = adapter.createAirisRuntime({
		cwd,
		agentDir,
		permissionPolicy: policy,
		auditSessionId: `airis-pi-${Date.now()}`,
		...(parsed.model ? { model: parsed.model } : {}),
		...(restoreFrom ? { restoreFrom } : {}),
		// Persistent sessions make --continue meaningful and match how a coding
		// agent is expected to behave; files live under the AIRIS agent dir.
		persistence: "persistent" as const,
		// TEST ONLY: set by the CLI end-to-end test; never in normal use.
		...(process.env.AIRIS_PI_TEST_RESPONSE
			? { testScriptedResponses: [process.env.AIRIS_PI_TEST_RESPONSE] }
			: {}),
		...(process.env.AIRIS_PI_TEST_TOOL
			? { testToolCall: JSON.parse(process.env.AIRIS_PI_TEST_TOOL) as { tool: string; input: Record<string, unknown> } }
			: {}),
	});

	try {
		await runtime.start();
	} catch (error) {
		fail(`could not start the Pi runtime: ${error instanceof Error ? error.message : String(error)}`);
	}

	try {
		const result = await runtime.prompt(prompt, (delta) => process.stdout.write(delta));
		if (!result.text) process.stdout.write("");
		process.stdout.write("\n");
	} catch (error) {
		fail(`Pi runtime turn failed: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		await runtime.dispose();
	}
}
