#!/usr/bin/env node
/**
 * TUI Components test runner.
 * Tests the new adaptive progress, tool stats, and context gauge components.
 */
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const j = createJiti(import.meta.url, {
	interopDefault: true,
	aliases: {
		"@earendil-works/airis-ai": join(__dirname, "../../packages/ai/src/index.ts"),
		"@earendil-works/airis-agent-core": join(__dirname, "../../packages/agent/src/index.ts"),
		"@earendil-works/airis-tui": join(__dirname, "../../packages/tui/src/index.ts"),
	},
});

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

// ---- Load modules ----
let renderAdaptiveProgress, renderInlineProgress, renderTodoListPanel;
let createToolStats, recordToolCall, setToolRunning, renderToolStatsInline, renderToolStatsPanel, formatToolStatsSummary;
let renderContextGauge, renderInlineGauge, renderContextGaugePanel;

try {
	({ renderAdaptiveProgress, renderInlineProgress, renderTodoListPanel } = j("../src/modes/interactive/components/adaptive-progress.ts"));
	({ createToolStats, recordToolCall, setToolRunning, renderToolStatsInline, renderToolStatsPanel, formatToolStatsSummary } = j("../src/modes/interactive/components/tool-stats.ts"));
	({ renderContextGauge, renderInlineGauge, renderContextGaugePanel } = j("../src/modes/interactive/components/context-gauge.ts"));
	// Initialize theme for rendering
	const { initTheme } = j("../src/modes/interactive/theme/theme.ts");
	initTheme();
	console.log("All TUI modules loaded successfully.\n");
} catch (err) {
	console.error("Failed to load TUI modules:", err);
	process.exit(1);
}

const TEST_TODOS = [
	{ id: "t1", description: "Implement feature A", status: "completed", priority: "high", completionEvidence: ["PR merged"] },
	{ id: "t2", description: "Write tests", status: "in_progress", priority: "high", completionEvidence: [] },
	{ id: "t3", description: "Update docs", status: "pending", priority: "medium", completionEvidence: [] },
	{ id: "t4", description: "Run CI", status: "pending", priority: "low", completionEvidence: [] },
];

const BLOCKED_TODO = { id: "t5", description: "Build check", status: "blocked", priority: "high", completionEvidence: [], failureReason: "Build failed: exit code 1" };

// ================================================================
console.log("=== 1. Adaptive Progress - empty ===");
{
	const lines = renderAdaptiveProgress({ phase: "idle", summary: "", todos: [] }, 80);
	assert(lines.length === 0, "empty when no todos");
}

// ================================================================
console.log("\n=== 2. Adaptive Progress - with tasks ===");
{
	const lines = renderAdaptiveProgress({ phase: "planning", summary: "Planning", todos: TEST_TODOS }, 80);
	assert(lines.length > 0, "produces output");
	assert(lines.some(l => l.includes("Planning") || l.includes("Planning")), "shows phase");
	assert(lines.some(l => l.includes("→")), "shows current task arrow");
}

// ================================================================
console.log("\n=== 3. Adaptive Progress - blocked ===");
{
	const todos = [...TEST_TODOS, BLOCKED_TODO];
	const lines = renderAdaptiveProgress({ phase: "blocked", summary: "Blocked", todos }, 80);
	assert(lines.some(l => l.includes("Blocked")), "shows blocked phase");
}

// ================================================================
console.log("\n=== 4. Inline Progress - with tasks ===");
{
	const line = renderInlineProgress({ phase: "executing", summary: "", todos: TEST_TODOS }, 80);
	assert(line.length > 0, "produces output");
	assert(line.includes("Executing") || line.includes("Executing"), "shows phase");
	// Check for completion ratio (may be in different formats)
	const hasRatio = line.includes("3/4") || line.includes("1/") || line.includes("%");
	assert(hasRatio, `shows completion info: ${line.slice(0, 80)}`);
}

// ================================================================
console.log("\n=== 5. Inline Progress - empty ===");
{
	const line = renderInlineProgress({ phase: "idle", summary: "", todos: [] }, 80);
	assert(line === "", "empty when no todos");
}

// ================================================================
console.log("\n=== 6. Todo List Panel - with tasks ===");
{
	const todos = [...TEST_TODOS, BLOCKED_TODO];
	const lines = renderTodoListPanel(todos, 80);
	assert(lines.some(l => l.includes("Adaptive TODO List")), "shows title");
	assert(lines.some(l => l.includes("In_progress") || l.includes("In progress")), "shows in_progress group");
	assert(lines.some(l => l.includes("Build failed")), "shows failure reason");
	assert(lines.some(l => l.includes("PR merged")), "shows evidence");
}

// ================================================================
console.log("\n=== 7. Todo List Panel - empty ===");
{
	const lines = renderTodoListPanel([], 80);
	assert(lines.some(l => l.includes("No active tasks")), "shows empty message");
}

