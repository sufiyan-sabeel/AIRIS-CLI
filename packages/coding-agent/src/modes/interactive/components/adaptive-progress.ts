/**
 * Adaptive Brain Progress Widget
 *
 * Shows a compact progress indicator for the adaptive brain's TODO state.
 * Displays in the footer/status area without user interaction.
 */

import { truncateToWidth } from "@earendil-works/airis-tui";
import type { AdaptiveTodoItem, AdaptiveTodoStats } from "../../../core/adaptive/types.ts";
import { type ThemeColor, theme } from "../theme/theme.ts";

export interface AdaptiveProgressData {
	phase: string;
	summary: string;
	todos: AdaptiveTodoItem[];
}

const STATUS_ICONS: Record<string, string> = {
	completed: "✓",
	in_progress: "●",
	pending: "○",
	blocked: "✗",
	cancelled: "—",
};

const STATUS_COLORS: Record<string, ThemeColor> = {
	completed: "success",
	in_progress: "accent",
	pending: "dim",
	blocked: "error",
	cancelled: "muted",
};

const PRIORITY_ICONS: Record<string, string> = {
	critical: "!!!",
	high: "!!",
	medium: "!",
	low: "",
};

const PRIORITY_COLORS: Record<string, ThemeColor> = {
	critical: "error",
	high: "warning",
	medium: "accent",
	low: "dim",
};

// ============================================================================
// Time Utilities
// ============================================================================

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
}

function getElapsedMs(item: AdaptiveTodoItem): number {
	const now = Date.now();
	if (item.status === "completed" && item.completedAt && item.startedAt) {
		return new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime();
	}
	if (item.startedAt) {
		return now - new Date(item.startedAt).getTime();
	}
	return now - new Date(item.createdAt).getTime();
}

// ============================================================================
// Progress Bar
// ============================================================================

function renderProgressBar(percent: number, width: number): string {
	const filled = Math.round((percent / 100) * width);
	const empty = width - filled;
	return "█".repeat(filled) + "░".repeat(empty);
}

// ============================================================================
// Core Renderers
// ============================================================================

/**
 * Render a compact progress bar for the footer.
 * Returns 1-3 lines for the footer/status area.
 */
export function renderAdaptiveProgress(data: AdaptiveProgressData, terminalWidth: number): string[] {
	const lines: string[] = [];
	const width = Math.max(20, terminalWidth);

	if (data.todos.length === 0) return lines;

	const completed = data.todos.filter((t) => t.status === "completed").length;
	const total = data.todos.filter((t) => t.status !== "cancelled").length;
	const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

	const phaseLabel = data.phase.charAt(0).toUpperCase() + data.phase.slice(1);
	const phaseColor = data.phase === "executing" ? "success" : data.phase === "blocked" ? "error" : "accent";
	const phaseLine = `${theme.fg(phaseColor, "◆")} ${theme.fg("muted", phaseLabel)}`;

	const barWidth = Math.min(30, Math.floor(width * 0.3));
	const bar = renderProgressBar(percent, barWidth);
	const percentStr = `${percent}%`;
	const progressLine = `${theme.fg("dim", "[")}${theme.fg(percent >= 100 ? "success" : percent >= 50 ? "accent" : "warning", bar)}${theme.fg("dim", "]")} ${theme.fg("dim", `${completed}/${total}`)} ${theme.fg("dim", percentStr)}`;

	const currentTask = data.todos.find((t) => t.status === "in_progress");
	if (currentTask) {
		const elapsed = getElapsedMs(currentTask);
		const desc = currentTask.description;
		const maxDescWidth = width - 16;
		const truncated = truncateToWidth(desc, maxDescWidth, "…");
		const timeStr = formatDuration(elapsed);
		lines.push(phaseLine);
		lines.push(progressLine);
		lines.push(`  ${theme.fg("accent", "→")} ${theme.fg("text", truncated)} ${theme.fg("dim", `(${timeStr})`)}`);
	} else if (completed === total && total > 0) {
		lines.push(phaseLine);
		lines.push(progressLine);
	} else {
		lines.push(phaseLine);
		lines.push(progressLine);
	}

	return lines;
}

/**
 * Render a detailed TODO list for the interactive panel.
 * Shows all items with status, priority, evidence, and timing.
 */
