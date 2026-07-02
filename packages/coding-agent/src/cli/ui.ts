import { visibleWidth } from "@sufiyan-sabeel/airis-tui";
import chalk from "chalk";

const DEFAULT_WIDTH = 80;
const MIN_CONTENT_WIDTH = 36;
const MAX_CONTENT_WIDTH = 76;

type StatusKind = "ok" | "warn" | "error" | "info" | "running" | "done";

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

export function status(kind: StatusKind, message: string): string {
	return `${colorStatus(kind, `[${STATUS_LABELS[kind]}]`)} ${message}`;
}

export function section(title: string): string {
	return chalk.bold(chalk.cyan(title));
}

export function keyValue(key: string, value: string, keyWidth = 16): string {
	return `${chalk.dim(key.padEnd(keyWidth))} ${value}`;
}

export function box(title: string, lines: readonly string[]): string {
	const width = getOutputWidth();
	const label = ` ${title} `;
	const topFill = Math.max(1, width - label.length - 2);
	const top = `${chalk.dim("+")}${chalk.cyan(label)}${chalk.dim(`${"-".repeat(topFill)}+`)}`;
	const bottom = chalk.dim(`+${"-".repeat(width - 2)}+`);
	const content = lines.map(
		(line) => `${chalk.dim("|")} ${line}${" ".repeat(Math.max(0, width - 4 - visibleWidth(line)))} ${chalk.dim("|")}`,
	);
	return [top, ...content, bottom].join("\n");
}

export function commandHint(command: string, description: string): string {
	return `  ${chalk.cyan(command.padEnd(34))} ${chalk.dim(description)}`;
}
