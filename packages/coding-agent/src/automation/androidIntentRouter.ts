/**
 * AIRIS Android Intent Router
 * Parses natural language into Android automation intents.
 */

import type { AndroidAction, AndroidIntent, IntentConfidence, SafetyCategory } from "./types.ts";
import { APP_PACKAGES, BLOCKED_TERMS, CONFIDENCE_THRESHOLDS, CONFIRM_TERMS } from "./types.ts";

/** Task type classification for intent routing */
export type TaskType = "DEVELOPMENT" | "ANDROID_AUTOMATION" | "UNKNOWN";

/** Keywords that strongly suggest repository development intent */
const DEVELOPMENT_KEYWORDS = [
	"add feature",
	"implement",
	"create module",
	"modify code",
	"edit file",
	"refactor",
	"fix bug",
	"add command",
	"update repository",
	"generate documentation",
	"typescript",
	"python",
	"git ",
	"airis-cli",
	"package",
	"source code",
	" repo",
	"project",
	"repository",
	"codebase",
	"add function",
	"create class",
	"write test",
	"debug",
	"build ",
	"compile",
	"lint",
	"format code",
	"pull request",
	"commit",
	"branch",
	"merge",
	"dependency",
	"npm ",
	"yarn ",
	"pnpm ",
	"cargo ",
	"go mod",
	"requirements.txt",
	"package.json",
	"tsconfig",
	"eslint",
	"prettier",
	"jest",
	"vitest",
	"pytest",
	"android automation",
	"automate android",
	"device automation",
	"mobile automation",
	"appium",
	"adb ",
	"uiautomator",
];

/** Keywords that strongly suggest Android automation intent */
const AUTOMATION_KEYWORDS = [
	"open ",
	"launch ",
	"go ",
	"navigate ",
	"tap ",
	"click ",
	"press ",
	"type ",
	"input ",
	"enter ",
	"write ",
	"search ",
	"scroll ",
	"swipe ",
	"home",
	"back",
	"settings",
	"camera",
	"whatsapp",
	"youtube",
	"chrome",
	"screenshot",
	"capture screen",
	"flashlight",
	"torch",
	"turn on",
	"turn off",
	"read screen",
	"check device",
];

interface IntentPattern {
	patterns: RegExp[];
	action: AndroidAction;
	confidence: IntentConfidence;
	safety: SafetyCategory;
	paramExtractor?: (match: RegExpMatchArray) => Record<string, string | number>;
	description: string | ((match: RegExpMatchArray) => string);
}

function parseInteger(value: string): number {
	return Number.parseInt(value, 10);
}

