import type { Component } from "@sufiyan-sabeel/airis-tui";
import { truncateToWidth, visibleWidth } from "@sufiyan-sabeel/airis-tui";
import type { Theme } from "../theme/theme.ts";
import { theme as _theme } from "../theme/theme.ts";

const theme = _theme as Theme;

export interface WelcomeHeaderInfo {
	model?: string;
	provider?: string;
	mode?: string;
	cwd?: string;
	version?: string;
}

const NO_COLOR = !!process.env.NO_COLOR;

const LOGO_LINES: readonly string[] = [
	"╭──────────────────────────────────╮",
	"│ ◆──────────────────────────────◆ │",
	"│ │ █████╗ ██╗██████╗ ██╗███████╗ │ │",
	"│ │██╔══██╗██║██╔══██╗██║██╔════╝ │ │",
	"│ │███████║██║██████╔╝██║███████╗ │ │",
	"│ │██╔══██║██║██╔══██║██║╚════██║ │ │",
	"│ │██║  ██║██║██║  ██║██║███████║ │ │",
	"│ │╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝╚══════╝ │ │",
	"│ ◆──────────────────────────────◆ │",
	"│ │                                │ │",
	"│ │    Artificial Intelligence     │ │",
	"│ │  Responsive Integrated System  │ │",
	"│ │                                │ │",
	"│ │   AI Coding · Automation · CLI │ │",
	"│ │      KageOS · Umaiz Sufiyan    │ │",
	"│ ◆──────────────────────────────◆ │",
	"╰──────────────────────────────────╯",
];

const LOGO_BLOCK_WIDTH = Math.max(...LOGO_LINES.map((line) => visibleWidth(line)));

function fg(color: Parameters<Theme["fg"]>[0], text: string): string {
	if (NO_COLOR) return text;
	return theme.fg(color, text);
}

function bold(text: string): string {
	if (NO_COLOR) return text;
	return theme.bold(text);
}

function padToWidth(text: string, width: number): string {
	const w = visibleWidth(text);
	if (w >= width) return text;
	return text + " ".repeat(width - w);
}

function truncateMiddle(path: string, maxLen: number): string {
	if (path.length <= maxLen) return path;
	const parts = path.split("/");
	if (parts.length <= 2) return path;
	return `${parts.slice(0, 2).join("/")}/.../${parts.slice(-1).join("/")}`;
}

const EMBLEM_MINIMAL: readonly string[] = ["       ╲   ╿   ╱", "    ━━━━╲  ◇  ╱━━━━", "       ╱   ╽   ╲"];

const EMBLEM_ASCII: readonly string[] = ["         \\   |   /", "       ===\\  <>  /===", "         /   |   \\"];

const NAME_MINIMAL = "AIRIS CLI";
const NAME_ASCII = "AIRIS CLI";
const TAGLINE_MINIMAL = "Multi-platform AI CLI";

// Keybinding hints shown at the bottom of the welcome banner
const KEYBINDING_HINTS: Array<{ keys: string; label: string }> = [
	{ keys: "Ctrl+P", label: "Plan mode" },
	{ keys: "Ctrl+Alt+P", label: "Toggle plan" },
	{ keys: "Ctrl+L", label: "Clear" },
	{ keys: "Ctrl+Up/Down", label: "Scroll" },
	{ keys: "Tab", label: "Complete" },
];

// Cycling tip messages
const WELCOME_TIPS: readonly string[] = [
	"Type your question or describe a task to get started.",
	"Use /plan to create a structured plan before executing.",
	"Use /ship for full workflow: request → plan → implement → verify.",
	"Use @coding to switch to repository coding mode.",
	"Use Ctrl+P in interactive mode to switch models.",
	"Use /mission for verified autonomy with contracts and evidence.",
];

let tipIndex = 0;
function nextTip(): string {
	tipIndex = (tipIndex + 1) % WELCOME_TIPS.length;
	return WELCOME_TIPS[tipIndex];
}
function currentTip(): string {
	return WELCOME_TIPS[tipIndex];
}
const WIDTH_LOGO = Math.max(LOGO_BLOCK_WIDTH + 4, 42);
const WIDTH_MINIMAL = 36;
const WIDTH_MINIMAL_TAGLINE = 40;

function selectVariant(width: number): { kind: "logo" | "minimal" | "ascii" } {
	if (width >= WIDTH_LOGO) {
		return { kind: "logo" };
	}
	if (width >= WIDTH_MINIMAL) {
		return { kind: "minimal" };
	}
	return { kind: "ascii" };
}

