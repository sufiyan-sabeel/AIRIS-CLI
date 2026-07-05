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