const INTENT_PATTERNS: IntentPattern[] = [
	{
		patterns: [/^check\s+(?:device|connection|phone)$/i, /^is\s+(?:device|phone)\s+connected\??$/i],
		action: "check_device",
		confidence: "high",
		safety: "allowed",
		description: "Checking Android device connection.",
	},
	{
		patterns: [/^screen\s+size$/i, /^screen\s+resolution$/i, /^display\s+size$/i],
		action: "screen_size",
		confidence: "high",
		safety: "allowed",
		description: "Getting screen dimensions.",
	},
	{
		patterns: [/^(?:go\s+)?back$/i, /^press\s+back$/i, /^navigate\s+back$/i],
		action: "back",
		confidence: "high",
		safety: "allowed",
		description: "Going back.",
	},
	{
		patterns: [/^(?:go\s+)?home$/i, /^press\s+home$/i, /^go\s+to\s+home$/i, /^home\s+screen$/i],
		action: "home",
		confidence: "high",
		safety: "allowed",
		description: "Going to home screen.",
	},
	{
		patterns: [/^recent\s+(?:apps|tasks)$/i, /^open\s+recents$/i, /^show\s+running\s+apps$/i, /^switch\s+apps$/i],
		action: "recent_apps",
		confidence: "high",
		safety: "allowed",
		description: "Showing recent apps.",
	},
	{
		patterns: [/^take\s+(?:a\s+)?screenshot$/i, /^capture\s+screen$/i, /^screenshot$/i],
		action: "screenshot",
		confidence: "high",
		safety: "allowed",
		description: "Taking screenshot.",
	},
	{
		patterns: [/^read\s+(?:the\s+)?screen\s+and\s+(?:click|tap|press)\s+["']?(.+?)["']?$/i],
		action: "click_text",
		confidence: "high",
		safety: "allowed",
		paramExtractor: (match) => ({ text: match[1].trim(), readFirst: 1 }),
		description: (match) => `Reading the screen and clicking "${match[1].trim()}".`,
	},
	{
		patterns: [
			/^read\s+(?:the\s+)?screen$/i,
			/^what(?:'s|\s+is)\s+on\s+(?:the\s+)?screen\??$/i,
			/^get\s+screen\s+text$/i,
			/^ocr$/i,
		],
		action: "read_screen",
		confidence: "high",
		safety: "allowed",
		description: "Reading screen content.",
	},
	{
		patterns: [/^scroll\s+down$/i, /^swipe\s+up$/i, /^page\s+down$/i],
		action: "scroll_down",
		confidence: "high",
		safety: "allowed",
		description: "Scrolling down.",
	},
	{
		patterns: [/^scroll\s+up$/i, /^swipe\s+down$/i, /^page\s+up$/i],
		action: "scroll_up",
		confidence: "high",
		safety: "allowed",
		description: "Scrolling up.",
	},
	{
		patterns: [
			/^swipe\s+from\s*\(?(\d{1,5})\s*[, ]\s*(\d{1,5})\s*\)?\s*to\s*\(?(\d{1,5})\s*[, ]\s*(\d{1,5})\s*\)?(?:\s+(\d{1,5})ms)?$/i,
		],
		action: "swipe",
		confidence: "high",
		safety: "allowed",
		paramExtractor: (match) => ({
			x1: parseInteger(match[1]),
			y1: parseInteger(match[2]),
			x2: parseInteger(match[3]),
			y2: parseInteger(match[4]),
			duration: match[5] ? parseInteger(match[5]) : 300,
		}),
		description: (match) => `Swiping from (${match[1]}, ${match[2]}) to (${match[3]}, ${match[4]}).`,
	},
	{
		patterns: [/^(?:tap|press|click)\s+center$/i],
		action: "tap_center",
		confidence: "high",
		safety: "allowed",
		description: "Tapping center of screen.",
	},
	{
		patterns: [/^(?:tap|press|click)\s+(?:at\s+)?\(?(\d{1,5})\s*(?:,|\s)\s*(\d{1,5})\)?$/i],
		action: "tap",
		confidence: "high",
		safety: "allowed",
		paramExtractor: (match) => ({ x: parseInteger(match[1]), y: parseInteger(match[2]) }),
		description: (match) => `Tapping at coordinates (${match[1]}, ${match[2]}).`,
	},
	{
		patterns: [/^(?:click|tap|press)(?:\s+on)?\s+["']?(.+?)["']?(?:\s+(?:button|option))?$/i],
		action: "click_text",
		confidence: "high",
		safety: "allowed",
		paramExtractor: (match) => ({ text: match[1].trim() }),
		description: (match) => `Clicking "${match[1].trim()}".`,
	},
	{
		patterns: [/^click\s+(.+)$/i],
		action: "click_word",
		confidence: "high",
		safety: "allowed",
		paramExtractor: (match) => ({ text: match[1].trim() }),
		description: (match) => `Clicking "${match[1].trim()}".`,
	},
	{
		patterns: [/^(?:type|input|enter|write)\s+["'](.+?)["']$/i, /^(?:type|input|enter|write)\s+(.+)$/i],
		action: "input_text",
		confidence: "high",
		safety: "allowed",
		paramExtractor: (match) => ({ text: match[1].trim() }),
		description: (match) => `Typing "${match[1].trim()}".`,
	},
	{
		patterns: [/^search\s+(.+)$/i, /^look\s+for\s+(.+)$/i],
		action: "input_text",
		confidence: "high",
		safety: "allowed",
		paramExtractor: (match) => ({ text: match[1].trim() }),
		description: (match) => `Searching for "${match[1].trim()}".`,
	},
	{
		patterns: [/^open\s+whats\s*app\s+and\s+search\s+(.+)$/i, /^open\s+whatsapp\s+and\s+search\s+(.+)$/i],
		action: "open_whatsapp",
		confidence: "high",
		safety: "allowed",
		paramExtractor: (match) => ({ search: match[1].trim() }),
		description: (match) => `Opening WhatsApp and searching for "${match[1].trim()}".`,
	},
	{
		patterns: [/^open\s+whats\s*app$/i, /^launch\s+whats\s*app$/i, /^open\s+whatsapp$/i, /^launch\s+whatsapp$/i],
		action: "open_whatsapp",
		confidence: "high",
		safety: "allowed",
		description: "Opening WhatsApp.",
	},
	{
		patterns: [/^open\s+(?:the\s+)?settings$/i, /^launch\s+settings$/i, /^go\s+to\s+settings$/i],
		action: "open_settings",
		confidence: "high",
		safety: "allowed",
		description: "Opening Settings.",
	},
	{
		patterns: [/^open\s+(?:the\s+)?camera$/i, /^launch\s+camera$/i, /^take\s+(?:a\s+)?photo$/i],
		action: "open_camera",
		confidence: "high",
		safety: "allowed",
		description: "Opening Camera.",
	},
	{
		patterns: [/^open\s+(.+?)\s+and\s+search\s+(.+)$/i, /^launch\s+(.+?)\s+and\s+search\s+(.+)$/i],
		action: "open_app",
		confidence: "medium",
		safety: "confirm",
		paramExtractor: (match) => ({ app: match[1].trim().toLowerCase(), search: match[2].trim() }),
		description: (match) => `Opening ${match[1].trim()} and searching for "${match[2].trim()}".`,
	},
	{
		patterns: [/^open\s+(.+?)(?:\s+app)?$/i, /^launch\s+(.+?)(?:\s+app)?$/i],
		action: "open_app",
		confidence: "low",
		safety: "confirm",
		paramExtractor: (match) => ({ app: match[1].trim().toLowerCase() }),
		description: (match) => `Opening ${match[1].trim()}.`,
	},
	{
		patterns: [
			/^(?:turn|switch)\s+off\s+(?:the\s+)?(?:flashlight|torch)$/i,
			/^(?:flashlight|torch)\s+off$/i,
			/^disable\s+(?:the\s+)?(?:flashlight|torch)$/i,
		],
		action: "turn_flashlight_off",
		confidence: "high",
		safety: "allowed",
		description: "Turning off flashlight.",
	},
	{
		patterns: [
			/^(?:turn|switch)\s+on\s+(?:the\s+)?(?:flashlight|torch)$/i,
			/^(?:flashlight|torch)\s+on$/i,
			/^enable\s+(?:the\s+)?(?:flashlight|torch)$/i,
		],
		action: "turn_flashlight_on",
		confidence: "high",
		safety: "allowed",
		description: "Turning on flashlight.",
	},
	{
		patterns: [/^(?:dump|get)\s+(?:the\s+)?ui$/i, /^ui\s+hierarchy$/i],
		action: "dump_ui",
		confidence: "high",
		safety: "allowed",
		description: "Dumping UI hierarchy.",
	},
	// Compound / multi-step patterns routed to nl_execute
	{
		patterns: [
			/^(?:open|launch)\s+.+?\s+(?:and|then)\s+(?:search|type|input|enter|write|open|tap|click).+/i,
			/^(?:turn|switch)\s+(?:on|off).+?(?:wait|after).+/i,
			/^(?:go\s+)?home.*?open.*?/i,
			/^.+?,\s+(?:and\s+)?(?:then\s+)?(.+?,\s+.+|then\s+.+)/i,
			/^.+?\s+and\s+(?:then\s+)?(?:search|type|input|enter|write|open|tap|click|turn|scroll|take).+/i,
			/^take\s+(?:a\s+)?screenshot\s+and\s+.+/i,
		],
		action: "nl_execute",
		confidence: "medium",
		safety: "allowed",
		paramExtractor: (match) => ({ text: match[0] }),
		description: (match) => `Executing multi-step automation: "${match[0]}"`,
	},
];

function normalizeAndroidText(text: string): string {
	return text
		.trim()
		.replace(/^airis\s+automation\s+/i, "")
		.replace(/^automation\s+/i, "")
		.replace(/^airis\s+chat\s+/i, "")
		.replace(/^chat\s+/i, "")
		.replace(/\s+/g, " ");
}

function containsTerm(text: string, terms: readonly string[]): boolean {
	const lower = ` ${text.toLowerCase()} `;
	return terms.some((term) => lower.includes(term));
}

function hasAutomationKeyword(text: string): boolean {
	const lower = text.toLowerCase();
	return AUTOMATION_KEYWORDS.some((kw) => lower.includes(kw));
}

function hasDevelopmentKeyword(text: string): boolean {
	const lower = text.toLowerCase();
	return DEVELOPMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Check if the text is a development task request. */
export function isDevelopmentTaskRequest(text: string): boolean {
	return hasDevelopmentKeyword(text);
}

/** Classify the task type based on the input text. */
export function classifyTaskType(text: string): TaskType {
	const trimmed = text.trim().toLowerCase();
	if (!trimmed) return "UNKNOWN";

	// Check for development keywords first (higher priority)
	if (hasDevelopmentKeyword(trimmed)) {
		console.error(`[AIRIS Router] Intent detected: DEVELOPMENT Reason: repository modification request`);
		return "DEVELOPMENT";
	}

	// Check for Android automation keywords
	if (hasAutomationKeyword(trimmed)) {
		console.error(`[AIRIS Router] Intent detected: ANDROID_AUTOMATION Reason: device control request`);
		return "ANDROID_AUTOMATION";
	}

	return "UNKNOWN";
}

function getDescription(pattern: IntentPattern, match: RegExpMatchArray): string {
	return typeof pattern.description === "function" ? pattern.description(match) : pattern.description;
}

function resolveKnownAppIntent(intent: AndroidIntent): AndroidIntent {
	if (intent.action !== "open_app") {
		return intent;
	}
	const appName = String(intent.params.app ?? "").toLowerCase();
	if (!appName || APP_PACKAGES[appName] === undefined) {
		return intent;
	}
	return {
		...intent,
		confidence: "high",
		confidencePercent: CONFIDENCE_THRESHOLDS.high,
		safety: "allowed",
	};
}

/** Parse natural language into an Android intent. */
export function parseAndroidIntent(text: string): AndroidIntent | null {
	const normalized = normalizeAndroidText(text);
	if (!normalized) {
		return null;
	}

	if (containsTerm(normalized, BLOCKED_TERMS)) {
		return {
			action: "check_device",
			confidence: "high",
			confidencePercent: CONFIDENCE_THRESHOLDS.high,
			safety: "blocked",
			params: {},
			originalText: normalized,
			description: "This request contains sensitive or destructive Android actions.",
		};
	}

	if (containsTerm(normalized, CONFIRM_TERMS)) {
		return {
			action: "check_device",
			confidence: "high",
			confidencePercent: CONFIDENCE_THRESHOLDS.high,
			safety: "confirm",
			params: {},
			originalText: normalized,
			description: "This Android action needs explicit confirmation.",
		};
	}

	for (const intentPattern of INTENT_PATTERNS) {
		for (const pattern of intentPattern.patterns) {
			const match = normalized.match(pattern);
			if (!match) {
				continue;
			}
			const intent: AndroidIntent = {
				action: intentPattern.action,
				confidence: intentPattern.confidence,
				confidencePercent: CONFIDENCE_THRESHOLDS[intentPattern.confidence],
				safety: intentPattern.safety,
				params: intentPattern.paramExtractor?.(match) ?? {},
				originalText: normalized,
				description: getDescription(intentPattern, match),
			};
			return resolveKnownAppIntent(intent);
		}
	}

	return null;
}

/** Check if the text is likely an Android automation request. */
export function isAndroidAutomationRequest(
	text: string,
): { confidence: IntentConfidence; confidencePercent: number; intent: AndroidIntent } | null {
	// Check for development tasks first - if it's a development task, don't route to Android automation
	if (isDevelopmentTaskRequest(text)) {
		return null;
	}

	const intent = parseAndroidIntent(text);
	if (!intent) {
		// Check if this looks like automation by keyword presence
		if (hasAutomationKeyword(text)) {
			return {
				confidence: "low",
				confidencePercent: CONFIDENCE_THRESHOLDS.low,
				intent: {
					action: "nl_execute",
					confidence: "low",
					confidencePercent: CONFIDENCE_THRESHOLDS.low,
					safety: "allowed",
					params: { text },
					originalText: text,
					description: "Multi-step Android automation request.",
				},
			};
		}
		return null;
	}
	return { confidence: intent.confidence, confidencePercent: intent.confidencePercent, intent };
}

/** Get a human-readable description for a blocked or confirm-safety intent. */
export function getSafetyMessage(intent: AndroidIntent): string {
	if (intent.safety === "blocked") {
		return "AIRIS: I cannot automate that Android request because it involves sensitive or destructive actions.";
	}
	return `AIRIS: This Android action requires safety review: ${intent.description}`;
}

export function getConfirmationMessage(intent: AndroidIntent): string {
	return `Confirm Android automation: ${intent.description}`;
}
