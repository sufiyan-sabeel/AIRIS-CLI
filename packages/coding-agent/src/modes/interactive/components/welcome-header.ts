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

// ═══════════════════════════════════════════════════════════════
// Logo Design - Smooth, Adaptive, Professional
// ═══════════════════════════════════════════════════════════════

const LOGO_LINES: readonly string[] = [
	"╭──────────────────────────────────╮",
	"│ ◆══════════════════════════════◆ │",
	"│ │ █████╗ ██╗██████╗ ██╗███████╗ │ │",
	"│ │██╔══██╗██║██╔══██╗██║██╔════╝ │ │",
	"│ │███████║██║██████╔╝██║███████╗ │ │",
	"│ │██╔══██║██║██╔══██║██║╚════██║ │ │",
	"│ │██║  ██║██║██║  ██║██║███████║ │ │",
	"│ │╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝╚══════╝ │ │",
	"│ ◆══════════════════════════════◆ │",
	"│ │                                │ │",
	"│ │    Artificial Intelligence     │ │",
	"│ │  Responsive Integrated System  │ │",
	"│ │                                │ │",
	"│ │   AI Coding · Automation · CLI │ │",
	"│ │      KageOS · Umaiz Sufiyan    │ │",
	"│ ◆══════════════════════════════◆ │",
	"╰──────────────────────────────────╯",
];

// Compact logo for narrow terminals
const LOGO_COMPACT: readonly string[] = [
	"╭─────────────────────────╮",
	"│   ◆═════════════════◆   │",
	"│   ║   A I R I S     ║   │",
	"│   ║   CLI           ║   │",
	"│   ◆═════════════════◆   │",
	"╰─────────────────────────╯",
];

// Minimal logo for very narrow terminals
const LOGO_MINIMAL: readonly string[] = [
	"╭───────────────────╮",
	"│  ✦ A I R I S ✦   │",
	"│  CLI · AI · Auto  │",
	"╰───────────────────╯",
];

const LOGO_BLOCK_WIDTH = Math.max(...LOGO_LINES.map((line) => visibleWidth(line)));

// ═══════════════════════════════════════════════════════════════
// Routing Modes
// ═══════════════════════════════════════════════════════════════

const ROUTING_MODES: Array<{ prefix: string; icon: string; label: string; description: string }> = [
	{ prefix: "@coding", icon: "⌨", label: "Coding", description: "Repository coding & editing" },
	{ prefix: "@automation", icon: "⚡", label: "Auto", description: "Android automation" },
	{ prefix: "@multiauto", icon: "🔄", label: "Multi", description: "Multi-step automation" },
];

// ═══════════════════════════════════════════════════════════════
// Keybinding Hints
// ═══════════════════════════════════════════════════════════════

const KEYBINDING_HINTS: Array<{ keys: string; label: string }> = [
	{ keys: "Ctrl+P", label: "Plan mode" },
	{ keys: "Ctrl+Alt+P", label: "Toggle plan" },
	{ keys: "Ctrl+L", label: "Clear" },
	{ keys: "Ctrl+Up/Down", label: "Scroll" },
	{ keys: "Tab", label: "Complete" },
	{ keys: "Ctrl+/", label: "Commands" },
];

// ═══════════════════════════════════════════════════════════════
// Tips - Rotating helpful messages
// ═══════════════════════════════════════════════════════════════

const WELCOME_TIPS: readonly string[] = [
	"Type your question or describe a task to get started.",
	"Use /plan to create a structured plan before executing.",
	"Use /ship for full workflow: request → plan → implement → verify.",
	"Use @coding to switch to repository coding mode.",
	"Use Ctrl+P in interactive mode to switch models.",
	"Use /mission for verified autonomy with contracts and evidence.",
	"Use @automation for Android device control tasks.",
	"Use @multiauto for multi-step automation workflows.",
	"Use /doctor to check system health and configuration.",
	"Use /settings to customize your AIRIS experience.",
];

let tipIndex = 0;
function nextTip(): string {
	tipIndex = (tipIndex + 1) % WELCOME_TIPS.length;
	return WELCOME_TIPS[tipIndex];
}
function currentTip(): string {
	return WELCOME_TIPS[tipIndex];
}

