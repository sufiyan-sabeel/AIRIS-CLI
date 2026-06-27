/**
 * Context Pressure Gauge Component
 *
 * Visual gauge showing context window usage with color coding.
 * Provides both inline and detailed views.
 */
import { theme } from "../theme/theme.ts";

export interface ContextGaugeData {
	percent: number;
	tokensUsed: number;
	tokensTotal: number;
	autoCompactEnabled: boolean;
	lastCompactionTime?: number;
}

/**
 * Render a visual pressure gauge.
 * [████████████░░░░░░░░] 60%
 */
export function renderContextGauge(data: ContextGaugeData, width: number): string {
	const barWidth = Math.min(20, Math.floor(width * 0.35));
	const filled = Math.round((data.percent / 100) * barWidth);
	const empty = barWidth - filled;

	// Color based on pressure
	let barColor: "success" | "warning" | "error";
	if (data.percent > 85) {
		barColor = "error";
	} else if (data.percent > 65) {
		barColor = "warning";
	} else {
		barColor = "success";
	}

	const bar = theme.fg(barColor, "█".repeat(filled)) + theme.fg("dim", "░".repeat(empty));
	const percentStr = `${data.percent.toFixed(1)}%`;
	const autoStr = data.autoCompactEnabled ? theme.fg("dim", " auto") : "";

	return `${theme.fg("dim", "[")}${bar}${theme.fg("dim", "]")} ${percentStr}${autoStr}`;
}

/**
 * Render a detailed context gauge panel.
 */
export function renderContextGaugePanel(data: ContextGaugeData, terminalWidth: number): string[] {
	const lines: string[] = [];
	const width = Math.max(30, terminalWidth);

	lines.push(theme.fg("accent", "─".repeat(width)));
	lines.push(`${theme.fg("accent", "◉")} ${theme.fg("text", "Context Window")}`);
	lines.push(theme.fg("accent", "─".repeat(width)));

	// Token counts
	const formatTokens = (n: number): string => {
		if (n < 1000) return String(n);
		if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
		return `${(n / 1000000).toFixed(1)}M`;
	};

	lines.push(`  ${theme.fg("dim", "Used:")} ${theme.fg("text", formatTokens(data.tokensUsed))}`);
	lines.push(`  ${theme.fg("dim", "Total:")} ${theme.fg("text", formatTokens(data.tokensTotal))}`);
	lines.push(`  ${theme.fg("dim", "Free:")} ${theme.fg("text", formatTokens(data.tokensTotal - data.tokensUsed))}`);
	lines.push("");

	// Visual gauge
	const barWidth = Math.min(40, Math.floor(width * 0.6));
	const filled = Math.round((data.percent / 100) * barWidth);
	const empty = barWidth - filled;

	let barColor: "success" | "warning" | "error";
	if (data.percent > 85) {
		barColor = "error";
	} else if (data.percent > 65) {
		barColor = "warning";
	} else {
		barColor = "success";
	}

	const bar = theme.fg(barColor, "█".repeat(filled)) + theme.fg("dim", "░".repeat(empty));
	const percentStr = `${data.percent.toFixed(1)}%`;
	lines.push(`  ${theme.fg("dim", "[")}${bar}${theme.fg("dim", "]")} ${percentStr}`);

	// Pressure indicator
	const pressure = data.percent > 85 ? "CRITICAL" : data.percent > 65 ? "HIGH" : data.percent > 40 ? "NORMAL" : "LOW";
	const pressureColor =
		data.percent > 85 ? "error" : data.percent > 65 ? "warning" : data.percent > 40 ? "text" : "dim";
	lines.push(`  ${theme.fg("dim", "Pressure:")} ${theme.fg(pressureColor, pressure)}`);

	// Auto-compact status
	const compactStatus = data.autoCompactEnabled ? theme.fg("success", "Enabled") : theme.fg("dim", "Disabled");
	lines.push(`  ${theme.fg("dim", "Auto-compact:")} ${compactStatus}`);

	if (data.lastCompactionTime) {
		const ago = Date.now() - data.lastCompactionTime;
		const agoStr = ago < 60000 ? `${Math.floor(ago / 1000)}s ago` : `${Math.floor(ago / 60000)}m ago`;
		lines.push(`  ${theme.fg("dim", "Last compact:")} ${theme.fg("dim", agoStr)}`);
	}

	lines.push(theme.fg("accent", "─".repeat(width)));
	return lines;
}

/**
 * Render a compact inline gauge for the footer.
 */
export function renderInlineGauge(data: ContextGaugeData, terminalWidth: number): string {
	const barWidth = Math.min(10, Math.floor(terminalWidth * 0.08));
	const filled = Math.round((data.percent / 100) * barWidth);
	const empty = barWidth - filled;

	let barColor: "success" | "warning" | "error";
	if (data.percent > 85) {
		barColor = "error";
	} else if (data.percent > 65) {
		barColor = "warning";
	} else {
		barColor = "success";
	}

	const bar = theme.fg(barColor, "█".repeat(filled)) + theme.fg("dim", "░".repeat(empty));
	const formatTokens = (n: number): string => {
		if (n < 1000) return String(n);
		if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
		return `${(n / 1000000).toFixed(1)}M`;
	};

	return `${theme.fg("dim", "[")}${bar}${theme.fg("dim", "]")} ${data.percent.toFixed(0)}% ${theme.fg("dim", formatTokens(data.tokensTotal))}`;
}
