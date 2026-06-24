/**
 * AIRIS Natural Language Automation Engine
 *
 * Intercepts natural-language input in chat mode, detects Android automation
 * intents, plans multi-step tasks, executes them via the Python/ADB bridge,
 * and returns formatted results to the chat.
 *
 * If the input is not an automation request, returns null so the normal
 * AI chat flow continues.
 */

import { executeAndroidAction, formatResponse } from "./androidBridge.ts";
import { isAndroidAutomationRequest, isDevelopmentTaskRequest } from "./androidIntentRouter.ts";
import type { AndroidBridgeResponse } from "./types.ts";

export interface NlAutomationResult {
	/** The formatted chat message to display */
	chatMessage: string;
	/** Whether the automation was successful */
	ok: boolean;
	/** Raw bridge response for logging/debugging */
	response: AndroidBridgeResponse;
}

/**
 * Process a natural-language chat message.
 *
 * Returns an NlAutomationResult if the message is an Android automation request,
 * or null if it should be handled by normal AI chat.
 */
export async function processNlInput(text: string): Promise<NlAutomationResult | null> {
	const trimmed = text.trim();
	if (!trimmed) return null;

	// Step 0: Check for development tasks first - don't route to Android automation
	if (isDevelopmentTaskRequest(trimmed)) {
		return null;
	}

	// Step 1: Detect intent
	const detection = isAndroidAutomationRequest(trimmed);
	if (!detection) return null;

	const { intent } = detection;

	// Step 2: Safety check - blocked terms
	if (intent.safety === "blocked") {
		return {
			chatMessage:
				"I cannot automate that request because it contains sensitive or destructive actions (passwords, payments, account changes, data deletion, etc.).",
			ok: false,
			response: {
				ok: false,
				action: intent.action,
				message: "Blocked by safety rules",
			},
		};
	}

	// Step 3: Execute the action(s)
	try {
		const response = await executeAndroidAction(intent.action, intent.params);

		if (response.ok) {
			const formatted = formatResponse(response);
			return {
				chatMessage: formatted,
				ok: true,
				response,
			};
		}

		// Action failed
		const errorMsg = response.message || "Android automation failed.";
		const helpMsg = response.help
			? `\n${response.help}`
			: "\nCheck that ADB is installed, a device is connected, and developer options / wireless debugging is enabled.";
		return {
			chatMessage: `${errorMsg}${helpMsg}`,
			ok: false,
			response,
		};
	} catch (err: unknown) {
		const errMsg = err instanceof Error ? err.message : String(err);
		return {
			chatMessage: `Android automation error: ${errMsg}\nCheck that Python 3 and ADB are installed and a device is connected.`,
			ok: false,
			response: {
				ok: false,
				action: intent.action,
				message: errMsg,
			},
		};
	}
}

/**
 * Check if a text string looks like it could be an Android automation request
 * (fast check without executing anything).
 */
export function isLikelyAutomation(text: string): boolean {
	const trimmed = text.trim().toLowerCase();
	if (!trimmed) return false;

	// Quick keyword check
	const keywords = [
		"open ",
		"launch ",
		"go ",
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
		"screenshot",
		"flashlight",
		"torch",
		"home",
		"back",
		"recent",
		"settings",
		"camera",
		"whatsapp",
		"youtube",
		"read screen",
		"check device",
		"battery",
		"turn on",
		"turn off",
		"ui dump",
	];

	return keywords.some((kw) => trimmed.includes(kw));
}
