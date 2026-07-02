import { Container, getKeybindings, Spacer, Text } from "@sufiyan-sabeel/airis-tui";
import { APP_NAME } from "../../../config.ts";
import { type TerminalTheme, theme } from "../theme/theme.ts";
import { getCreatorAttribution, getFullLogo, getTagline } from "./airis-logo.ts";
import { DynamicBorder } from "./dynamic-border.ts";
import { keyHint, rawKeyHint } from "./keybinding-hints.ts";

export interface FirstTimeSetupResult {
	theme: TerminalTheme;
	shareAnalytics: boolean;
}

export interface FirstTimeSetupOptions {
	detectedTheme: TerminalTheme;
	onThemePreview: (themeName: TerminalTheme) => void;
	onSubmit: (result: FirstTimeSetupResult) => void;
	onCancel: () => void;
}

const THEME_OPTIONS: Array<{ value: TerminalTheme; label: string }> = [
	{ value: "dark", label: "Dark" },
	{ value: "light", label: "Light" },
];

const ANALYTICS_OPTIONS: Array<{ value: boolean; label: string }> = [
	{ value: true, label: "Share anonymous usage data" },
	{ value: false, label: "Don't share" },
];

const MODE_LINES = [
	"normal chat        Ask questions and work with your AI assistant",
	"@coding <task>     Repository coding/editing mode",
	"@automation <task> Android automation mode",
	"@multiauto <task>  Multi-step Android automation mode",
];

const QUICK_START_LINES = [
	`${APP_NAME} "Explain this project"`,
	`${APP_NAME} @coding "review the auth flow"`,
	`${APP_NAME} @automation "open settings"`,
	`${APP_NAME} -p "summarize README.md"`,
];

/** First-time setup dialog: AIRIS greeting, theme choice, and analytics opt-in. */
export class FirstTimeSetupComponent extends Container {
	private step: "theme" | "analytics" = "theme";
	private themeIndex: number;
	private analyticsIndex = 0;
	private readonly options: FirstTimeSetupOptions;

	constructor(options: FirstTimeSetupOptions) {
		super();
		this.options = options;
		this.themeIndex = Math.max(
			0,
			THEME_OPTIONS.findIndex((option) => option.value === options.detectedTheme),
		);
		this.update();
	}

	// Rebuild the whole dialog on every change so theme previews recolor all text.
	private update(): void {
		this.clear();
		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("accent", getFullLogo().join("\n")), 1, 0));
		this.addChild(new Text(theme.fg("dim", `${getCreatorAttribution()}  |  Brand: KageOS`), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("accent", theme.bold(`Welcome to ${APP_NAME.toUpperCase()}`)), 1, 0));
		this.addChild(new Text(theme.fg("text", getTagline()), 1, 0));
		this.addChild(new Text(theme.fg("muted", `Project: ${process.cwd()}`), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("accent", "Available modes"), 1, 0));
		this.addChild(new Text(theme.fg("muted", MODE_LINES.map((line) => `  ${line}`).join("\n")), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("warning", "Safety"), 1, 0));
		this.addChild(
			new Text(
				theme.fg(
					"muted",
					"AIRIS can read/edit files and run checks in trusted projects. It still asks before risky actions.",
				),
				1,
				0,
			),
		);
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("accent", "Quick start"), 1, 0));
		this.addChild(new Text(theme.fg("muted", QUICK_START_LINES.map((line) => `  ${line}`).join("\n")), 1, 0));
		this.addChild(new Spacer(1));

		if (this.step === "theme") {
			this.addChild(new Text(theme.fg("text", "Pick a theme to get started."), 1, 0));
			this.addChild(new Text(theme.fg("muted", `Detected system appearance: ${this.options.detectedTheme}`), 1, 0));
			this.addChild(new Spacer(1));
			this.addOptionList(
				THEME_OPTIONS.map((option) => option.label),
				this.themeIndex,
			);
		} else {
			this.addChild(new Text(theme.fg("text", "Help improve AIRIS by sharing anonymous usage data?"), 1, 0));
			this.addChild(
				new Text(
					theme.fg(
						"muted",
						"Opting in stores a tracking identifier in settings.json and enables anonymous usage analytics. Change it anytime in settings.json.",
					),
					1,
					0,
				),
			);
			this.addChild(new Spacer(1));
			this.addOptionList(
				ANALYTICS_OPTIONS.map((option) => option.label),
				this.analyticsIndex,
			);
		}

		this.addChild(new Spacer(1));
		this.addChild(
			new Text(
				rawKeyHint("↑↓", "navigate") +
					"  " +
					keyHint("tui.select.confirm", this.step === "theme" ? "continue" : "finish") +
					"  " +
					keyHint("tui.select.cancel", "skip setup"),
				1,
				0,
			),
		);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());
	}

	private addOptionList(labels: string[], selectedIndex: number): void {
		for (let i = 0; i < labels.length; i++) {
			const isSelected = i === selectedIndex;
			const prefix = isSelected ? theme.fg("accent", "→ ") : "  ";
			const label = isSelected ? theme.fg("accent", labels[i]) : theme.fg("text", labels[i]);
			this.addChild(new Text(`${prefix}${label}`, 1, 0));
		}
	}

	private moveSelection(delta: number): void {
		if (this.step === "theme") {
			const next = Math.max(0, Math.min(THEME_OPTIONS.length - 1, this.themeIndex + delta));
			if (next !== this.themeIndex) {
				this.themeIndex = next;
				this.options.onThemePreview(THEME_OPTIONS[this.themeIndex].value);
			}
		} else {
			this.analyticsIndex = Math.max(0, Math.min(ANALYTICS_OPTIONS.length - 1, this.analyticsIndex + delta));
		}
		this.update();
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		if (kb.matches(keyData, "tui.select.up")) {
			this.moveSelection(-1);
		} else if (kb.matches(keyData, "tui.select.down")) {
			this.moveSelection(1);
		} else if (kb.matches(keyData, "tui.select.confirm")) {
			if (this.step === "theme") {
				this.step = "analytics";
				this.update();
			} else {
				this.options.onSubmit({
					theme: THEME_OPTIONS[this.themeIndex].value,
					shareAnalytics: ANALYTICS_OPTIONS[this.analyticsIndex].value,
				});
			}
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			this.options.onCancel();
		}
	}
}