export function renderTodoListPanel(todos: AdaptiveTodoItem[], terminalWidth: number): string[] {
	const lines: string[] = [];
	const width = Math.max(30, terminalWidth);

	lines.push(theme.fg("accent", "─".repeat(width)));
	lines.push(`${theme.fg("accent", "◆")} ${theme.fg("text", "Adaptive TODO List")}`);
	lines.push(theme.fg("accent", "─".repeat(width)));

	if (todos.length === 0) {
		lines.push(`  ${theme.fg("dim", "No active tasks")}`);
		lines.push(theme.fg("accent", "─".repeat(width)));
		return lines;
	}

	const statusOrder: Array<AdaptiveTodoItem["status"]> = [
		"in_progress",
		"pending",
		"blocked",
		"completed",
		"cancelled",
	];

	for (const status of statusOrder) {
		const items = todos.filter((t) => t.status === status);
		if (items.length === 0) continue;

		const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
		lines.push(`  ${theme.fg("dim", `── ${statusLabel} ──`)}`);

		for (const item of items) {
			const icon = STATUS_ICONS[item.status] || "?";
			const color = (STATUS_COLORS[item.status] || "dim") as ThemeColor;
			const priorityBadge = PRIORITY_ICONS[item.priority] || "";
			const priorityColor = (PRIORITY_COLORS[item.priority] || "dim") as ThemeColor;
			const elapsed = getElapsedMs(item);
			const timeStr = formatDuration(elapsed);
			const descWidth = width - 18 - priorityBadge.length;
			const desc = truncateToWidth(item.description, descWidth, "…");
			lines.push(
				`    ${theme.fg(color, icon)} ${theme.fg("text", desc)}${priorityBadge ? ` ${theme.fg(priorityColor, priorityBadge)}` : ""} ${theme.fg("dim", timeStr)}`,
			);

			if (item.failureReason) {
				lines.push(`      ${theme.fg("error", item.failureReason)}`);
			}
			if (item.completionEvidence.length > 0) {
				const lastEvidence = item.completionEvidence[item.completionEvidence.length - 1];
				const evidenceWidth = width - 12;
				const evidence = truncateToWidth(lastEvidence, evidenceWidth, "…");
				lines.push(`      ${theme.fg("dim", `✓ ${evidence}`)}`);
			}
			if (item.dependencies.length > 0) {
				lines.push(`      ${theme.fg("dim", `deps: ${item.dependencies.join(", ")}`)}`);
			}
		}
	}

	lines.push(theme.fg("accent", "─".repeat(width)));
	return lines;
}

/**
 * Render a compact inline status for the footer.
 * Single line: ◆ Planning • [████░░░░] 2/4 50%
 */
export function renderInlineProgress(data: AdaptiveProgressData, terminalWidth: number): string {
	if (data.todos.length === 0) return "";

	const completed = data.todos.filter((t) => t.status === "completed").length;
	const total = data.todos.filter((t) => t.status !== "cancelled").length;
	const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

	const phaseLabel = data.phase.charAt(0).toUpperCase() + data.phase.slice(1);
	const phaseColor = data.phase === "executing" ? "success" : data.phase === "blocked" ? "error" : "accent";

	const barWidth = Math.min(12, Math.floor(terminalWidth * 0.1));
	const bar = renderProgressBar(percent, barWidth);

	return `${theme.fg(phaseColor, "◆")} ${theme.fg("muted", phaseLabel)} • ${theme.fg("dim", "[")}${theme.fg(percent >= 100 ? "success" : "accent", bar)}${theme.fg("dim", "]")} ${completed}/${total}`;
}

// ============================================================================
// Dependency Graph Visualization
// ============================================================================

/**
 * Render a dependency graph showing task relationships.
 * Uses ASCII art to show dependency chains.
 */
