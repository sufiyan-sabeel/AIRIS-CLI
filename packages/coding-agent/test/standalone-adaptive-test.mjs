#!/usr/bin/env node
/**
 * Standalone test runner for Adaptive Agent Brain.
 * No vitest, no rollup, no esbuild required.
 * Runs directly with Node using jiti for .ts files.
 *
 * Usage: node test/standalone-adaptive-test.mjs
 */
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "../..");
const PACKAGES = join(ROOT, "packages");

// Create jiti with aliases that resolve workspace packages to their src/
const j = createJiti(import.meta.url, {
	interopDefault: true,
	aliases: {
		"@sufiyan-sabeel/airis-ai": join(PACKAGES, "ai/src/index.ts"),
		"@sufiyan-sabeel/airis-ai/oauth": join(PACKAGES, "ai/src/oauth.ts"),
		"@sufiyan-sabeel/airis-agent-core": join(PACKAGES, "agent/src/index.ts"),
		"@sufiyan-sabeel/airis-tui": join(PACKAGES, "tui/src/index.ts"),
	},
});

// ---- Test runner ----
let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, label) {
	if (cond) {
		passed++;
		console.log(`  ✓ ${label}`);
	} else {
		failed++;
		failures.push(label);
		console.error(`  ✗ FAIL: ${label}`);
	}
}

function assertEqual(a, b, label) {
	const ok = JSON.stringify(a) === JSON.stringify(b);
	assert(ok, `${label} (${JSON.stringify(a)} === ${JSON.stringify(b)})`);
}