// ═══════════════════════════════════════════════════════════════
// Width Constants & Adaptation
// ═══════════════════════════════════════════════════════════════

const WIDTH_LOGO = Math.max(LOGO_BLOCK_WIDTH + 4, 38);
const WIDTH_COMPACT = 28;
const WIDTH_MINIMAL = 20;

function selectVariant(width: number): { kind: "logo" | "compact" | "minimal" | "tiny" } {
	if (width >= WIDTH_LOGO) return { kind: "logo" };
	if (width >= WIDTH_COMPACT) return { kind: "compact" };
	if (width >= WIDTH_MINIMAL) return { kind: "minimal" };
	return { kind: "tiny" };
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function fg(color: Parameters<Theme["fg"]>[0], text: string): string {
	if (NO_COLOR) return text;
	return theme.fg(color, text);
}

function bold(text: string): string {
	if (NO_COLOR) return text;
	return theme.bold(text);
}

function italic(text: string): string {
	if (NO_COLOR) return text;
	return theme.italic(text);
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

function fitContent(content: string, width: number): string {
	if (visibleWidth(content) <= width) return content;
	const truncated = truncateToWidth(content, width, "");
	return content.includes("\x1b") ? truncated : truncated.replace(/\x1b\[0m/g, "");
}

// ═══════════════════════════════════════════════════════════════
// Box Drawing Functions
// ═══════════════════════════════════════════════════════════════

function renderBoxTop(width: number, style: "rounded" | "double" = "rounded"): string {
	const inner = width - 4;
	const corner = style === "double" ? "╔" : "╭";
	const line = style === "double" ? "═" : "─";
	return padToWidth(fg("borderAccent", corner) + fg("border", line.repeat(inner)) + fg("borderAccent", style === "double" ? "╗" : "╮"), width);
}

function renderBoxBottom(width: number, style: "rounded" | "double" = "rounded"): string {
	const inner = width - 4;
	const corner = style === "double" ? "╚" : "╰";
	const line = style === "double" ? "═" : "─";
	return padToWidth(fg("borderAccent", corner) + fg("border", line.repeat(inner)) + fg("borderAccent", style === "double" ? "╝" : "╯"), width);
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

// ═══════════════════════════════════════════════════════════════
// Logo Rendering with Color
// ═══════════════════════════════════════════════════════════════

function renderLogoLine(index: number, line: string, blockWidth: number): string {
	const paddedLine = padToWidth(line, blockWidth);
	if (!line.trim()) return paddedLine;

	// Border lines (top/bottom)
	if (line.includes("╭") || line.includes("╮") || line.includes("╰") || line.includes("╯")) {
		return fg("border", paddedLine);
	}
	if (line.includes("╔") || line.includes("╗") || line.includes("╚") || line.includes("╝")) {
		return fg("border", paddedLine);
	}

	// Diamond decoration lines
	if (line.includes("◆══") || line.includes("══◆")) {
		return fg("airisOrange", bold(paddedLine));
	}

	// AIRIS block letters (rows with block characters)
	if (line.includes("█") || line.includes("╔") || line.includes("╗") || line.includes("╚") || line.includes("╝")) {
		return fg("airisOrangeHighlight", bold(paddedLine));
	}

	// Text content lines
	if (line.includes("Artificial Intelligence") || line.includes("Responsive Integrated System")) {
		return fg("accent", paddedLine);
	}
	if (line.includes("AI Coding") || line.includes("Automation")) {
		return fg("airisOrangeMuted", paddedLine);
	}
	if (line.includes("KageOS") || line.includes("Umaiz")) {
		return fg("dim", paddedLine);
	}

	return fg("dim", paddedLine);
}

function renderLogo(width: number, lines: readonly string[], blockWidth: number): string[] {
	return lines.map((line, index) => renderBoxBlockLine(renderLogoLine(index, line, blockWidth), width, blockWidth));
}

// ═══════════════════════════════════════════════════════════════
// Meta Line Rendering
// ═══════════════════════════════════════════════════════════════

function renderMetaLine(label: string, value: string, width: number): string {
	const text = `${fg("accent", label.toUpperCase().padEnd(8))} ${fg("airisOrangeMuted", "◆")} ${fg("text", value)}`;
	return renderBoxInsetLine(text, width);
}

function renderTitle(name: string): string {
	return fg("airisOrangeHighlight", bold(name));
}

// ═══════════════════════════════════════════════════════════════
// Routing Modes Rendering
// ═══════════════════════════════════════════════════════════════

function renderRoutingModes(width: number): string[] {
	const inner = width - 4;
	if (inner < 25) return [];

	const lines: string[] = [];

	// Header line
	lines.push(renderBoxInsetLine(fg("dim", "Prefix a message with:"), width));

	// Group routing modes
	for (let i = 0; i < ROUTING_MODES.length; i += 2) {
		const group = ROUTING_MODES.slice(i, i + 2);
		const parts = group.map((r) => {
			const prefix = fg("airisOrangeHighlight", bold(r.prefix));
			const desc = fg("dim", r.description);
			return `${prefix} ${desc}`;
		});
		const line = parts.join(fg("borderMuted", "  "));
		const w = visibleWidth(line);
		if (w <= inner) {
			lines.push(renderBoxInsetLine(line, width));
		} else {
			for (const r of group) {
				lines.push(renderBoxInsetLine(`${fg("airisOrangeHighlight", bold(r.prefix))} ${fg("dim", r.description)}`, width));
			}
		}
	}

	return lines;
}

// ═══════════════════════════════════════════════════════════════
// Keybinding Hints Rendering
// ═══════════════════════════════════════════════════════════════

function renderKeybindingHints(width: number): string[] {
	const inner = width - 4;
	if (inner < 25) return [];

	const lines: string[] = [];

	// Group hints into rows of 3
	for (let i = 0; i < KEYBINDING_HINTS.length; i += 3) {
		const group = KEYBINDING_HINTS.slice(i, i + 3);
		const parts = group.map((h) => `${fg("accent", h.keys)} ${fg("dim", h.label)}`);
		const line = parts.join(fg("borderMuted", " · "));
		const w = visibleWidth(line);
		if (w <= inner) {
			lines.push(renderBoxInsetLine(line, width));
		} else {
			lines.push(...group.map((h) => renderBoxInsetLine(`${fg("accent", h.keys)} ${fg("dim", h.label)}`, width)));
		}
	}

	return lines;
}

// ═══════════════════════════════════════════════════════════════
// Tip Rendering
// ═══════════════════════════════════════════════════════════════

function renderTip(width: number): string[] {
	const tip = `${fg("success", "✨")} ${fg("muted", italic(currentTip()))}`;
	return [renderBoxInsetLine(tip, width)];
}

export function rotateTip(): void {
	nextTip();
}

// ═══════════════════════════════════════════════════════════════
// Welcome Header Component
// ═══════════════════════════════════════════════════════════════

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

		// Top spacing
		lines.push(padToWidth("", width));

		// Box container
		lines.push(renderBoxTop(width));

		// Logo section
		if (variant.kind === "logo") {
			lines.push(...renderLogo(width, LOGO_LINES, LOGO_BLOCK_WIDTH));
		} else if (variant.kind === "compact") {
			lines.push(...renderLogo(width, LOGO_COMPACT, visibleWidth(LOGO_COMPACT[0])));
		} else if (variant.kind === "minimal") {
			lines.push(...renderLogo(width, LOGO_MINIMAL, visibleWidth(LOGO_MINIMAL[0])));
		} else {
			// Tiny - just text
			lines.push(renderBoxLine(renderTitle("AIRIS CLI"), width));
			lines.push(renderBoxLine(fg("dim", "AI Coding · Automation"), width));
		}

		// Session info section
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

		// Routing modes section
		lines.push(renderSectionDivider("Routes", width));
		lines.push(...renderRoutingModes(width));

		// Keybinding hints section
		lines.push(renderSectionDivider("Quick Actions", width));
		lines.push(...renderKeybindingHints(width));

		// Tip section
		lines.push(renderSectionDivider("Tip", width));
		lines.push(...renderTip(width));

		// Bottom border
		lines.push(renderBoxBottom(width));

		// Bottom spacing
		lines.push(padToWidth("", width));

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}
}
