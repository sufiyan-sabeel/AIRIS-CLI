import type { Component } from "../tui.ts";
import { isNoColor, truncateToWidth } from "../utils.ts";

export interface PromptAreaData {
	placeholder?: string;
	mode?: string;
	model?: string;
	provider?: string;
	context?: string;
	shellCount?: number;
}

const DEFAULT_PLACEHOLDER = "Type your message…  (Type / for commands)";

/**
 * Prompt area component that shows the input area with context info.
 * Adapts to terminal width:
 * - Wide: full layout with tip, divider, prompt, context bar
 * - Medium: simplified prompt with context
 * - Narrow: compact single-line
 */
export class PromptArea implements Component {
	private data: PromptAreaData;
	private tip: string;

	constructor(data: PromptAreaData = {}, tip = "") {
		this.data = data;
		this.tip = tip;
	}

	setData(data: Partial<PromptAreaData>): void {
		Object.assign(this.data, data);
	}

	setTip(tip: string): void {
		this.tip = tip;
	}

	invalidate(): void {
		// No cached state
	}

	render(width: number): string[] {
		if (width < 5) return ["❯"];

		const noColor = isNoColor();

		const white = (s: string) => (noColor ? s : `\x1b[38;2;240;240;245m${s}\x1b[39m`);
		const slate = (s: string) => (noColor ? s : `\x1b[38;2;120;120;140m${s}\x1b[39m`);
		const blue = (s: string) => (noColor ? s : `\x1b[38;2;96;165;250m${s}\x1b[39m`);
		const divider = (s: string) => (noColor ? s : `\x1b[38;2;40;40;50m${s}\x1b[39m`);

		const lines: string[] = [];

		if (width < 40) {
			// Narrow: compact
			lines.push(blue("❯") + slate(` ${DEFAULT_PLACEHOLDER}`));

			const info: string[] = [];
			if (this.data.provider) info.push(slate(this.data.provider));
			if (this.data.mode) info.push(slate(this.data.mode));
			lines.push(info.join(slate(" · ")) + slate("  ·  ") + blue("esc stop"));
			return lines;
		}

		if (width < 60) {
			// Medium: tip + prompt + compact context
			lines.push("");
			const placeholder = truncateToWidth(DEFAULT_PLACEHOLDER, width - 4);
			lines.push(blue("❯") + slate(` ${placeholder}`));

			const info: string[] = [];
			if (this.data.provider) info.push(slate(this.data.provider));
			if (this.data.model) info.push(slate(this.data.model));
			if (this.data.mode) info.push(slate(this.data.mode));
			if (this.data.context) info.push(slate(this.data.context));
			if (info.length > 0) {
				lines.push(slate("  ") + info.join(slate(" · ")));
			}
			return lines;
		}

		// Wide: full layout
		if (this.tip) {
			const tip = truncateToWidth(slate(`Tip: ${this.tip}`), width - 2);
			lines.push(tip);
		}

		// Divider
		lines.push(divider("─".repeat(width)));

		// Prompt
		lines.push(blue("❯") + slate(` ${DEFAULT_PLACEHOLDER}`));

		// Divider
		lines.push(divider("─".repeat(width)));

		// Context bar
		const ctx: string[] = [];
		if (this.data.model) ctx.push(white(this.data.model));
		if (this.data.provider) ctx.push(slate(this.data.provider));
		if (this.data.context) ctx.push(blue(this.data.context));
		if (this.data.mode) ctx.push(slate(this.data.mode));
		if (this.data.shellCount !== undefined && this.data.shellCount > 0) {
			ctx.push(slate(`${this.data.shellCount} shells`));
		}

		if (ctx.length > 0) {
			lines.push(ctx.join(blue(" · ")) + slate("  ·  ") + blue("esc stop"));
		} else {
			lines.push(slate("esc stop"));
		}

		return lines;
	}
}
