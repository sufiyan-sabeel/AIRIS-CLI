/**
 * Adaptive Brain Progress Widget
 *
 * Shows a compact progress indicator for the adaptive brain's TODO state.
 * Displays in the footer/status area without user interaction.
 */
import { truncateToWidth, visibleWidth } from "@earendil-works/airis-tui";
import { theme } from "../theme/theme.ts";

export interface AdaptiveTodoItem {
	id: string;
	description: string;
	status: "pending" | "in_progress" | "completed" | "blocked" | "cancelled";
	priority: string;
	completionEvidence: string[];
	failureReason?: string;
}

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

const STATUS_COLORS: Record<string, keyof ReturnType<typeof theme.fg>> = {
	completed: "success",
	in_progress: "accent",
	pending: "dim",
	blocked: "error",
	cancelled: "muted",
};

/**
 * Render a compact progress bar: [████████░░░░] 67%
 */
function renderProgressBar(percent: number, width: number): string {
	const filled = Math.round((percent / 100) * width);
	const empty = width - filled;
	const bar = "█".repeat(filled) + "░".repeat(empty);
	return bar;
}

/**
 * Render the adaptive brain progress widget.
 * Returns 1-3 lines for the footer/status area.
 */
export function renderAdaptiveProgress(data: AdaptiveProgressData, terminalWidth: number): string[] {
	const lines: string[] = [];
	const width = Math.max(20, terminalWidth);

	if (data.todos.length === 0) return lines;

	const completed = data.todos.filter((t) => t.status === "completed").length;
	const total = data.todos.filter((t) => t.status !== "cancelled").length;
	const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

	// Phase indicator
	const phaseLabel = data.phase.charAt(0).toUpperCase() + data.phase.slice(1);
	const phaseColor = data.phase === "executing" ? "success" : data.phase === "blocked" ? "error" : "accent";
	const phaseLine = `${theme.fg(phaseColor, "◆")} ${theme.fg("muted", phaseLabel)}`;

	// Progress bar
	const barWidth = Math.min(30, Math.floor(width * 0.3));
	const bar = renderProgressBar(percent, barWidth);
	const percentStr = `${percent}%`;
	const progressLine = `${theme.fg("dim", "[")}${theme.fg(percent >= 100 ? "success" : percent >= 50 ? "accent" : "warning", bar)}${theme.fg("dim", "]")} ${theme.fg("dim", `${completed}/${total}`)} ${theme.fg("dim", percentStr)}`;

	// Current task (if in progress)
	const currentTask = data.todos.find((t) => t.status === "in_progress");
	if (currentTask) {
		const desc = currentTask.description;
		const maxDescWidth = width - 8;
		const truncated = truncateToWidth(desc, maxDescWidth, "…");
		lines.push(phaseLine);
		lines.push(progressLine);
		lines.push(`  ${theme.fg("accent", "→")} ${theme.fg("text", truncated)}`);
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
 * Shows all items with status, priority, and evidence.
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

	// Group by status
	const statusOrder: Array<AdaptiveTodoItem["status"]> = ["in_progress", "pending", "blocked", "completed", "cancelled"];

	for (const status of statusOrder) {
		const items = todos.filter((t) => t.status === status);
		if (items.length === 0) continue;

		const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
		lines.push(`  ${theme.fg("dim", `── ${statusLabel} ──`)}`);

		for (const item of items) {
			const icon = STATUS_ICONS[item.status] || "?";
			const color = STATUS_COLORS[item.status] || "dim";
			const priorityBadge = item.priority === "high" || item.priority === "critical"
				? theme.fg("warning", " !")
				: "";
			const descWidth = width - 10 - priorityBadge.length;
			const desc = truncateToWidth(item.description, descWidth, "…");
			lines.push(`    ${theme.fg(color, icon)} ${theme.fg("text", desc)}${priorityBadge}`);

			if (item.failureReason) {
				lines.push(`      ${theme.fg("error", item.failureReason)}`);
			}
			if (item.completionEvidence.length > 0) {
				const lastEvidence = item.completionEvidence[item.completionEvidence.length - 1];
				const evidenceWidth = width - 12;
				const evidence = truncateToWidth(lastEvidence, evidenceWidth, "…");
				lines.push(`      ${theme.fg("dim", `✓ ${evidence}`)}`);
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
