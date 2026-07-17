import type { Component } from "../tui.ts";
import { isNoColor, visibleWidth } from "../utils.ts";

export interface ShortcutItem {
	key: string;
	label: string;
	keybinding?: string;
}

/**
 * Default AIRIS shortcuts shown in the shortcut bar.
 * These are verified against the actual keybinding registry.
 */
const DEFAULT_SHORTCUTS: ShortcutItem[] = [
	{ key: "tab", label: "mode", keybinding: "tab" },
	{ key: "ctrl+p", label: "settings" },
	{ key: "@", label: "attach", keybinding: "@" },
	{ key: "$", label: "agent" },
	{ key: "/", label: "commands" },
];

/**
 * Shortcut bar component that displays available keyboard shortcuts.
 * Adapts to terminal width: full bar on wide, compact on narrow.
 */
export class ShortcutBar implements Component {
	private items: ShortcutItem[];

	constructor(items: ShortcutItem[] = DEFAULT_SHORTCUTS) {
		this.items = items;
	}

	setItems(items: ShortcutItem[]): void {
		this.items = items;
	}

	invalidate(): void {
		// No cached state
	}

	render(width: number): string[] {
		if (this.items.length === 0) return [""];
		if (width < 5) return [""];

		const noColor = isNoColor();

		const slate = (s: string) => (noColor ? s : `\x1b[38;2;120;120;140m${s}\x1b[39m`);
		const blue = (s: string) => (noColor ? s : `\x1b[38;2;96;165;250m${s}\x1b[39m`);

		if (width < 40) {
			// Ultra-compact: only show critical shortcuts
			const critical = this.items.slice(0, Math.min(3, this.items.length));
			const parts = critical.map((item) => `${blue(item.key)} ${slate(item.label)}`);
			return [parts.join(" · ")];
		}

		if (width < 60) {
			// Compact: show first 4 with dots
			const visible = this.items.slice(0, Math.min(4, this.items.length));
			const parts = visible.map((item) => `${blue(item.key)} ${slate(item.label)}`);
			return [parts.join(" · ")];
		}

		// Full layout: aligned columns
		const maxKeyLen = Math.max(...this.items.map((i) => i.key.length));
		const lines: string[] = [];

		// Render in up to 2 rows of 3 items
		const rowSize = 3;
		for (let row = 0; row < this.items.length; row += rowSize) {
			const rowItems = this.items.slice(row, row + rowSize);
			let line = "";
			for (const item of rowItems) {
				const paddedKey = item.key.padEnd(maxKeyLen);
				const full = `${blue(paddedKey)} ${slate(item.label)}`;
				if (visibleWidth(line) + visibleWidth(full) + 4 > width) break;
				if (line) line += "    ";
				line += full;
			}
			if (line) lines.push(line);
		}

		return lines.length > 0 ? lines : [""];
	}
}