export function renderDependencyGraph(todos: AdaptiveTodoItem[], terminalWidth: number): string[] {
	const lines: string[] = [];
	const width = Math.max(30, terminalWidth);

	lines.push(theme.fg("accent", "─".repeat(width)));
	lines.push(`${theme.fg("accent", "◆")} ${theme.fg("text", "Dependency Graph")}`);
	lines.push(theme.fg("accent", "─".repeat(width)));

	if (todos.length === 0) {
		lines.push(`  ${theme.fg("dim", "No tasks")}`);
		lines.push(theme.fg("accent", "─".repeat(width)));
		return lines;
	}

	const itemMap = new Map(todos.map((t) => [t.id, t]));
	const roots = todos.filter((t) => t.dependencies.length === 0 || !t.dependencies.some((d: string) => itemMap.has(d)));

	if (roots.length === 0) {
		for (const item of todos) {
			const icon = STATUS_ICONS[item.status] || "?";
			const color = (STATUS_COLORS[item.status] || "dim") as ThemeColor;
			const desc = truncateToWidth(item.description, width - 10, "…");
			lines.push(`  ${theme.fg(color, icon)} ${theme.fg("text", desc)}`);
		}
	} else {
		const visited = new Set<string>();
		const renderNode = (itemId: string, prefix: string, isLast: boolean) => {
			const item = itemMap.get(itemId);
			if (!item || visited.has(itemId)) return;
			visited.add(itemId);

			const connector = isLast ? "└── " : "├── ";
			const icon = STATUS_ICONS[item.status] || "?";
			const color = (STATUS_COLORS[item.status] || "dim") as ThemeColor;
			const desc = truncateToWidth(item.description, width - prefix.length - 10, "…");
			lines.push(`  ${prefix}${connector}${theme.fg(color, icon)} ${theme.fg("text", desc)}`);

			const children = todos.filter((t) => t.dependencies.includes(itemId));
			const childPrefix = prefix + (isLast ? "    " : "│   ");
			for (let i = 0; i < children.length; i++) {
				renderNode(children[i].id, childPrefix, i === children.length - 1);
			}
		};

		for (let i = 0; i < roots.length; i++) {
			renderNode(roots[i].id, "", i === roots.length - 1);
		}

		for (const item of todos) {
			if (!visited.has(item.id)) {
				const icon = STATUS_ICONS[item.status] || "?";
				const color = (STATUS_COLORS[item.status] || "dim") as ThemeColor;
				const desc = truncateToWidth(item.description, width - 10, "…");
				lines.push(`  ${theme.fg(color, icon)} ${theme.fg("text", desc)} ${theme.fg("dim", "(orphan)")}`);
			}
		}
	}

	lines.push(theme.fg("accent", "─".repeat(width)));
	return lines;
}

// ============================================================================
// Stats Dashboard
// ============================================================================

function renderMiniBar(value: number, max: number, width: number): string {
	const filled = max > 0 ? Math.round((value / max) * width) : 0;
	return "█".repeat(filled) + "░".repeat(width - filled);
}

/**
 * Render a stats dashboard with completion metrics.
 */