function fitContent(content: string, width: number): string {
	if (visibleWidth(content) <= width) return content;
	const truncated = truncateToWidth(content, width, "");
	return content.includes("\x1b") ? truncated : truncated.replace(/\x1b\[0m/g, "");
}

function renderPlainLine(content: string, width: number): string {
	return padToWidth(fitContent(content, width), width);
}

function renderBoxTop(width: number): string {
	const inner = width - 4;
	return padToWidth(fg("borderAccent", "╭") + fg("border", "─".repeat(inner)) + fg("borderAccent", "╮"), width);
}

function renderBoxBottom(width: number): string {
	const inner = width - 4;
	return padToWidth(fg("borderAccent", "╰") + fg("border", "─".repeat(inner)) + fg("borderAccent", "╯"), width);
}

function renderBoxLine(content: string, width: number): string {
	const inner = width - 4;
	const safeContent = fitContent(content, inner);
	const w = visibleWidth(safeContent);
	const pad = Math.floor((inner - w) / 2);
	const rightPad = inner - w - pad;
	return padToWidth(
		fg("border", "│") + " ".repeat(pad) + safeContent + " ".repeat(rightPad) + fg("border", "│"),
		width,
	);
}

function renderBoxBlockLine(content: string, width: number, blockWidth: number): string {
	const inner = width - 4;
	const targetWidth = Math.min(blockWidth, inner);
	const safeContent = padToWidth(fitContent(content, targetWidth), targetWidth);
	const pad = Math.floor((inner - targetWidth) / 2);
	const rightPad = inner - targetWidth - pad;
	return padToWidth(
		fg("border", "│") + " ".repeat(pad) + safeContent + " ".repeat(rightPad) + fg("border", "│"),
		width,
	);
}

function renderBoxInsetLine(content: string, width: number, inset: number = 2): string {
	const inner = width - 4;
	const contentWidth = Math.max(1, inner - inset * 2);
	const safeContent = padToWidth(fitContent(content, contentWidth), contentWidth);
	return padToWidth(
		fg("border", "│") + " ".repeat(inset) + safeContent + " ".repeat(inset) + fg("border", "│"),
		width,
	);
}

function renderBoxEmpty(width: number): string {
	return renderBoxLine("", width);
}

function renderEmblemLine(line: string): string {
	const diamondIndex = line.indexOf("◇");
	if (diamondIndex === -1) return fg("airisOrange", line);
	const before = line.slice(0, diamondIndex);
	const after = line.slice(diamondIndex + 1);
	return `${fg("airisOrange", before)}${fg("airisOrangeHighlight", "◆")}${fg("airisOrange", after)}`;
}

function renderEmblem(lines: readonly string[], width: number): string[] {
	return lines.map((line) => renderBoxLine(renderEmblemLine(line), width));
}

function renderLogoLine(index: number, line: string): string {
	const paddedLine = padToWidth(line, LOGO_BLOCK_WIDTH);
	if (!line.trim()) return paddedLine;
	// Index 0: top border, Index 16: bottom border - use border color
	if (index === 0 || index === 16) return fg("border", paddedLine);
	// Index 1, 8, 15: diamond lines - airisOrange
	if (index === 1 || index === 8 || index === 15) return fg("airisOrange", bold(paddedLine));
	// Index 2-7: big AIRIS letters - highlight color
	if (index >= 2 && index <= 7) return fg("airisOrangeHighlight", bold(paddedLine));
	// Index 9, 12: empty lines - dim
	if (index === 9 || index === 12) return fg("dim", paddedLine);
	// Index 10: "Artificial Intelligence" - accent
	if (index === 10) return fg("accent", paddedLine);
	// Index 11: "Responsive Integrated System" - accent
	if (index === 11) return fg("accent", paddedLine);
	// Index 13: "AI Coding · Automation · CLI" - airisOrangeMuted
	if (index === 13) return fg("airisOrangeMuted", paddedLine);
	// Index 14: "KageOS · Umaiz Sufiyan" - dim
	if (index === 14) return fg("dim", paddedLine);
	return fg("dim", paddedLine);
}

function renderLogo(width: number): string[] {
	return LOGO_LINES.map((line, index) => renderBoxBlockLine(renderLogoLine(index, line), width, LOGO_BLOCK_WIDTH));
}

function renderSeparator(width: number): string {
	if (width < 8) return padToWidth("", width);
	const inner = width - 4;
	return padToWidth(fg("borderAccent", "├") + fg("borderMuted", "─".repeat(inner)) + fg("borderAccent", "┤"), width);
}

function renderSectionDivider(title: string, width: number): string {
	const inner = width - 4;
	if (inner < 14) {
		return renderSeparator(width);
	}
	const label = ` ${title.toUpperCase()} `;
	const labelWidth = visibleWidth(label);
	const left = Math.max(1, Math.floor((inner - labelWidth) / 2));
	const right = Math.max(1, inner - labelWidth - left);
	return padToWidth(
		fg("borderAccent", "├") +
			fg("borderMuted", "─".repeat(left)) +
			fg("accent", label) +
			fg("borderMuted", "─".repeat(right)) +
			fg("borderAccent", "┤"),
		width,
	);
}

function renderMetaLine(label: string, value: string, width: number): string {
	const text = `${fg("accent", label.toUpperCase().padEnd(8))} ${fg("airisOrangeMuted", "◆")} ${fg("text", value)}`;
	return renderBoxInsetLine(text, width);
}

function renderTitle(name: string): string {
	return fg("airisOrangeHighlight", bold(name));
}

function renderKeybindingHints(width: number): string[] {
	const inner = width - 4;
	if (inner < 30) return [];

	// Group hints into rows of 3
	const lines: string[] = [];
	for (let i = 0; i < KEYBINDING_HINTS.length; i += 3) {
		const group = KEYBINDING_HINTS.slice(i, i + 3);
		const parts = group.map((h) => `${fg("accent", h.keys)} ${fg("dim", h.label)}`);
		const line = parts.join(fg("borderMuted", " · "));
		const w = visibleWidth(line);
		if (w <= inner) {
			lines.push(renderBoxInsetLine(line, width));
		} else {
			// Fall back to individual lines
			lines.push(...group.map((h) => renderBoxInsetLine(`${fg("accent", h.keys)} ${fg("dim", h.label)}`, width)));
		}
	}
	return lines;
}

function renderTip(width: number): string[] {
	const tip = `${fg("success", "✨")} ${fg("muted", currentTip())}`;
	return [renderBoxInsetLine(tip, width)];
}

export function rotateTip(): void {
	nextTip();
}

export class WelcomeHeader implements Component {
	private info: WelcomeHeaderInfo;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(info: WelcomeHeaderInfo) {
		this.info = info;
	}

	setInfo(info: WelcomeHeaderInfo): void {
		this.info = info;
		this.invalidate();
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	render(width: number): string[] {
		if (this.cachedLines !== undefined && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const variant = selectVariant(width);
		const lines: string[] = [];

		lines.push(padToWidth("", width));

		if (width >= WIDTH_MINIMAL) {
			lines.push(renderBoxTop(width));

			if (variant.kind === "logo") {
				lines.push(...renderLogo(width));
			} else {
				lines.push(renderBoxEmpty(width));
				lines.push(...renderEmblem(EMBLEM_MINIMAL, width));
				lines.push(renderBoxEmpty(width));
				lines.push(renderBoxLine(renderTitle(NAME_MINIMAL), width));
				if (width >= WIDTH_MINIMAL_TAGLINE) {
					lines.push(renderBoxLine(fg("airisOrangeMuted", TAGLINE_MINIMAL), width));
				}
			}

			lines.push(renderSectionDivider("Session", width));

			if (this.info.model) {
				lines.push(renderMetaLine("Model", this.info.model, width));
			}
			if (this.info.provider) {
				lines.push(renderMetaLine("Provider", this.info.provider, width));
			}
			if (this.info.mode) {
				lines.push(renderMetaLine("Mode", this.info.mode, width));
			}
			if (this.info.version) {
				lines.push(renderMetaLine("Version", `v${this.info.version}`, width));
			}
			if (this.info.cwd) {
				const maxPathLen = Math.max(10, width - 20);
				const shortCwd = truncateMiddle(this.info.cwd, maxPathLen);
				lines.push(renderMetaLine("Project", shortCwd, width));
			}

			lines.push(renderSectionDivider("Hints", width));
			lines.push(...renderKeybindingHints(width));
			lines.push(...renderTip(width));

			lines.push(renderBoxBottom(width));
		} else {
			lines.push(renderPlainLine(fg("airisOrange", EMBLEM_ASCII[0]), width));
			lines.push(renderPlainLine(fg("airisOrange", EMBLEM_ASCII[1]), width));
			lines.push(renderPlainLine(fg("airisOrange", EMBLEM_ASCII[2]), width));
			lines.push(renderPlainLine(renderTitle(NAME_ASCII), width));
			if (this.info.model) {
				lines.push(renderPlainLine(fg("dim", `Model: ${this.info.model}`), width));
			}
		}

		lines.push(padToWidth("", width));

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}
}
