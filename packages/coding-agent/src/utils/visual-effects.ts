/**
 * Visual enhancement utilities for AIRIS CLI.
 *
 * Provides rich terminal output: spinners, progress bars, gradient text,
 * dashboard cards, colorful tables, statistics, motivational messages,
 * developer tips, AIRIS facts, and status indicators.
 *
 * Respects NO_COLOR, NO_ANIMATION, and LOW_RESOURCE environment variables.
 */

import type { ChalkInstance } from "chalk";
import chalk from "chalk";
import { stripAnsi } from "./ansi.ts";
import { sleep } from "./sleep.ts";

// ============================================================================
// Environment / Mode Detection
// ============================================================================

/** Whether the terminal has NO_COLOR set (no color output). */
export function isNoColor(): boolean {
	return !!process.env.NO_COLOR || process.argv.includes("--no-color") || process.argv.includes("--no-colors");
}

/** Whether animations are disabled. */
export function isNoAnimation(): boolean {
	return !!process.env.NO_ANIMATION || process.argv.includes("--no-animation") || isNoColor();
}

/** Whether the user wants low-resource mode (Termux, mobile, etc.). */
export function isLowResource(): boolean {
	return (
		!!process.env.LOW_RESOURCE ||
		!!process.env.TERMUX_VERSION ||
		process.argv.includes("--low-resource") ||
		process.argv.includes("--low-resources")
	);
}

/** Whether animations should be displayed (respects all constraints). */
export function animationsEnabled(): boolean {
	return !isNoAnimation() && !isLowResource();
}

/** Whether to use compact output mode. */
export function isCompactMode(): boolean {
	return isLowResource() || process.argv.includes("--compact");
}

/** Whether to use full output mode (default, opposite of compact). */
export function isFullMode(): boolean {
	return !isCompactMode();
}

// ============================================================================
// Color Shorthand Helpers
// ============================================================================

/** Color helper: green text for success states. */
export const cSuccess = (text: string): string => chalk.green(text);
/** Color helper: red text for error states. */
export const cError = (text: string): string => chalk.red(text);
/** Color helper: yellow text for warning states. */
export const cWarn = (text: string): string => chalk.yellow(text);
/** Color helper: blue text for informational states. */
export const cInfo = (text: string): string => chalk.blue(text);
/** Color helper: cyan text for accent/highlights. */
export const cAccent = (text: string): string => chalk.cyan(text);
/** Color helper: dim/gray text for secondary content. */
export const cDim = (text: string): string => chalk.dim(text);
/** Color helper: bold text. */
export const cBold = (text: string): string => chalk.bold(text);
/** Color helper: magenta text for highlights. */
export const cMagenta = (text: string): string => chalk.magenta(text);

// ============================================================================
// Status Indicators
// ============================================================================

export interface IndicatorOptions {
	/** Color (default: based on kind) */
	color?: boolean;
	/** Padding after the indicator */
	padding?: number;
}

/** Rich status indicator: colored icon + label + message. */
export function indicator(
	kind: "success" | "warning" | "error" | "info" | "running" | "done" | "pending",
	message: string,
	options?: IndicatorOptions,
): string {
	if (isNoColor()) {
		const labels: Record<string, string> = {
			success: "[OK]",
			warning: "[WARN]",
			error: "[ERR]",
			info: "[INFO]",
			running: "[RUN]",
			done: "[DONE]",
			pending: "[...]",
		};
		const icon = labels[kind] ?? `[${kind.toUpperCase()}]`;
		return `${icon} ${message}`;
	}

	const icons: Record<string, string> = {
		success: "\u2713",
		warning: "\u26A0",
		error: "\u2717",
		info: "\u2139",
		running: "\u27F3",
		done: "\u2713",
		pending: "\u25CB",
	};
	const colors: Record<string, ChalkInstance> = {
		success: chalk.green,
		warning: chalk.yellow,
		error: chalk.red,
		info: chalk.blue,
		running: chalk.cyan,
		done: chalk.green,
		pending: chalk.dim,
	};
	const color = colors[kind] ?? chalk.dim;
	const icon = icons[kind] ?? "?";

	if (options?.color === false) {
		return `${icon} [${kind.toUpperCase()}] ${message}`;
	}

	return `${color(`${icon}`)} ${color.dim(`[${kind.toUpperCase()}]`)} ${message}`;
}

