import {
	AIRIS_ATTRIBUTION,
	AIRIS_TAGLINE,
	getAirisCompactLogoLines,
	getAirisLogoLines,
} from "../../../core/airis-welcome.ts";

/**
 * AIRIS Terminal Logo
 *
 * Professional ASCII art banner for the AIRIS CLI.
 * Used in the first-time setup and interactive mode header.
 */

/** Get the full professional AIRIS logo as an array of strings. */
export function getFullLogo(): string[] {
	return getAirisLogoLines();
}

/** Get a compact version of the AIRIS logo for smaller terminals. */
export function getCompactLogo(): string[] {
	return getAirisCompactLogoLines();
}

/** Get the AIRIS tagline. */
export function getTagline(): string {
	return AIRIS_TAGLINE;
}

/** Get the creator attribution line. */
export function getCreatorAttribution(): string {
	return AIRIS_ATTRIBUTION;
}

/** Get the brand line. */
export function getBrandLine(): string {
	return "Brand: KageOS";
}

/** Get the full startup banner text for CLI display (non-TUI). */
export function getCliBanner(): string {
	const line = "─".repeat(50);
	return [
		line,
		"  A I R I S  —  Artificial Intelligence Responsive Integrated System",
		`  ${AIRIS_TAGLINE}`,
		`  ${AIRIS_ATTRIBUTION}  |  Brand: KageOS`,
		line,
	].join("\n");
}

/** Get the help section separator line. */
export function getSeparator(): string {
	return "─".repeat(40);
}
