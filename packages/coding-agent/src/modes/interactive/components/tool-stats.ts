/**
 * Tool Execution Stats Component
 *
 * Shows real-time statistics about tool executions during a session.
 * Tracks file reads, writes, edits, bash commands, and more.
 */
import { truncateToWidth } from "@sufiyan-sabeel/airis-tui";
import { theme } from "../theme/theme.ts";

export interface ToolStats {
	totalCalls: number;
	byName: Record<string, number>;
	errors: number;
	startTime: number;
	// Current tool being executed (if any)
	currentTool?: string;
	currentToolId?: string;
}

export function createToolStats(): ToolStats {
	return {
		totalCalls: 0,
		byName: {},
		errors: 0,
		startTime: Date.now(),
	};
}

export function recordToolCall(stats: ToolStats, toolName: string, isError: boolean): void {
	stats.totalCalls++;
	stats.byName[toolName] = (stats.byName[toolName] || 0) + 1;
	if (isError) stats.errors++;
}

export function setToolRunning(stats: ToolStats, toolName?: string, toolId?: string): void {
	stats.currentTool = toolName;
	stats.currentToolId = toolId;
}

/**
 * Render tool stats as a compact single line.
 * Example: ⚡ 12 calls • 3 edits • 4 reads • 2 bash • 1 err
 */
export function renderToolStatsInline(stats: ToolStats, terminalWidth: number): string {
	if (stats.totalCalls === 0) return "";

	const parts: string[] = [];
	const maxParts = 5;

	// Sort by count descending
	const sorted = Object.entries(stats.byName)
		.sort(([, a], [, b]) => b - a)
		.slice(0, maxParts);

	for (const [name, count] of sorted) {
		const icon = getToolIcon(name);
		parts.push(`${icon}${count}`);
	}

	if (stats.errors > 0) {
		parts.push(`${theme.fg("error", "✗")}${stats.errors}`);
	}

	const duration = ((Date.now() - stats.startTime) / 1000).toFixed(0);
	parts.push(`${theme.fg("dim", `${duration}s`)}`);

	const line = parts.join(" ");
	return truncateToWidth(line, terminalWidth, "…");
}

/**
 * Render detailed tool stats panel.
 */
export function renderToolStatsPanel(stats: ToolStats, terminalWidth: number): string[] {
	const lines: string[] = [];
	const width = Math.max(30, terminalWidth);

	lines.push(theme.fg("accent", "─".repeat(width)));
	lines.push(`${theme.fg("accent", "⚡")} ${theme.fg("text", "Tool Execution Statistics")}`);
	lines.push(theme.fg("accent", "─".repeat(width)));

	if (stats.totalCalls === 0) {
		lines.push(`  ${theme.fg("dim", "No tool calls yet")}`);
		lines.push(theme.fg("accent", "─".repeat(width)));
		return lines;
	}

	// Duration
	const durationMs = Date.now() - stats.startTime;
	const duration =
		durationMs < 1000
			? `${durationMs}ms`
			: durationMs < 60000
				? `${(durationMs / 1000).toFixed(1)}s`
				: `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

	lines.push(`  ${theme.fg("dim", "Duration:")} ${theme.fg("text", duration)}`);
	lines.push(`  ${theme.fg("dim", "Total calls:")} ${theme.fg("accent", String(stats.totalCalls))}`);
	if (stats.errors > 0) {
		lines.push(`  ${theme.fg("dim", "Errors:")} ${theme.fg("error", String(stats.errors))}`);
	}
	lines.push("");

	// Tool breakdown
	const sorted = Object.entries(stats.byName).sort(([, a], [, b]) => b - a);

	const maxCount = sorted[0]?.[1] || 1;
	const barMaxWidth = Math.min(20, Math.floor(width * 0.3));

	for (const [name, count] of sorted) {
		const icon = getToolIcon(name);
		const barWidth = Math.round((count / maxCount) * barMaxWidth);
		const bar = "█".repeat(barWidth) + "░".repeat(barMaxWidth - barWidth);
		const nameWidth = 12;
		const paddedName = name.padEnd(nameWidth);
		lines.push(
			`  ${icon} ${theme.fg("dim", paddedName)} ${theme.fg("accent", bar)} ${theme.fg("dim", String(count))}`,
		);
	}

	// Currently running tool
	if (stats.currentTool) {
		lines.push("");
		lines.push(`  ${theme.fg("accent", "▶")} ${theme.fg("text", stats.currentTool)} ${theme.fg("dim", "running…")}`);
	}

	lines.push(theme.fg("accent", "─".repeat(width)));
	return lines;
}

function getToolIcon(name: string): string {
	switch (name) {
		case "read":
			return "📖";
		case "write":
			return "📝";
		case "edit":
			return "✏️";
		case "bash":
			return "🖥️";
		case "grep":
			return "🔍";
		case "find":
			return "🔎";
		case "ls":
			return "📁";
		case "adaptive_todo":
			return "📋";
		case "ask_question":
			return "❓";
		default:
			return "⚡";
	}
}

/**
 * Format a compact summary of tool usage for the footer.
 */
export function formatToolStatsSummary(stats: ToolStats): string {
	if (stats.totalCalls === 0) return "";

	const edits = stats.byName.edit || 0;
	const writes = stats.byName.write || 0;
	const reads = stats.byName.read || 0;
	const bashCount = stats.byName.bash || 0;
	const changes = edits + writes;

	const parts: string[] = [];
	if (changes > 0) parts.push(`${changes} edit`);
	if (reads > 0) parts.push(`${reads} read`);
	if (bashCount > 0) parts.push(`${bashCount} bash`);

	return parts.join(" · ") || `${stats.totalCalls} calls`;
}