/** Shorthand for success indicator. */
export const success = (msg: string): string => indicator("success", msg);
/** Shorthand for warning indicator. */
export const warning = (msg: string): string => indicator("warning", msg);
/** Shorthand for error indicator. */
export const error = (msg: string): string => indicator("error", msg);
/** Shorthand for info indicator. */
export const info = (msg: string): string => indicator("info", msg);
/** Shorthand for running indicator. */
export const running = (msg: string): string => indicator("running", msg);
/** Shorthand for done indicator. */
export const done = (msg: string): string => indicator("done", msg);
/** Shorthand for pending indicator. */
export const pending = (msg: string): string => indicator("pending", msg);

// ============================================================================
// Progress Bar
// ============================================================================

/**
 * Render a text-based progress bar.
 *
 * @param current - Current value
 * @param total - Total value (0 for indeterminate)
 * @param width - Width of the bar in characters
 * @returns Formatted progress bar string
 */
export function progressBar(current: number, total: number, width = 30): string {
	if (isNoColor()) {
		const pct = total > 0 ? Math.round((current / total) * 100) : 0;
		const filled = total > 0 ? Math.round((current / total) * width) : 0;
		const empty = width - filled;
		return `[${"=".repeat(Math.max(0, filled))}${"-".repeat(Math.max(0, empty))}] ${pct}%`;
	}

	const pct = total > 0 ? Math.round((current / total) * 100) : 0;

	if (total <= 0) {
		// Indeterminate
		return chalk.cyan(`[${"\u2592".repeat(width)}] ${chalk.dim("...")}`);
	}

	const filled = Math.round((current / total) * width);
	const empty = width - filled;

	const filledColor = pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.cyan;
	const bar = `${filledColor("\u2588".repeat(Math.max(0, filled)))}${chalk.dim("\u2591".repeat(Math.max(0, empty)))}`;
	const pctStr = pct >= 100 ? chalk.green(`${pct}%`) : chalk.cyan(`${pct}%`);

	return `${bar} ${pctStr}`;
}

// ============================================================================
// Spinner / Animated Loading
// ============================================================================

const SPINNER_FRAMES = [
	"\u280B",
	"\u2819",
	"\u2839",
	"\u2838",
	"\u283C",
	"\u2834",
	"\u2826",
	"\u2827",
	"\u2807",
	"\u280F",
];
const SPINNER_FRAMES_SIMPLE = ["-", "\\", "|", "/"];

/**
 * Create a spinner renderer. Returns a function that advances the spinner
 * and returns the current frame as a string with optional message.
 */
export function createSpinner(message?: string): {
	next: () => string;
	reset: () => void;
} {
	let frame = 0;
	const frames = isNoColor() ? SPINNER_FRAMES_SIMPLE : SPINNER_FRAMES;

	return {
		next: () => {
			const f = frames[frame % frames.length];
			frame++;
			if (isNoColor()) {
				return `${f} ${message ?? ""}`;
			}
			return `${chalk.cyan(f)} ${message ?? ""}`;
		},
		reset: () => {
			frame = 0;
		},
	};
}

/**
 * Wrap a promise with an animated spinner that writes to stderr.
 * Falls back silently if animations are disabled or stderr isn't a TTY.
 */
export async function withSpinner<T>(promise: Promise<T>, message: string, doneMessage?: string): Promise<T> {
	if (!animationsEnabled() || !process.stderr.isTTY) {
		return promise;
	}

	const spinner = createSpinner(message);
	const interval = setInterval(() => {
		process.stderr.write(`\r${spinner.next()}`);
	}, 100);

	try {
		const result = await promise;
		clearInterval(interval);
		if (doneMessage) {
			process.stderr.write(`\r${success(doneMessage)}\n`);
		} else {
			process.stderr.write(`\r${" ".repeat(40)}\r`);
		}
		return result;
	} catch (err) {
		clearInterval(interval);
		process.stderr.write(`\r${chalk.red("Failed")}\n`);
		throw err;
	}
}

// ============================================================================
// Gradient / ASCII Art
// ============================================================================

/**
 * Apply a simple two-color gradient effect to text.
 * Falls back to a single color when animations are disabled.
 */