function tmpSession(dir) {
	const { SessionManager } = j(dir || "../src/core/session-manager.ts");
	return SessionManager.inMemory(`/tmp/airis-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// ---- Load modules ----
let AdaptiveBrainController, ExploreTaskRunner, formatExploreResultForContext;
let createAskQuestionToolDefinition, ADAPTIVE_QUESTION_CUSTOM_TYPE;
let ADAPTIVE_TODO_CUSTOM_TYPE;

try {
	({ AdaptiveBrainController } = j("../src/core/adaptive/controller.ts"));
	({ ExploreTaskRunner, formatExploreResultForContext } = j("../src/core/adaptive/explore-task.ts"));
	({ createAskQuestionToolDefinition } = j("../src/core/adaptive/ask-question.ts"));
	({ ADAPTIVE_TODO_CUSTOM_TYPE } = j("../src/core/adaptive/todo-store.ts"));
	({ ADAPTIVE_QUESTION_CUSTOM_TYPE } = j("../src/core/adaptive/ask-question.ts"));
	console.log("All modules loaded successfully.\n");
} catch (err) {
	console.error("Failed to load modules:", err);
	process.exit(1);
}

// ---- Tests ----

// Test 1: Trivial request creates no TODOs
console.log("=== 1. Trivial request creates no TODOs ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	const prep = await brain.prepareTurn("What is 2+2?", []);
	assert(prep.assessment.shouldAnswerDirectly === true, "shouldAnswerDirectly is true");
	assert(brain.todos.getSnapshot().items.length === 0, "no TODOs created");
}

// Test 2: Complex multi-file task creates and updates TODOs
console.log("\n=== 2. Complex multi-file task creates and updates TODOs ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	await brain.prepareTurn(
		"Implement a feature across src/a.ts and src/b.ts, update tests and verify build",
		[],
	);
	const snap = brain.todos.getSnapshot();
	assert(snap.items.length > 1, `multiple TODOs created (${snap.items.length})`);
	const inProg = snap.items.filter((i) => i.status === "in_progress");
	assertEqual(inProg.length, 1, "exactly one in_progress");

	// Simulate tool execution
	brain.observeToolExecution({
		toolName: "bash",
		args: { command: "npm test" },
		result: { content: [{ type: "text", text: "ok" }] },
		isError: false,
	});
	const snap2 = brain.todos.getSnapshot();
	const hasEvidence = snap2.items.some((i) =>
		i.completionEvidence.some((e) => e.includes("npm test")),
	);
	assert(hasEvidence, "evidence recorded for npm test");
}

// Test 3: Explore Task is read-only
console.log("\n=== 3. Explore Task is read-only ===");
{
	const { writeFileSync, readFileSync, mkdirSync } = await import("node:fs");
	const { join } = await import("node:path");
	const dir = `/tmp/airis-explore-${Date.now()}`;
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "agent.ts");
	writeFileSync(file, "export function agentLoop() { return 'ok'; }\n");
	const before = readFileSync(file, "utf8");
	const runner = new ExploreTaskRunner(dir, {
		maxRuntimeMs: 2000,
		maxFiles: 5,
		maxToolCalls: 20,
	});
	const result = await runner.run("understand agent loop");
	assertEqual(readFileSync(file, "utf8"), before, "file unchanged after exploration");
	assert(result.metrics.toolCalls <= 20, `tool calls within limit (${result.metrics.toolCalls})`);
	assert(result.metrics.toolCalls > 0, "at least one read-only call made");
	assert(
		result.relevantFilesAndSymbols.length > 0 || result.unknownsRequiringClarification.length > 0,
		"findings or unknowns produced",
	);
}

// Test 4: TODO state survives session resume
console.log("\n=== 4. TODO state survives session resume ===");
{
	const { SessionManager } = j("../src/core/session-manager.ts");
	const dir = "/tmp/airis-test-" + Date.now();
	const sm = SessionManager.create(dir, join(dir, "sessions"));
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	brain.todos.replacePlan("resume goal", ["first step", "second step"]);
	// Force persistence by adding an assistant message
	sm.appendMessage({
		role: "assistant",
		content: [{ type: "text", text: "ok" }],
		api: "test",
		provider: "test",
		model: "test",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
		stopReason: "stop",
		timestamp: Date.now(),
	});
	const file = sm.getSessionFile();
	assert(file !== undefined, "session file created");

	// Re-open session from file
	const sm2 = SessionManager.open(file, sm.getSessionDir(), sm.getCwd());
	const restored = new AdaptiveBrainController(sm2, sm2.getCwd());
	const snap = restored.todos.getSnapshot();
	assertEqual(
		snap.items.map((i) => i.description),
		["first step", "second step"],
		"TODOs restored after resume",
	);
	assertEqual(snap.goal, "resume goal", "goal restored");
}

// Test 5: Compaction preserves user requirements and unfinished tasks
console.log("\n=== 5. Compaction preserves user requirements and unfinished tasks ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	brain.todos.replacePlan("build and verify", ["Write code", "Run tests", "Ship"]);
	const instr = brain.buildCompactionInstructions("build and verify");
	assert(
		instr.includes("Original user goal: build and verify"),
		"compaction instructions contain original goal",
	);
	assert(
		instr.includes("Write code") || instr.includes("todo_"),
		"compaction instructions reference open tasks",
	);
	assert(
		brain.validateCompactionSummary("Summary: still working on Write code and remaining steps. Focus on Run tests next."),
		true,
		"valid summary accepted",
	);
	assertEqual(
		brain.validateCompactionSummary("Everything has been completed and there is nothing left to do."),
		false,
		"invalid summary rejected when tasks are open",
	);
}

// Test 6: Work continues after compaction
console.log("\n=== 6. Work continues after compaction ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	brain.todos.replacePlan("fix and ship", ["Fix bug", "Run tests"]);
	brain.recordCompactionMetrics({
		reason: "adaptive",
		tokensBefore: 5000,
		summaryLength: 200,
		openTodos: 2,
		createdAt: new Date().toISOString(),
	});
	assert(brain.todos.getOpenItems().length === 2, "open tasks persist after compaction");
	// After compaction, prepareTurn should continue with existing plan
	await brain.prepareTurn("Run tests and ship", []);
	assert(brain.todos.getSnapshot().items.length >= 2, "TODOs still tracked after compaction");
}

// Test 7: Failed verification prevents task completion
console.log("\n=== 7. Failed verification prevents task completion ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	// Manually create TODOs to test blocking
	brain.todos.replacePlan("fix failing tests", ["Fix bug in foo.ts", "Run and verify tests", "Ship changes"]);
	assert(brain.todos.getOpenItems().length > 0, "plan created for verification test");
	const snap = brain.observeToolExecution({
		toolName: "bash",
		args: { command: "npm test" },
		result: { content: [{ type: "text", text: "FAILED" }] },
		isError: true,
	});
	const blocked = snap.items.filter((i) => i.status === "blocked");
	assert(blocked.length > 0, "task blocked on verification failure");
	assert(
		blocked.some((i) => i.failureReason?.includes("Verification failed")),
		"failure reason includes verification info",
	);
}

// Test 8: Works without special user commands
console.log("\n=== 8. Works without special user commands ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	const prep = await brain.prepareTurn("Update src/a.ts and src/b.ts and run tests", []);
	assert(prep.assessment.shouldCreateTodoPlan === true, "TODO plan created without any /command");
	assert(brain.todos.getSnapshot().items.length > 0, "TODOs exist without user triggering /todo");
}

// Test 9: Does not depend on a provider/model
console.log("\n=== 9. Does not depend on a provider/model ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	const prep = await brain.prepareTurn("Refactor the agent runtime and verify tests across multiple files", []);
	assert(prep.assessment.complexity !== "trivial", "complexity assessed without model");
	assert(prep.assessment.shouldCreateTodoPlan === true, "plan created without model");
}

// Test 10: Practical resource limits for Termux
console.log("\n=== 10. Practical resource limits for Termux ===");
{
	const { writeFileSync, mkdirSync } = await import("node:fs");
	const { join } = await import("node:path");
	const dir = `/tmp/airis-limits-${Date.now()}`;
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "index.ts"), "export const x = 1;\n");
	const result = await new ExploreTaskRunner(dir, {
		maxRuntimeMs: 1000,
		maxToolCalls: 8,
		maxFiles: 2,
		maxDepth: 2,
		maxParallel: 1,
	}).run("inspect index");
	assert(result.metrics.toolCalls <= 8, `tool calls within limit (${result.metrics.toolCalls} <= 8)`);
	assert(result.metrics.filesRead <= 2, `files read within limit (${result.metrics.filesRead} <= 2)`);
}

// Test 11: Ask Question — non-interactive returns input_required
console.log("\n=== 11. Ask Question — non-interactive returns input_required ===");
{
	const sm = tmpSession();
	const tool = createAskQuestionToolDefinition(sm);
	const result = await tool.execute(
		"call",
		{
			title: "Select approach",
			question: "Which implementation approach should AIRIS use?",
			context: "Brain module integration decision",
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
			sessionManager: sm,
			cwd: sm.getCwd(),
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
		},
	);
	assertEqual(result.details.status, "input_required", "non-interactive returns input_required");
	assertEqual(result.details.title, "Select approach", "title preserved in structured result");
}

// Test 12: Ask Question — session entry recorded
console.log("\n=== 12. Ask Question — session entry recorded ===");
{
	const sm = tmpSession();
	const tool = createAskQuestionToolDefinition(sm);
	await tool.execute(
		"call",
		{
			title: "Verify first",
			question: "Should we verify before shipping?",
			choices: [
				{ label: "Yes, run tests", explanation: "Safest." },
				{ label: "Skip verification", explanation: "Faster." },
				{ label: "Verify partially", explanation: "Some tests." },
			],
		},
		undefined,
		undefined,
		{
			mode: "print",
			hasUI: false,
			sessionManager: sm,
			cwd: sm.getCwd(),
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
		},
	);
	const entries = sm.getBranch().filter(
		(e) => e.type === "custom" && e.customType === ADAPTIVE_QUESTION_CUSTOM_TYPE,
	);
	assert(entries.length >= 1, "ask_question decision stored in session");
	assertEqual(entries[entries.length - 1].data.title, "Verify first", "correct question title in session");
}

// Test 13: Assessment reasons
console.log("\n=== 13. Assessment reasons ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	const prep = await brain.prepareTurn(
		"Implement adaptive brain across src/cli.ts and src/session.ts, verify build, delete old cache",
		[],
	);
	assert(prep.assessment.risk === "high", "risk=high for destructive words");
	assert(prep.assessment.verificationRequired === true, "verification required for build");
	assert(
		prep.assessment.reasons.some((r) => r.includes("file hint")),
		"file hints detected in reasons",
	);
}

// Test 14: Adaptive progress event
console.log("\n=== 14. Adaptive progress event ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	const prep = await brain.prepareTurn(
		"Implement multi-file changes across cli.ts, session.ts and test them",
		[],
	);
	assert(
		["planning", "exploring", "executing", "assessing"].includes(prep.progress.phase),
		`phase is valid (${prep.progress.phase})`,
	);
	assert(
		typeof prep.progress.summary === "string" && prep.progress.summary.length > 0,
		"summary is non-empty string",
	);
}

// Test 15: Explore result formatted for context
console.log("\n=== 15. Explore result formatted for context ===");
{
	const result = {
		summary: "Found relevant files",
		relevantFilesAndSymbols: [
			{ path: "src/foo.ts", symbols: ["bar", "baz"], reason: "Matches keywords" },
		],
		architectureFindings: ["Uses plugin system"],
		risks: ["Uncommitted changes"],
		recommendedImplementationLocation: ["src/foo.ts"],
		unknownsRequiringClarification: ["API unclear"],
		metrics: { runtimeMs: 123, toolCalls: 3, filesRead: 2, truncated: false },
	};
	const text = formatExploreResultForContext(result);
	assert(text.includes("Explore Task"), "mentions Explore Task");
	assert(text.includes("src/foo.ts"), "includes relevant file path");
	assert(text.includes("123ms"), "includes runtime");
}

// Test 16: TODO evidence required before completion
console.log("\n=== 16. TODO evidence required before completion ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	brain.todos.replacePlan("task", ["step1", "step2"]);
	const id = brain.todos.getSnapshot().items[0].id;
	let threw = false;
	try {
		brain.todos.updateStatus(id, "completed", {});
	} catch {
		threw = true;
	}
	assert(threw, "throws when completing without evidence");
}

// Test 17: Single in_progress enforcement
console.log("\n=== 17. Single in_progress enforcement ===");
{
	const sm = tmpSession();
	const brain = new AdaptiveBrainController(sm, sm.getCwd());
	brain.todos.replacePlan("task", ["a", "b", "c", "d"]);
	brain.todos.updateStatus(brain.todos.getSnapshot().items[1].id, "in_progress");
	const snap = brain.todos.getSnapshot();
	assertEqual(
		snap.items.filter((i) => i.status === "in_progress").length,
		1,
		"still only one in_progress",
	);
}

// ---- Summary ----
console.log(`\n${"=".repeat(60)}`);
if (failed === 0) {
	console.log(`\n  ALL TESTS PASSED: ${passed}/${passed}`);
} else {
	console.log(`\n  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
	console.log("\n  Failed tests:");
	for (const f of failures) {
		console.log(`    - ${f}`);
	}
}
console.log(`\n${"=".repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);
