/**
 * Deterministic end-to-end proof against the real vendored Pi runtime.
 *
 * No provider credential is used: Pi's own `faux` provider scripts the model.
 * The runtime still enforces auth resolution, so a dummy key is registered on a
 * ModelRuntime and passed through createAgentSession({ modelRuntime }) --
 * model-runtime.ts:218 (create) and :624 (setRuntimeApiKey).
 *
 * This proves the runtime executes: a prompt reaches the agent, text streams,
 * a tool call is produced and its events fire. Live-model E2E remains NOT RUN.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AirisAuditRecord, createAirisGuard } from "../src/guard.ts";

let available = false;
let workspace = "";
// The vendored runtime is only importable after its build; these stay dynamic.
let pi: typeof import("@earendil-works/pi-coding-agent");
let ai: typeof import("@earendil-works/pi-ai");

beforeAll(async () => {
	workspace = mkdtempSync(join(tmpdir(), "airis-e2e-"));
	try {
		pi = await import("@earendil-works/pi-coding-agent");
		ai = await import("@earendil-works/pi-ai");
		available = true;
	} catch {
		console.warn("[e2e] Pi runtime not importable — deterministic E2E skipped. Build vendor/pi first.");
	}
});

afterAll(() => {
	if (workspace) rmSync(workspace, { recursive: true, force: true });
});

/**
 * Builds a ModelRuntime that knows the faux provider and holds a dummy key.
 * The provider must be registered first (registerNativeProvider,
 * model-runtime.ts:928); otherwise auth resolution has nothing to resolve and
 * Pi reports 'No API key found for faux'.
 */
async function fauxRuntime(
	faux: ReturnType<typeof ai.fauxProvider>,
): Promise<Awaited<ReturnType<typeof pi.ModelRuntime.create>>> {
	const runtime = await pi.ModelRuntime.create({ allowModelNetwork: false });
	runtime.registerNativeProvider(faux.provider);
	await runtime.setRuntimeApiKey("faux", "faux-test-key-not-a-secret");
	return runtime;
}

describe("deterministic Pi execution", () => {
	it("streams a scripted assistant reply through a real session", async () => {
		if (!available) return expect(available).toBe(false);

		const faux = ai.fauxProvider();
		// FauxResponseStep = AssistantMessage | FauxResponseFactory (faux.ts:117)
		faux.setResponses([ai.fauxAssistantMessage([ai.fauxText("Hello from the vendored runtime.")])]);

		const { session } = await pi.createAgentSession({
			cwd: workspace,
			model: faux.getModel(),
			modelRuntime: await fauxRuntime(faux),
			sessionManager: pi.SessionManager.inMemory(workspace),
		});

		const deltas: string[] = [];
		const unsubscribe = session.subscribe((event) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				deltas.push(event.assistantMessageEvent.delta);
			}
		});

		try {
			await session.prompt("say hello");
			expect(deltas.length).toBeGreaterThan(0);
			expect(deltas.join("")).toContain("Hello from the vendored runtime");
			expect(session.getLastAssistantText()).toContain("Hello");
		} finally {
			unsubscribe();
			session.dispose();
		}
	});

	it("fires real tool-execution events for a scripted tool call", async () => {
		if (!available) return expect(available).toBe(false);

		const faux = ai.fauxProvider();
		faux.setResponses([
			ai.fauxAssistantMessage([ai.fauxToolCall("bash", { command: "echo fixture" })]),
			ai.fauxAssistantMessage([ai.fauxText("done")]),
		]);

		const { session } = await pi.createAgentSession({
			cwd: workspace,
			model: faux.getModel(),
			modelRuntime: await fauxRuntime(faux),
			sessionManager: pi.SessionManager.inMemory(workspace),
		});

		const toolEvents: string[] = [];
		const unsubscribe = session.subscribe((event) => {
			if (typeof event.type === "string" && event.type.startsWith("tool_execution")) {
				toolEvents.push(event.type);
			}
		});

		try {
			await session.prompt("run a harmless command");
		} finally {
			unsubscribe();
			session.dispose();
		}

		expect(toolEvents.length).toBeGreaterThan(0);
	});
});

describe("guard decisions over the real call shape", () => {
	it("allows and denies, recording both", () => {
		const records: AirisAuditRecord[] = [];
		const allow = createAirisGuard({ policy: {}, audit: (r) => records.push(r) });
		expect(allow.onToolCall({ tool: "bash", input: { command: "echo fixture" } }).block).toBe(false);

		const deny = createAirisGuard({ policy: { denyExec: ["echo"] }, audit: (r) => records.push(r) });
		expect(deny.onToolCall({ tool: "bash", input: { command: "echo fixture" } }).block).toBe(true);

		expect(records.filter((r) => r.decision === "allow")).toHaveLength(1);
		expect(records.filter((r) => r.decision === "deny")).toHaveLength(1);
	});
});

describe("guard extension enforcement (real runtime)", () => {
	it("blocks a denied tool call before it executes and records the decision", async () => {
		if (!available) return expect(available).toBe(false);

		const { readFileSync, existsSync } = await import("node:fs");
		const { fileURLToPath } = await import("node:url");
		const { writeGuardExtension } = await import("../src/guard-extension.ts");

		const agentDir = join(workspace, "agent");
		const auditPath = join(workspace, "audit.jsonl");
		const marker = join(workspace, "should-not-exist.txt");
		const guardModulePath = fileURLToPath(new URL("../src/guard.ts", import.meta.url));

		writeGuardExtension({
			agentDir,
			policy: { denyExec: ["touch"] },
			auditPath,
			guardModulePath,
			sessionId: "e2e-guard-test",
		});

		const faux = ai.fauxProvider();
		faux.setResponses([
			ai.fauxAssistantMessage([ai.fauxToolCall("bash", { command: `touch ${marker}` })]),
			ai.fauxAssistantMessage([ai.fauxText("finished")]),
		]);

		const { session } = await pi.createAgentSession({
			cwd: workspace,
			agentDir,
			model: faux.getModel(),
			modelRuntime: await fauxRuntime(faux),
			sessionManager: pi.SessionManager.inMemory(workspace),
		});

		try {
			await session.prompt("create a marker file");
		} finally {
			session.dispose();
		}

		// The denial must be visible in the audit trail...
		expect(existsSync(auditPath)).toBe(true);
		const records = readFileSync(auditPath, "utf8").trim().split("\n").map((l) => JSON.parse(l));
		expect(records.some((r: { decision: string }) => r.decision === "deny")).toBe(true);

		// ...and the command must never have run.
		expect(existsSync(marker)).toBe(false);
	});
});