export function gradientText(
	text: string,
	startColor: ChalkInstance = chalk.cyan,
	endColor: ChalkInstance = chalk.magenta,
): string {
	if (isNoColor() || text.length <= 1) {
		return text;
	}

	// Simple two-tone split
	const mid = Math.floor(text.length / 2);
	const first = startColor(text.slice(0, mid));
	const second = endColor(text.slice(mid));
	return first + second;
}

/**
 * Render an ASCII banner with consistent styling.
 */
export function asciiBanner(lines: readonly string[], accent = true): string {
	if (isNoColor()) {
		return lines.join("\n");
	}
	return lines
		.map((line) => {
			if (accent) return chalk.cyan(line);
			return chalk.dim(line);
		})
		.join("\n");
}

// ============================================================================
// Dashboard / Card
// ============================================================================

export interface DashboardItem {
	label: string;
	value: string;
	color?: ChalkInstance;
}

/**
 * Render a statistics card with a title and key-value items.
 */
export function dashboardCard(title: string, items: DashboardItem[], width?: number): string {
	const termWidth = width ?? process.stdout.columns ?? 80;
	const cardWidth = Math.min(termWidth - 2, 78);
	const innerWidth = cardWidth - 2;

	if (isNoColor()) {
		const lines: string[] = [];
		lines.push(`${"=".repeat(cardWidth)}`);
		lines.push(`  ${title}`);
		lines.push(`${"=".repeat(cardWidth)}`);
		for (const item of items) {
			lines.push(`  ${item.label}: ${item.value}`);
		}
		lines.push(`${"=".repeat(cardWidth)}`);
		return lines.join("\n");
	}

	const lines: string[] = [];
	const borderColor = chalk.dim;
	const titleColor = chalk.bold.cyan;

	lines.push(`${borderColor("\u250C")}${borderColor("\u2500".repeat(innerWidth))}${borderColor("\u2510")}`);
	const _label = ` ${titleColor(title)} `;
	const padRight = innerWidth - title.length - 2;
	lines.push(
		`${borderColor("\u2502")}${" ".repeat(1)}${titleColor(title)}${" ".repeat(Math.max(1, padRight))}${borderColor("\u2502")}`,
	);
	lines.push(`${borderColor("\u251C")}${borderColor("\u2500".repeat(innerWidth))}${borderColor("\u2524")}`);

	for (const item of items) {
		const color = item.color ?? ((_s: string) => _s);
		const labelStr = chalk.dim(`${item.label}:`);
		const valueStr = color(item.value);
		const line = `  ${labelStr} ${valueStr}`;
		const truncated = line.length > innerWidth ? `${line.slice(0, innerWidth - 3)}...` : line;
		const padRight2 = Math.max(0, innerWidth - stripAnsi(truncated).length);
		lines.push(`${borderColor("\u2502")}${truncated}${" ".repeat(padRight2)}${borderColor("\u2502")}`);
	}

	lines.push(`${borderColor("\u2514")}${borderColor("\u2500".repeat(innerWidth))}${borderColor("\u2518")}`);
	return lines.join("\n");
}

// ============================================================================
// Colorful Table
// ============================================================================

export interface TableColumn {
	header: string;
	align?: "left" | "right" | "center";
	width?: number;
}

/**
 * Render a colorful, formatted table.
 */