export function renderStatsDashboard(stats: AdaptiveTodoStats, terminalWidth: number): string[] {
	const lines: string[] = [];
	const width = Math.max(30, terminalWidth);

	lines.push(theme.fg("accent", "─".repeat(width)));
	lines.push(`${theme.fg("accent", "◆")} ${theme.fg("text", "Statistics Dashboard")}`);
	lines.push(theme.fg("accent", "─".repeat(width)));

	const barWidth = Math.min(20, Math.floor(width * 0.25));

	lines.push(`  ${theme.fg("dim", "Tasks:")} ${theme.fg("text", `${stats.totalTasks} total`)}`);
	lines.push(
		`  ${theme.fg("dim", "Done:")}  ${theme.fg("success", `${stats.completedTasks}`)} ${theme.fg("dim", "/")} ${theme.fg("dim", `${stats.totalTasks}`)} ${theme.fg("dim", `(${stats.completionRate}%)`)}`,
	);
	const completionBar = renderProgressBar(stats.completionRate, barWidth);
	lines.push(`  ${theme.fg("dim", "[")}${theme.fg("success", completionBar)}${theme.fg("dim", "]")}`);

	lines.push("");
	lines.push(`  ${theme.fg("dim", "Status Breakdown:")}`);
	const statuses: Array<{ label: string; count: number; color: ThemeColor }> = [
		{ label: "In Progress", count: stats.inProgressTasks, color: "accent" },
		{ label: "Pending", count: stats.pendingTasks, color: "dim" },
		{ label: "Blocked", count: stats.blockedTasks, color: "error" },
		{ label: "Completed", count: stats.completedTasks, color: "success" },
		{ label: "Cancelled", count: stats.cancelledTasks, color: "muted" },
	];
	const maxStatus = Math.max(...statuses.map((s) => s.count), 1);
	for (const s of statuses) {
		const bar = renderMiniBar(s.count, maxStatus, barWidth);
		lines.push(
			`    ${theme.fg(s.color, truncateToWidth(s.label, 12, "…"))} ${theme.fg("dim", "[")}${theme.fg(s.color, bar)}${theme.fg("dim", "]")} ${theme.fg("dim", `${s.count}`)}`,
		);
	}

	lines.push("");
	lines.push(`  ${theme.fg("dim", "Timing:")}`);
	if (stats.avgCompletionTimeMs > 0) {
		lines.push(
			`    ${theme.fg("dim", "Avg completion:")} ${theme.fg("text", formatDuration(stats.avgCompletionTimeMs))}`,
		);
	}
	lines.push(`    ${theme.fg("dim", "Total elapsed:")} ${theme.fg("text", formatDuration(stats.totalElapsedMs))}`);

	const priorityEntries = Object.entries(stats.byPriority).filter(([, count]: [string, number]) => count > 0);
	if (priorityEntries.length > 0) {
		lines.push("");
		lines.push(`  ${theme.fg("dim", "Priority:")}`);
		for (const [priority, count] of priorityEntries) {
			const pColor = (PRIORITY_COLORS[priority] || "dim") as ThemeColor;
			const pIcon = PRIORITY_ICONS[priority] || "";
			lines.push(`    ${theme.fg(pColor, `${pIcon} ${priority}`)} ${theme.fg("dim", `${count}`)}`);
		}
	}

	lines.push(theme.fg("accent", "─".repeat(width)));
	return lines;
}

// ============================================================================
// Timeline View
// ============================================================================

/**
 * Render a mini timeline showing task progression over time.
 */
export function renderTimeline(todos: AdaptiveTodoItem[], terminalWidth: number): string[] {
	const lines: string[] = [];
	const width = Math.max(30, terminalWidth);

	lines.push(theme.fg("accent", "─".repeat(width)));
	lines.push(`${theme.fg("accent", "◆")} ${theme.fg("text", "Timeline")}`);
	lines.push(theme.fg("accent", "─".repeat(width)));

	const sorted = [...todos].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

	if (sorted.length === 0) {
		lines.push(`  ${theme.fg("dim", "No tasks")}`);
		lines.push(theme.fg("accent", "─".repeat(width)));
		return lines;
	}

	const firstTime = new Date(sorted[0].createdAt).getTime();
	const lastTime = sorted[sorted.length - 1].completedAt
		? new Date(sorted[sorted.length - 1].completedAt!).getTime()
		: Date.now();
	const totalSpan = Math.max(lastTime - firstTime, 1);
	const timelineWidth = Math.min(width - 8, 40);

	for (const item of sorted) {
		const icon = STATUS_ICONS[item.status] || "?";
		const color = (STATUS_COLORS[item.status] || "dim") as ThemeColor;
		const startOffset = new Date(item.createdAt).getTime() - firstTime;
		const startPos = Math.floor((startOffset / totalSpan) * timelineWidth);
		const elapsed = getElapsedMs(item);
		const endPos = item.completedAt
			? Math.floor(((new Date(item.completedAt).getTime() - firstTime) / totalSpan) * timelineWidth)
			: Math.floor(((Date.now() - firstTime) / totalSpan) * timelineWidth);

		const barLen = Math.max(1, endPos - startPos);
		const barStart = "·".repeat(Math.max(0, startPos));
		const bar = "━".repeat(barLen);
		const barEnd = "·".repeat(Math.max(0, timelineWidth - endPos));

		const desc = truncateToWidth(item.description, width - timelineWidth - 14, "…");
		const timeStr = formatDuration(elapsed);
		lines.push(
			`  ${theme.fg(color, icon)} ${theme.fg("dim", barStart)}${theme.fg(color, bar)}${theme.fg("dim", barEnd)} ${theme.fg("text", desc)} ${theme.fg("dim", timeStr)}`,
		);
	}

	lines.push(theme.fg("accent", "─".repeat(width)));
	return lines;
}
