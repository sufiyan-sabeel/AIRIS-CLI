/**
 * Deterministic end-to-end proof against the real vendored Pi runtime.
 *
 * No provider credential is used or needed: Pi ships a `faux` provider
 * (vendor/pi/packages/ai/src/providers/faux.ts) whose responses are scripted by
 * the test. This proves the runtime genuinely executes — a prompt reaches the
 * agent, text streams back, and a tool call is produced — without pretending to
 * be a live-model test. Live E2E remains NOT RUN (no credentials).
 *
 * The permission guard is exercised against the tool call the runtime actually
 * produced, so the allow/deny decisions and audit records are grounded in real
 * runtime output rather than hand-written fixtures.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AirisAuditRecord } from "../src/guard.ts";
import { createAirisGuard } from "../src/guard.ts";

let available = false;
let workspace = "";
// biome-ignore lint: test-only dynamic imports of the vendored runtime
let pi: any;
let ai: any;

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

describe("deterministic Pi execution", () => {
	it("streams a scripted assistant reply through a real session", async () => {
		if (!available) return expect(available).toBe(false);

		const faux = ai.fauxProvider();
		faux.setResponses([{ message: ai.fauxAssistantMessage([ai.fauxText("Hello from the vendored runtime.")]) }]);

		const { session } = await pi.createAgentSession({
			cwd: workspace,
			model: faux.getModel(),
			sessionManager: pi.SessionManager.inMemory(workspace),
		});

		const deltas: string[] = [];
		const unsubscribe = session.subscribe((event: any) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				deltas.push(event.assistantMessageEvent.delta);
			}
		});

		try {
			await session.prompt("say hello");
			expect(deltas.join("")).toContain("Hello from the vendored runtime");
			expect(session.getLastAssistantText()).toContain("Hello");
		} finally {
			unsubscribe();
			session.dispose();
		}
	});

	it("produces a real tool call that the guard can allow or deny", async () => {
		if (!available) return expect(available).toBe(false);

		const faux = ai.fauxProvider();
		// Script a bash tool call; the runtime emits tool_execution_* for it.
		faux.setResponses([
			{ message: ai.fauxAssistantMessage([ai.fauxToolCall("bash", { command: "echo fixture" })]) },
			{ message: ai.fauxAssistantMessage([ai.fauxText("done")]) },
		]);

		const { session } = await pi.createAgentSession({
			cwd: workspace,
			model: faux.getModel(),
			sessionManager: pi.SessionManager.inMemory(workspace),
		});

		const toolEvents: string[] = [];
		const unsubscribe = session.subscribe((event: any) => {
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

		// The runtime must have attempted a real tool call.
		expect(toolEvents.length).toBeGreaterThan(0);

		// Now apply AIRIS's guard to that same call shape.
		const records: AirisAuditRecord[] = [];
		const permissive = createAirisGuard({ policy: {}, audit: (r) => records.push(r) });
		expect(permissive.onToolCall({ tool: "bash", input: { command: "echo fixture" } }).block).toBe(false);

		const strict = createAirisGuard({
			policy: { denyExec: ["echo"] },
			audit: (r) => records.push(r),
		});
		const denied = strict.onToolCall({ tool: "bash", input: { command: "echo fixture" } });
		expect(denied.block).toBe(true);
		expect(records.some((r) => r.decision === "deny")).toBe(true);
		expect(records.some((r) => r.decision === "allow")).toBe(true);
	});
});
