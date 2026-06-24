/**
 * AIRIS Prefix-Based Router
 *
 * Parses user input to determine routing mode based on explicit prefixes:
 *   @automation  → Android automation (single-step)
 *   @coding      → Repository coding/editing
 *   @multiauto   → Multi-step Android automation (immediate, no confirmation)
 *   (no prefix)  → Normal chat
 */

export type RouteMode = "CHAT" | "AUTOMATION" | "CODING" | "MULTI_AUTO";

export interface RouteResult {
	mode: RouteMode;
	/** User text with the prefix stripped. */
	taskText: string;
}

const ROUTE_PREFIXES: Array<{ prefix: RegExp; mode: RouteMode }> = [
	{ prefix: /^@automation\s*/i, mode: "AUTOMATION" },
	{ prefix: /^@coding\s*/i, mode: "CODING" },
	{ prefix: /^@multiauto\s*/i, mode: "MULTI_AUTO" },
];

const ROUTE_LOG_PREFIXES: Record<RouteMode, string> = {
	CHAT: "ROUTE: CHAT",
	AUTOMATION: "ROUTE: AUTOMATION",
	CODING: "ROUTE: CODING",
	MULTI_AUTO: "ROUTE: MULTI_AUTO",
};

/** Parse user text into a route mode and stripped task text. */
export function parseRoute(text: string): RouteResult {
	const trimmed = text.trim();
	if (!trimmed) {
		return { mode: "CHAT", taskText: trimmed };
	}

	for (const { prefix, mode } of ROUTE_PREFIXES) {
		if (prefix.test(trimmed)) {
			const taskText = trimmed.replace(prefix, "").trim();
			return { mode, taskText };
		}
	}

	return { mode: "CHAT", taskText: trimmed };
}

/** Get the log-friendly prefix string for a route mode. */
export function getRouteLogPrefix(mode: RouteMode): string {
	return ROUTE_LOG_PREFIXES[mode];
}
