import type { Component } from "../tui.ts";
import { isNoColor } from "../utils.ts";

/**
 * ASCII wordmark for AIRIS CLI.
 * Renders a compact brand identity based on terminal width.
 */
export class AirisWordmark implements Component {
	private showTagline: boolean;
	private showVersion: boolean;
	private version: string;

	constructor(showTagline = true, showVersion = false, version = "") {
		this.showTagline = showTagline;
		this.showVersion = showVersion;
		this.version = version;
	}

	setVersion(version: string): void {
		this.version = version;
	}

	invalidate(): void {
		// No cached state to invalidate
	}

	render(width: number): string[] {
		const lines: string[] = [];
		const noColor = isNoColor();

		// Color helpers
		const blue = (s: string) => (noColor ? s : `\x1b[38;2;96;165;250m${s}\x1b[39m`);
		const white = (s: string) => (noColor ? s : `\x1b[38;2;240;240;245m${s}\x1b[39m`);
		const slate = (s: string) => (noColor ? s : `\x1b[38;2;120;120;140m${s}\x1b[39m`);

		if (width < 30) {
			// Narrow: compact single-line
			const wordmark = blue("AIRIS") + white(" CLI");
			lines.push(wordmark);
			if (this.showVersion && this.version) {
				lines.push(slate(`v${this.version}`));
			}
		} else if (width < 50) {
			// Medium: two-line compact
			lines.push(blue("AIRIS") + white(" CLI"));
			if (this.showTagline) {
				lines.push(slate("AI Command-Line Assistant"));
			}
			if (this.showVersion && this.version) {
				lines.push(slate(`v${this.version}`));
			}
		} else {
			// Wide: full wordmark with tagline
			lines.push(blue("A I R I S   C L I"));
			if (this.showTagline) {
				lines.push("");
				lines.push(white("Artificial Intelligence"));
				lines.push(slate("Responsive Integrated System"));
			}
			if (this.showVersion && this.version) {
				lines.push("");
				lines.push(slate(`v${this.version}`));
			}
		}

		return lines;
	}
}