export function colorfulTable(
	columns: TableColumn[],
	rows: readonly (readonly string[])[],
	options?: { title?: string },
): string {
	if (rows.length === 0) {
		return info("No data to display.");
	}

	const termWidth = process.stdout.columns ?? 80;
	const tableWidth = Math.min(termWidth - 2, 78);

	// Calculate column widths
	const colCount = columns.length;
	const headerWidths = columns.map((col) => col.header.length);
	const dataWidths = columns.map((_, colIdx) => Math.max(0, ...rows.map((row) => (row[colIdx] ?? "").length)));
	const widths = columns.map((col, i) => col.width ?? Math.max(headerWidths[i], dataWidths[i]) + 2);

	// Shrink columns if needed
	let totalWidth = widths.reduce((a, b) => a + b, 0) + colCount - 1;
	if (totalWidth > tableWidth) {
		const excess = totalWidth - tableWidth;
		// Shrink from widest columns first
		for (let i = 0; i < colCount && excess > 0; i++) {
			const maxShrink = widths[i] - 4;
			if (maxShrink > 0) {
				const shrink = Math.min(maxShrink, excess);
				widths[i] -= shrink;
				totalWidth -= shrink;
			}
		}
	}

	if (isNoColor()) {
		const lines: string[] = [];
		if (options?.title) {
			lines.push(`--- ${options.title} ---`);
		}
		const headerRow = columns.map((col, i) => col.header.padEnd(widths[i])).join(" | ");
		lines.push(headerRow);
		lines.push("-".repeat(headerRow.length));
		for (const row of rows) {
			const cells = row.map((cell, i) => cell.padEnd(widths[i]));
			lines.push(cells.join(" | "));
		}
		return lines.join("\n");
	}

	const lines: string[] = [];
	const borderColor = chalk.dim;
	const headerColor = chalk.bold.cyan;
	const separatorColor = chalk.dim;

	if (options?.title) {
		lines.push("");
		lines.push(`  ${chalk.bold(chalk.cyan(options.title))}`);
	}

	// Header
	const headerCells = columns
		.map((col, i) => {
			const h = col.header;
			const w = widths[i];
			return headerColor(h.padEnd(w));
		})
		.join(`${borderColor(" \u2502 ")}`);
	lines.push(`  ${headerCells}`);

	// Separator
	const sep = columns.map((_, i) => separatorColor("\u2500".repeat(widths[i]))).join(`${separatorColor("\u253C")}`);
	lines.push(`  ${sep}`);

	// Data rows
	for (const row of rows) {
		const cells = row.map((cell, i) => {
			const w = widths[i];
			const align = columns[i]?.align ?? "left";
			if (align === "right") return cell.padStart(w);
			if (align === "center") {
				const leftPad = Math.max(0, Math.floor((w - cell.length) / 2));
				return " ".repeat(leftPad) + cell + " ".repeat(w - cell.length - leftPad);
			}
			return cell.padEnd(w);
		});
		const coloredCells = cells.join(`${chalk.dim(" \u2502 ")}`);
		lines.push(`  ${coloredCells}`);
	}

	return lines.join("\n");
}

// ============================================================================
// Section Header / Divider
// ============================================================================

/**
 * Render a professional section header with decorative borders.
 */
export function sectionHeader(title: string, subtitle?: string): string {
	if (isNoColor()) {
		const s = `--- ${title} ---`;
		if (subtitle) return `${s}\n${subtitle}`;
		return s;
	}

	const termWidth = process.stdout.columns ?? 80;
	const width = Math.min(termWidth - 2, 78);
	const label = ` ${title.toUpperCase()} `;
	const leftWidth = Math.max(1, Math.floor((width - label.length) / 2));
	const rightWidth = width - leftWidth - label.length;

	const left = chalk.dim("\u2500".repeat(leftWidth));
	const right = chalk.dim("\u2500".repeat(rightWidth));
	const line = `${left}${chalk.bold(chalk.cyan(label))}${right}`;

	if (subtitle) {
		return `${line}\n${chalk.dim(`  ${subtitle}`)}`;
	}
	return line;
}

/**
 * Render a visual divider line.
 */
export function divider(char = "\u2500"): string {
	if (isNoColor()) {
		return "-".repeat(60);
	}
	const termWidth = process.stdout.columns ?? 80;
	const width = Math.min(termWidth - 2, 78);
	return chalk.dim(char.repeat(width));
}

// ============================================================================
// Completion Messages
// ============================================================================

/**
 * Render an enhanced completion message with styling.
 */
export function completionMessage(text: string, duration?: string): string {
	if (isNoColor()) {
		const dur = duration ? ` (${duration})` : "";
		return `Done: ${text}${dur}`;
	}

	const icon = chalk.green("\u2714");
	const dur = duration ? chalk.dim(` (${duration})`) : "";
	return `${icon} ${chalk.bold(text)}${dur}`;
}

// ============================================================================
// Random Messages (Motivational, Tips, Facts)
// ============================================================================

