/**
 * Adaptive Agent Brain test suite.
 * Run: node test/standalone-adaptive-test.mjs
 * (vitest version requires npm workspaces to be linked; standalone version is preferred)
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAskQuestionToolDefinition } from "../src/core/adaptive/ask-question.ts";
import { AdaptiveBrainController } from "../src/core/adaptive/controller.ts";
import { ExploreTaskRunner } from "../src/core/adaptive/explore-task.ts";
import { SessionManager } from "../src/core/session-manager.ts";

function tmp(): string {
	return mkdtempSync(join(tmpdir(), "airis-adaptive-"));
}

describe("Adaptive Agent Brain", () => {
	it("does not create TODOs for a trivial request", async () => {
		const session = SessionManager.inMemory(tmp());
		const brain = new AdaptiveBrainController(session, session.getCwd());
		const prep = await brain.prepareTurn("What is 2+2?", []);
		expect(prep.assessment.shouldAnswerDirectly).toBe(true);
		expect(brain.todos.getSnapshot().items).toHaveLength(0);
	});

	it("creates and updates TODOs for complex multi-file work", async () => {
		const session = SessionManager.inMemory(tmp());
		const brain = new AdaptiveBrainController(session, session.getCwd());
		await brain.prepareTurn("Implement a feature across src/a.ts and src/b.ts, update tests and verify build", []);
		const snap = brain.todos.getSnapshot();
		expect(snap.items.length).toBeGreaterThan(1);
		expect(snap.items.filter((i) => i.status === "in_progress")).toHaveLength(1);
		const snap2 = brain.observeToolExecution({
			toolName: "bash",
			args: { command: "npm test" },
			result: { content: [{ type: "text", text: "ok" }], details: undefined },
			isError: false,
		});
		expect(snap2.items.some((i) => i.completionEvidence.some((e) => e.includes("npm test")))).toBe(true);
	});

	it("keeps Explore Task read-only", async () => {
		const dir = tmp();
		const file = join(dir, "agent.ts");
		writeFileSync(file, "export function agentLoop() { return 'ok'; }\n");
		const before = readFileSync(file, "utf8");
		const result = await new ExploreTaskRunner(dir, { maxRuntimeMs: 2000, maxFiles: 5, maxToolCalls: 20 }).run(
			"understand agent loop",
		);
		expect(readFileSync(file, "utf8")).toBe(before);
		expect(result.metrics.toolCalls).toBeLessThanOrEqual(20);
	});

	it("restores TODO state after session resume", () => {
		const dir = tmp();
		const session = SessionManager.create(dir, join(dir, "sessions"));
		const brain = new AdaptiveBrainController(session, dir);
		brain.todos.replacePlan("resume goal", ["first", "second"]);
		session.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "saved" }],
			api: "test",
			provider: "test",
			model: "test",
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: Date.now(),
		});
		const file = session.getSessionFile();
		expect(file).toBeDefined();
		const reopened = SessionManager.open(file!, join(dir, "sessions"), dir);
		const restored = new AdaptiveBrainController(reopened, dir);
		expect(restored.todos.getSnapshot().items.map((i) => i.description)).toEqual(["first", "second"]);
	});

	it("validates compaction summaries preserve unfinished tasks", () => {
		const session = SessionManager.inMemory(tmp());
		const brain = new AdaptiveBrainController(session, session.getCwd());
		brain.todos.replacePlan("goal", ["Preserve this unfinished task"]);
		expect(brain.validateCompactionSummary("Summary: remaining work includes Preserve this unfinished task.")).toBe(
			true,
		);
		expect(brain.validateCompactionSummary("Everything has been completed and there is nothing left to do.")).toBe(
			false,
		);
	});

	it("continues task state after compaction", async () => {
		const session = SessionManager.inMemory(tmp());
		const brain = new AdaptiveBrainController(session, session.getCwd());
		brain.todos.replacePlan("fix and ship", ["Fix bug", "Run tests"]);
		brain.recordCompactionMetrics({
			reason: "adaptive",
			tokensBefore: 5000,
			summaryLength: 200,
			openTodos: 2,
			createdAt: new Date().toISOString(),
		});
		await brain.prepareTurn("Run tests and ship", []);
		expect(brain.todos.getSnapshot().items.length).toBeGreaterThanOrEqual(2);
	});

	it("blocks completion when verification fails", () => {
		const session = SessionManager.inMemory(tmp());
		const brain = new AdaptiveBrainController(session, session.getCwd());
		brain.todos.replacePlan("fix failing tests", ["Fix bug in foo.ts", "Run and verify tests", "Ship changes"]);
		const snap = brain.observeToolExecution({
			toolName: "bash",
			args: { command: "npm test" },
			result: { content: [{ type: "text", text: "FAILED" }], details: undefined },
			isError: true,
		});
		expect(snap.items.some((i) => i.status === "blocked" && i.failureReason?.includes("Verification failed"))).toBe(
			true,
		);
	});

	it("works without special user commands", async () => {
		const session = SessionManager.inMemory(tmp());
		const brain = new AdaptiveBrainController(session, session.getCwd());
		const prep = await brain.prepareTurn("Update src/a.ts and src/b.ts and run tests", []);
		expect(prep.assessment.shouldCreateTodoPlan).toBe(true);
		expect(brain.todos.getSnapshot().items.length).toBeGreaterThan(0);
	});

	it("does not depend on a provider/model", async () => {
		const session = SessionManager.inMemory(tmp());
		const brain = new AdaptiveBrainController(session, session.getCwd());
		const prep = await brain.prepareTurn("Refactor the agent runtime and verify tests across multiple files", []);
		expect(prep.assessment.complexity).not.toBe("trivial");
	});

	it("uses practical resource limits for Termux", async () => {
		const dir = tmp();
		writeFileSync(join(dir, "index.ts"), "export const x = 1;\n");
		const result = await new ExploreTaskRunner(dir, {
			maxRuntimeMs: 1000,
			maxToolCalls: 8,
			maxFiles: 2,
			maxDepth: 2,
			maxParallel: 1,
		}).run("inspect index");
		expect(result.metrics.toolCalls).toBeLessThanOrEqual(8);
	});
});

describe("Ask Question ability", () => {
	it("returns structured input_required in non-interactive mode", async () => {
		const session = SessionManager.inMemory(tmp());
		const tool = createAskQuestionToolDefinition(session);
		const result = await tool.execute(
			"call",
			{
				title: "Select approach",
				question: "Which implementation approach should AIRIS use?",
				choices: [
					{ label: "Extend runtime", explanation: "Recommended; lowest risk." },
					{ label: "Separate module", explanation: "More isolation." },
					{ label: "Extension", explanation: "Easier to disable." },
				],
			},
			undefined,
			undefined,
			{
				mode: "print",
				hasUI: false,
				sessionManager: session,
				cwd: session.getCwd(),
				abort() {},
				isIdle: () => true,
				isProjectTrusted: () => true,
				signal: undefined,
				hasPendingMessages: () => false,
				shutdown() {},
				getContextUsage: () => undefined,
				compact() {},
				getSystemPrompt: () => "",
				getSystemPromptOptions: () => ({}),
			} as any,
		);
		expect(result.details.status).toBe("input_required");
		expect(result.details.title).toBe("Select approach");
	});
});
