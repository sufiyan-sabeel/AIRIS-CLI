import type { Component } from "../tui.ts";
import { isNoColor, truncateToWidth, visibleWidth } from "../utils.ts";

export interface StatusLineData {
	repoPath?: string;
	branch?: string;
	version?: string;
	mode?: string;
	model?: string;
	provider?: string;
	context?: string;
	shellCount?: number;
}

/**
 * Status line component that shows repository status, version, and mode.
 * Adapts to terminal width with truncation and compact layout.
 */
export class StatusLine implements Component {
	private data: StatusLineData;

	constructor(data: StatusLineData = {}) {
		this.data = data;
	}

	setData(data: Partial<StatusLineData>): void {
		Object.assign(this.data, data);
	}

	invalidate(): void {
		// No cached state
	}

	render(width: number): string[] {
		if (width < 10) return [""];

		const noColor = isNoColor();

		const slate = (s: string) => (noColor ? s : `\x1b[38;2;120;120;140m${s}\x1b[39m`);
		const green = (s: string) => (noColor ? s : `\x1b[38;2;74;222;128m${s}\x1b[39m`);
		const blue = (s: string) => (noColor ? s : `\x1b[38;2;96;165;250m${s}\x1b[39m`);
		const dim = (s: string) => (noColor ? s : `\x1b[2m${s}\x1b[22m`);

		const parts: string[] = [];

		// Repository path
		if (this.data.repoPath) {
			parts.push(slate(this.data.repoPath));
		}

		// Branch
		if (this.data.branch) {
			parts.push(green(this.data.branch));
		}

		// Version
		if (this.data.version) {
			parts.push(slate(`v${this.data.version}`));
		}

		// Mode
		if (this.data.mode) {
			parts.push(blue(this.data.mode));
		}

		// Provider/model
		if (this.data.provider) {
			const modelStr = this.data.model ? `${this.data.provider}/${this.data.model}` : this.data.provider;
			parts.push(slate(modelStr));
		} else if (this.data.model) {
			parts.push(slate(this.data.model));
		}

		// Context
		if (this.data.context) {
			parts.push(slate(this.data.context));
		}

		// Shell count
		if (this.data.shellCount !== undefined && this.data.shellCount > 0) {
			parts.push(slate(`${this.data.shellCount} shells`));
		}

		if (parts.length === 0) return [""];

		const separator = slate(" · ");
		let fullLine = parts.join(separator);

		if (visibleWidth(fullLine) > width) {
			// Need to truncate. Keep left repo path + branch, drop from right
			const keepLeft = [this.data.repoPath, this.data.branch]
				.filter(Boolean)
				.join(separator);

			if (visibleWidth(keepLeft) + 3 <= width) {
				fullLine = truncateToWidth(fullLine, width);
			} else {
				fullLine = truncateToWidth(keepLeft, width - 3) + dim("…");
			}
		}

		// Pad to full width
		const visualLen = visibleWidth(fullLine);
		const padding = Math.max(0, width - visualLen);
		return [fullLine + " ".repeat(padding)];
	}
}
