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

// ─── EMBLEM VARIANTS ──────────────────────────────────────────────────────────

const EMBLEM_FULL: readonly string[] = [
	"                    ╲   ╿   ╱",
	"                 ━━━━╲  ◇  ╱━━━━",
	"                    ╱   ╽   ╲",
];

const EMBLEM_COMPACT: readonly string[] = ["          ╲   ╿   ╱", "       ━━━━╲  ◇  ╱━━━━", "          ╱   ╽   ╲"];

const EMBLEM_MINIMAL: readonly string[] = ["       ╲   ╿   ╱", "    ━━━━╲  ◇  ╱━━━━", "       ╱   ╽   ╲"];

const EMBLEM_ASCII: readonly string[] = ["         \\   |   /", "       ===\\  <>  /===", "         /   |   \\"];

const NAME_FULL = "A I R I S";
const NAME_COMPACT = "AIRIS";
const NAME_MINIMAL = "AIRIS";
const NAME_ASCII = "AIRIS";

// ─── WIDTH THRESHOLDS ─────────────────────────────────────────────────────────

const WIDTH_FULL = 72;
const WIDTH_COMPACT = 45;
const WIDTH_MINIMAL = 36;

function selectVariant(width: number): {
	emblem: readonly string[];
	name: string;
	boxWidth: number;
	showSubtitle: boolean;
	showWelcome: boolean;
	showMeta: boolean;
	showShortcuts: boolean;
} {
	if (width >= WIDTH_FULL) {
		return {
			emblem: EMBLEM_FULL,
			name: NAME_FULL,
			boxWidth: Math.min(width - 4, 68),
			showSubtitle: true,
			showWelcome: true,
			showMeta: true,
			showShortcuts: true,
		};
	}
	if (width >= WIDTH_COMPACT) {
		return {
			emblem: EMBLEM_COMPACT,
			name: NAME_COMPACT,
			boxWidth: Math.min(width - 4, 56),
			showSubtitle: false,
			showWelcome: true,
			showMeta: true,
			showShortcuts: true,
		};
	}
	if (width >= WIDTH_MINIMAL) {
		return {
			emblem: EMBLEM_MINIMAL,
			name: NAME_MINIMAL,
			boxWidth: width - 4,
			showSubtitle: false,
			showWelcome: false,
			showMeta: true,
			showShortcuts: false,
		};
	}
	return {
		emblem: EMBLEM_ASCII,
		name: NAME_ASCII,
		boxWidth: width,
		showSubtitle: false,
		showWelcome: false,
		showMeta: true,
		showShortcuts: false,
	};
}

// ─── RENDER HELPERS ────────────────────────────────────────────────────────────

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

function renderSeparator(width: number): string {
	if (width < 8) return padToWidth("", width);
	const inner = width - 4;
	return padToWidth(fg("borderAccent", "├") + fg("borderMuted", "─".repeat(inner)) + fg("borderAccent", "┤"), width);
}

function renderMetaLine(label: string, value: string, width: number): string {
	const text = `${fg("accent", label.toUpperCase().padEnd(9))}${fg("dim", "• ")}${fg("text", value)}`;
	return renderBoxLine(text, width);
}

function renderTitle(name: string): string {
	return fg("airisOrangeHighlight", bold(name));
}

// ─── WELCOME HEADER COMPONENT ──────────────────────────────────────────────────

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

		// Top spacer
		lines.push(padToWidth("", width));

		// Only render box if wide enough
		if (width >= WIDTH_MINIMAL) {
			// Box top
			lines.push(renderBoxTop(width));

			// Welcome message (only for full/compact)
			if (variant.showWelcome) {
				lines.push(renderBoxEmpty(width));
				lines.push(renderBoxLine(fg("accent", bold("Ready to build")), width));
				if (variant.showSubtitle) {
					lines.push(renderBoxLine(fg("muted", "Plan changes, edit files, run checks"), width));
				}
			}

			// Empty line before emblem
			lines.push(renderBoxEmpty(width));

			// Emblem (diamond with rails)
			lines.push(...renderEmblem(variant.emblem, width));

			// Empty line after emblem
			lines.push(renderBoxEmpty(width));

			// Name
			lines.push(renderBoxLine(renderTitle(variant.name), width));

			// Subtitle (full only)
			if (variant.showSubtitle) {
				lines.push(renderBoxLine(fg("airisOrangeMuted", "Artificial Intelligence Responsive"), width));
				lines.push(renderBoxLine(fg("airisOrangeMuted", "Integrated System"), width));
				if (this.info.version) {
					lines.push(renderBoxLine(fg("dim", `Coding agent · v${this.info.version}`), width));
				}
			}

			// Separator
			if (variant.showMeta) {
				lines.push(renderSeparator(width));

				// Metadata
				if (this.info.model) {
					lines.push(renderMetaLine("Model", this.info.model, width));
				}
				if (this.info.provider) {
					lines.push(renderMetaLine("Provider", this.info.provider, width));
				}
				if (this.info.mode) {
					lines.push(renderMetaLine("Mode", this.info.mode, width));
				}
				if (!variant.showSubtitle && this.info.version) {
					lines.push(renderMetaLine("Version", `v${this.info.version}`, width));
				}
				if (this.info.cwd) {
					const maxPathLen = Math.max(10, width - 24);
					const shortCwd = truncateMiddle(this.info.cwd, maxPathLen);
					lines.push(renderMetaLine("Project", shortCwd, width));
				}
			}

			// Box bottom
			lines.push(renderBoxBottom(width));
		} else {
			// Minimal: no box, just emblem + name + model
			lines.push(renderPlainLine(fg("airisOrange", variant.emblem[0]), width));
			lines.push(renderPlainLine(fg("airisOrange", variant.emblem[1]), width));
			lines.push(renderPlainLine(fg("airisOrange", variant.emblem[2]), width));
			lines.push(renderPlainLine(renderTitle(variant.name), width));
			if (this.info.model) {
				lines.push(renderPlainLine(fg("dim", `Model: ${this.info.model}`), width));
			}
		}

		// Bottom spacer
		lines.push(padToWidth("", width));

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}
}
