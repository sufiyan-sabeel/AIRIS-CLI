export interface AirisWelcomeMode {
	label: string;
	description: string;
}

export interface AirisWelcomeInfo {
	logoLines: string[];
	tagline: string;
	cwd: string;
	modes: AirisWelcomeMode[];
	attribution: string;
}

const AIRIS_LOGO_LINES = [
	"╔══════════════════════════════════╗",
	"║ ◆══════════════════════════════◆ ║",
	"║ ║ █████╗ ██╗██████╗ ██╗███████╗ ║ ║",
	"║ ║██╔══██╗██║██╔══██╗██║██╔════╝ ║ ║",
	"║ ║███████║██║██████╔╝██║███████╗ ║ ║",
	"║ ║██╔══██║██║██╔══██║██║╚════██║ ║ ║",
	"║ ║██║  ██║██║██║  ██║██║███████║ ║ ║",
	"║ ║╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝╚══════╝ ║ ║",
	"║ ◆══════════════════════════════◆ ║",
	"║ ║                                ║ ║",
	"║ ║    Artificial Intelligence     ║ ║",
	"║ ║  Responsive Integrated System  ║ ║",
	"║ ║                                ║ ║",
	"║ ║   AI Coding · Automation · CLI ║ ║",
	"║ ║      KageOS · Umaiz Sufiyan    ║ ║",
	"║ ◆══════════════════════════════◆ ║",
	"╚══════════════════════════════════╝",
] as const;

export function getAirisLogoLines(): string[] {
	return [...AIRIS_LOGO_LINES];
}

export function getAirisCompactLogoLines(): string[] {
	return [...AIRIS_COMPACT_LOGO_LINES];
}

export function getAirisModes(): AirisWelcomeMode[] {
	return AIRIS_MODES.map((mode) => ({ ...mode }));
}

export function createAirisWelcome(cwd: string): AirisWelcomeInfo {
	return {
		logoLines: getAirisLogoLines(),
		tagline: AIRIS_TAGLINE,
		cwd,
		modes: getAirisModes(),
		attribution: AIRIS_ATTRIBUTION,
	};
}

export function formatAirisWelcome(info: AirisWelcomeInfo): string {
	const modes = info.modes.map((mode) => `  - ${mode.label}: ${mode.description}`).join("\n");
	return [info.logoLines.join("\n"), info.tagline, `Project: ${info.cwd}`, "Modes:", modes, info.attribution].join(
		"\n",
	);
}
