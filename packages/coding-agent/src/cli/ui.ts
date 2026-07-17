import { visibleWidth } from "@sufiyan-sabeel/airis-tui";
import chalk from "chalk";

const DEFAULT_WIDTH = 80;
const MIN_CONTENT_WIDTH = 36;
const MAX_CONTENT_WIDTH = 76;

type StatusKind = "ok" | "warn" | "error" | "info" | "running" | "done";

const STATUS_ICONS: Record<StatusKind, string> = {
	ok: "✓",
	warn: "⚠",
	error: "✗",
	info: "ℹ",
	running: "⟳",
	done: "✓",
};

const STATUS_LABELS: Record<StatusKind, string> = {
	ok: "OK",
	warn: "WARN",
	error: "ERR",
	info: "INFO",
	running: "RUN",
	done: "DONE",
};

function getOutputWidth(): number {
	const columns = process.stdout.columns ?? DEFAULT_WIDTH;
	return Math.max(MIN_CONTENT_WIDTH, Math.min(MAX_CONTENT_WIDTH, columns - 2));
}

function colorStatus(kind: StatusKind, text: string): string {
	switch (kind) {
		case "ok":
		case "done":
			return chalk.green(text);
		case "warn":
			return chalk.yellow(text);
		case "error":
			return chalk.red(text);
		case "running":
			return chalk.cyan(text);
		case "info":
			return chalk.blue(text);
	}
}

/** Colored status badge with icon and label. */
export function status(kind: StatusKind, message: string): string {
	const icon = STATUS_ICONS[kind];
	const label = STATUS_LABELS[kind];
	return `${colorStatus(kind, `${icon} [${label}]`)} ${message}`;
}

/** Section header with decorative side borders. */
export function section(title: string): string {
	const line = chalk.dim("─".repeat(2));
	return `\n${line} ${chalk.bold(chalk.cyan(title))} ${line}`;
}

/** Key-value display with consistent alignment. */
export function keyValue(key: string, value: string, keyWidth = 16): string {
	return `${chalk.dim(key.padEnd(keyWidth))} ${value}`;
}

/** Colored box with title and content. */
export function box(title: string, lines: readonly string[]): string {
	const width = getOutputWidth();
	const label = ` ${title} `;
	const topFill = Math.max(1, width - label.length - 2);
	const top = `${chalk.cyan("┌")}${chalk.cyan(label)}${chalk.dim("─".repeat(topFill))}${chalk.cyan("┐")}`;
	const bottom = `${chalk.cyan("└")}${chalk.dim("─".repeat(width - 2))}${chalk.cyan("┘")}`;
	const content = lines.map(
		(line) => `${chalk.dim("│")} ${line}${" ".repeat(Math.max(0, width - 4 - visibleWidth(line)))} ${chalk.dim("│")}`,
	);
	return [top, ...content, bottom].join("\n");
}

/** Indented command hint with cyan command and dim description. */
export function commandHint(command: string, description: string): string {
	return `  ${chalk.cyan(command.padEnd(34))} ${chalk.dim(description)}`;
}

/** Bold, larger-style title for help output. */
export function title(text: string): string {
	return chalk.bold(chalk.cyan(text));
}

/** Accent-highlighted subtitle text. */
export function subtitle(text: string): string {
	return chalk.dim(text);
}

/** Inline label/value pair for help options. */
export function optionLine(flag: string, description: string): string {
	return `  ${chalk.cyan(flag.padEnd(30))} ${chalk.dim(description)}`;
}

/** Visual separator line. */
export function separator(width?: number): string {
	const w = width ?? getOutputWidth();
	return chalk.dim("─".repeat(Math.max(4, w - 2)));
}

// ============================================================================
// Enhanced Formatting Helpers (added without modifying existing functions)
// ============================================================================

/** Card-style box with a title and key-value pairs, no borders. */
export function statsCard(title: string, items: Array<{ label: string; value: string }>): string {
	const lines: string[] = [];
	lines.push(chalk.bold(chalk.cyan(`  ${title}`)));
	for (const item of items) {
		lines.push(`  ${chalk.dim(item.label.padEnd(16))} ${item.value}`);
	}
	return lines.join("\n");
}

/** Colorful table renderer with aligned columns. */
export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
	if (rows.length === 0) return "";
	const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
	const headerLine = headers.map((h, i) => chalk.cyan(chalk.bold(h.padEnd(widths[i])))).join(chalk.dim(" | "));
	const sep = widths.map((w) => chalk.dim("─".repeat(w))).join(chalk.dim("┼"));
	const dataLines = rows.map((row) => row.map((cell, i) => cell.padEnd(widths[i])).join(chalk.dim(" | ")));
	return [headerLine, sep, ...dataLines].join("\n");
}

/** Inline progress bar (text-based). */
export function progressBar(current: number, total: number, width = 20): string {
	const pct = total > 0 ? Math.round((current / total) * 100) : 0;
	const filled = total > 0 ? Math.round((current / total) * width) : 0;
	const empty = width - filled;
	const bar = `${chalk.green("█".repeat(Math.max(0, filled)))}${chalk.dim("░".repeat(Math.max(0, empty)))}`;
	const pctStr = pct >= 100 ? chalk.green(`${pct}%`) : chalk.cyan(`${pct}%`);
	return `${bar} ${pctStr}`;
}

/** Status badge with colored label and text. */
export function badge(kind: StatusKind, text: string): string {
	const label = STATUS_LABELS[kind];
	const colored = colorStatus(kind, label);
	return `${chalk.dim("[")}${colored}${chalk.dim("]")} ${text}`;
}

/** Completion message with checkmark. */
export function completionMessage(text: string, detail?: string): string {
	const check = chalk.green("✓");
	const detailStr = detail ? chalk.dim(` (${detail})`) : "";
	return `${check} ${chalk.bold(text)}${detailStr}`;
}

/** Warning message with icon. */
export function warningMessage(text: string, detail?: string): string {
	const icon = chalk.yellow("⚠");
	const detailStr = detail ? chalk.dim(`: ${detail}`) : "";
	return `${icon} ${chalk.yellow(text)}${detailStr}`;
}

/** Error message with icon. */
export function errorMessage(text: string, detail?: string): string {
	const icon = chalk.red("✗");
	const detailStr = detail ? chalk.dim(`: ${detail}`) : "";
	return `${icon} ${chalk.red(text)}${detailStr}`;
}

/** Info message with icon. */
export function infoMessage(text: string): string {
	const icon = chalk.blue("ℹ");
	return `${icon} ${chalk.blue(text)}`;
}

/** Header with full-width border. */
export function headerBlock(title: string): string {
	const w = getOutputWidth();
	const line = chalk.dim("═".repeat(w - 2));
	return `\n${line}\n ${chalk.bold(chalk.cyan(title))} \n${line}`;
}

/** Compact bullet list. */
export function bulletList(items: readonly string[]): string {
	return items.map((item) => `  ${chalk.cyan("•")} ${item}`).join("\n");
}

/** Key-value pair display, right-aligned value. */
export function kvRight(key: string, value: string, width = 60): string {
	const keyStr = chalk.dim(key);
	const padWidth = Math.max(1, width - key.length - value.length - 2);
	return `${keyStr}${" ".repeat(padWidth)}${value}`;
}