const MOTIVATIONAL_MESSAGES: readonly string[] = [
	"Every line of code brings you closer to mastery.",
	"The best error message is the one you fix on the first try.",
	"AI is a tool; your creativity is the true engine.",
	"Clean code is not just for the machine — it's for the human reading it.",
	"Some bugs are just features waiting to be discovered.",
	"The terminal is your canvas; paint boldly.",
	"Great developers aren't born — they iterate.",
	"Every expert was once a beginner who didn't give up.",
	"Code is poetry compiled into action.",
	"Simplify. Optimize. Ship. Repeat.",
	"The command line is where the magic happens.",
	"Your next breakthrough is one keystroke away.",
	"Patience and persistence turn complex into simple.",
	"Write code as if the next person is a genius.",
	"Debugging is the art of finding beauty in broken things.",
];

const DEVELOPER_TIPS: readonly string[] = [
	"Tip: Use Ctrl+R in the terminal for reverse search through command history.",
	"Tip: Add --help to any command to see available options.",
	"Tip: You can chain commands with && to run them sequentially.",
	"Tip: Use Ctrl+L to clear the terminal screen.",
	"Tip: Tab completion saves keystrokes — use it liberally.",
	"Tip: Use .env.local for local-only configuration that never gets committed.",
	"Tip: Use the -p flag to run AIRIS in one-shot prompt mode.",
	"Tip: Ctrl+P cycles between models in interactive mode.",
	"Tip: Use /plan mode to break down complex tasks before executing.",
	"Tip: The @file syntax lets you include files in your prompt.",
	"Tip: Use --approve to bypass project trust prompts for automation.",
	"Tip: Session files are saved as JSONL — inspectable and portable.",
	"Tip: Run `airis doctor` to check your runtime health.",
	"Tip: Use `airis session list` to find and resume previous sessions.",
	"Tip: The --no-tools flag gives you a pure chat experience.",
];

const AIRIS_FACTS: readonly string[] = [
	"AIRIS stands for Artificial Intelligence Responsive Integrated System.",
	"AIRIS is created by Umaiz Sufiyan under the KageOS brand.",
	"AIRIS supports multiple AI providers: Google, OpenAI, Anthropic, Groq, and more.",
	"AIRIS sessions are stored in portable JSONL format.",
	"AIRIS has a built-in verified autonomy system with mission contracts.",
	"AIRIS supports the Ship workflow: request, plan, implement, verify.",
	"AIRIS can be installed via npm, bun, or built from source.",
	"AIRIS includes Android automation via ADB bridging.",
	"AIRIS has an extension system for custom tools and UI components.",
	"AIRIS supports local image generation with Stable Diffusion models.",
	"AIRIS themes are customizable via JSON color token files.",
	"AIRIS can run in interactive, print, JSON, or RPC mode.",
	"AIRIS supports vision (image understanding) with compatible models.",
	"AIRIS has built-in syntax highlighting for over 40 languages.",
	"AIRIS works on macOS, Linux, Windows, and Termux (Android).",
];

let tipIndex = 0;

/** Get a random motivational message. */
export function randomMotivationalMessage(): string {
	const idx = Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length);
	const msg = MOTIVATIONAL_MESSAGES[idx];
	return isNoColor() ? msg : chalk.dim.italic(msg);
}

/** Get a cycling developer tip. */
export function randomDeveloperTip(): string {
	tipIndex = (tipIndex + 1) % DEVELOPER_TIPS.length;
	const msg = DEVELOPER_TIPS[tipIndex];
	return isNoColor() ? msg : chalk.dim(msg);
}

/** Get a random AIRIS fact. */
export function randomAirisFact(): string {
	const idx = Math.floor(Math.random() * AIRIS_FACTS.length);
	const msg = AIRIS_FACTS[idx];
	return isNoColor() ? msg : chalk.cyan(msg);
}

// ============================================================================
// ASCII Animation / Loading Screen
// ============================================================================