// ================================================================
console.log("\n=== 8. Tool Stats - tracking ===");
{
	const stats = createToolStats();
	assert(stats.totalCalls === 0, "starts at 0");
	recordToolCall(stats, "read", false);
	recordToolCall(stats, "read", false);
	recordToolCall(stats, "edit", false);
	recordToolCall(stats, "bash", true);
	assert(stats.totalCalls === 4, "total calls correct");
	assert(stats.byName["read"] === 2, "read count correct");
	assert(stats.errors === 1, "error count correct");
}

// ================================================================
console.log("\n=== 9. Tool Stats - inline ===");
{
	const stats = createToolStats();
	recordToolCall(stats, "read", false);
	recordToolCall(stats, "read", false);
	recordToolCall(stats, "edit", false);
	const line = renderToolStatsInline(stats, 80);
	assert(line.length > 0, "produces output");
	assert(line.includes("2"), "shows read count");
	assert(line.includes("1"), "shows edit count");
}

// ================================================================
console.log("\n=== 10. Tool Stats - panel ===");
{
	const stats = createToolStats();
	recordToolCall(stats, "read", false);
	recordToolCall(stats, "edit", false);
	recordToolCall(stats, "bash", true);
	const lines = renderToolStatsPanel(stats, 80);
	assert(lines.some(l => l.includes("Tool Execution Statistics")), "shows title");
	assert(lines.some(l => l.includes("Errors:")), "shows errors");
}

// ================================================================
console.log("\n=== 11. Tool Stats - running indicator ===");
{
	const stats = createToolStats();
	setToolRunning(stats, "bash", "call-123");
	assert(stats.currentTool === "bash", "shows running tool");
	setToolRunning(stats);
	assert(stats.currentTool === undefined, "clears running tool");
}

// ================================================================
console.log("\n=== 12. Tool Stats - summary ===");
{
	const stats = createToolStats();
	recordToolCall(stats, "read", false);
	recordToolCall(stats, "read", false);
	recordToolCall(stats, "edit", false);
	const summary = formatToolStatsSummary(stats);
	assert(summary.includes("2 read"), "shows reads");
	assert(summary.includes("1 edit"), "shows edits");
}

// ================================================================
console.log("\n=== 13. Context Gauge - rendering ===");
{
	const gauge = renderContextGauge({ percent: 65.5, tokensUsed: 65500, tokensTotal: 100000, autoCompactEnabled: true }, 80);
	assert(gauge.length > 0, "produces output");
	assert(gauge.includes("65.5%"), "shows percentage");
	assert(gauge.includes("auto"), "shows auto indicator");
}

// ================================================================
console.log("\n=== 14. Context Gauge - color coding ===");
{
	const normal = renderContextGauge({ percent: 50, tokensUsed: 50000, tokensTotal: 100000, autoCompactEnabled: false }, 80);
	const high = renderContextGauge({ percent: 75, tokensUsed: 75000, tokensTotal: 100000, autoCompactEnabled: false }, 80);
	const critical = renderContextGauge({ percent: 95, tokensUsed: 95000, tokensTotal: 100000, autoCompactEnabled: false }, 80);
	assert(normal.length > 0, "normal renders");
	assert(high.length > 0, "high renders");
	assert(critical.length > 0, "critical renders");
}

// ================================================================
console.log("\n=== 15. Context Gauge - panel ===");
{
	const lines = renderContextGaugePanel({ percent: 60, tokensUsed: 60000, tokensTotal: 100000, autoCompactEnabled: true }, 80);
	assert(lines.some(l => l.includes("Context Window")), "shows title");
	assert(lines.some(l => l.includes("60.0%")), "shows percentage");
	assert(lines.some(l => l.includes("Enabled")), "shows enabled status");
}

// ================================================================
console.log("\n=== 16. Context Gauge - inline ===");
{
	const line = renderInlineGauge({ percent: 45, tokensUsed: 45000, tokensTotal: 100000, autoCompactEnabled: false }, 80);
	assert(line.length > 0, "produces output");
	assert(line.includes("45%"), "shows percentage");
}

// ================================================================
console.log("\n=== 17. Narrow terminal (Termux) ===");
{
	const narrowTodos = [{ id: "t1", description: "Fix bug", status: "in_progress", priority: "high", completionEvidence: [] }];
	const lines = renderAdaptiveProgress({ phase: "executing", summary: "", todos: narrowTodos }, 40);
	assert(lines.length > 0, "renders on narrow terminal");
	const panel = renderTodoListPanel(narrowTodos, 40);
	assert(panel.length > 0, `panel renders on narrow terminal (got ${panel.length} lines)`);
}

// ---- Summary ----
console.log(`\n${"=".repeat(60)}`);
if (failed === 0) {
	console.log(`\n  ALL TUI TESTS PASSED: ${passed}/${passed}`);
} else {
	console.log(`\n  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
	console.log("\n  Failed tests:");
	for (const f of failures) {
		console.log(`    - ${f}`);
	}
}
console.log(`\n${"=".repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);