const _LOADING_FRAMES = [
	`${chalk.cyan("\u25E0")}${chalk.dim("\u25E3\u25E3\u25E3\u25E3")}`,
	`${chalk.dim("\u25E2")}${chalk.cyan("\u25E0")}${chalk.dim("\u25E3\u25E3\u25E3")}`,
	`${chalk.dim("\u25E2\u25E2")}${chalk.cyan("\u25E0")}${chalk.dim("\u25E3\u25E3")}`,
	`${chalk.dim("\u25E2\u25E2\u25E2")}${chalk.cyan("\u25E0")}${chalk.dim("\u25E3")}`,
	`${chalk.dim("\u25E2\u25E2\u25E2\u25E2")}${chalk.cyan("\u25E0")}`,
	`${chalk.dim("\u25E2\u25E2\u25E2\u25E2")}${chalk.dim("\u25E2")}`,
	`${chalk.dim("\u25E2\u25E2\u25E2")}${chalk.cyan("\u25E3")}${chalk.dim("\u25E3")}`,
	`${chalk.dim("\u25E2\u25E2")}${chalk.cyan("\u25E3\u25E3")}${chalk.dim("\u25E3")}`,
	`${chalk.dim("\u25E2")}${chalk.cyan("\u25E3\u25E3\u25E3")}${chalk.dim("\u25E3")}`,
	`${chalk.cyan("\u25E3\u25E3\u25E3\u25E3")}${chalk.dim("\u25E0")}`,
];

/**
 * Display a brief animated loading sequence with message and optional
 * details shown below. Writes to stderr. Does nothing if animations disabled.
 */
export async function showLoadingAnimation(
	message: string,
	{
		frames = 5,
		interval = 80,
		detail,
	}: {
		frames?: number;
		interval?: number;
		detail?: string;
	} = {},
): Promise<void> {
	if (!animationsEnabled() || !process.stderr.isTTY) {
		return;
	}

	const spinner = createSpinner(message);
	for (let i = 0; i < frames; i++) {
		process.stderr.write(`\r${spinner.next()}`);
		await sleep(interval);
	}

	if (detail) {
		process.stderr.write(`\r${info(detail)}\n`);
	} else {
		process.stderr.write(`\r${" ".repeat(40)}\r`);
	}
}

/**
 * Show a simple indeterminate progress bar animation on stderr.
 * Clears itself after done.
 */
export async function showIndeterminateBar(message: string, stopSignal: Promise<void>): Promise<void> {
	if (!animationsEnabled() || !process.stderr.isTTY) {
		await stopSignal;
		return;
	}

	const width = 20;
	const chars = ["\u258F", "\u258E", "\u258D", "\u258C", "\u258B", "\u258A", "\u2589", "\u2588"];
	let i = 0;

	const clear = () => {
		process.stderr.write("\r".repeat(stripAnsi(message).length + width + 5));
	};

	const render = () => {
		const pos = i % (width * 2);
		const bar: string[] = [];
		for (let x = 0; x < width; x++) {
			const dist = Math.abs(pos - x);
			const c = dist < chars.length ? chars[dist] : " ";
			bar.push(chalk.cyan(c));
		}
		process.stderr.write(`\r${chalk.dim(message)} ${bar.join("")}`);
		i++;
	};

	const interval = setInterval(render, 100);

	try {
		await stopSignal;
	} finally {
		clearInterval(interval);
		clear();
	}
}

// ============================================================================
// Compact / Full mode wrappers
// ============================================================================

/**
 * In compact mode, return a short summary line instead of a full block.
 * In full mode, return the full content.
 */
export function compactOrFull(compactText: string, fullText: string): string {
	return isCompactMode() ? compactText : fullText;
}

// ============================================================================
// Startup Splash
// ============================================================================

const AIRIS_LOGO_COLOR: readonly string[] = [
	"█████╗ ██╗██████╗ ██╗███████╗",
	"██╔══██╗██║██╔══██╗██║██╔════╝",
	"███████║██║██████╔╝██║███████╗",
	"██╔══██║██║██╔══██╗██║╚════██║",
	"██║  ██║██║██║  ██║██║███████║",
	"╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝╚══════╝",
];

/**
 * Render the AIRIS startup splash screen.
 */
export function startupSplash(version: string): string {
	if (isNoColor()) {
		return `AIRIS CLI v${version}`;
	}

	const lines: string[] = [];
	lines.push("");
	lines.push(chalk.cyan(AIRIS_LOGO_COLOR.join("\n")));
	lines.push(chalk.dim("Artificial Intelligence Responsive Integrated System"));
	lines.push(chalk.dim(`v${version} \u2022 KageOS \u2022 Umaiz Sufiyan`));
	lines.push("");
	return lines.join("\n");
}
