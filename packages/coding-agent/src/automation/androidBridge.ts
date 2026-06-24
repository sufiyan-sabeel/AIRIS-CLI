/**
 * AIRIS Android Bridge
 * TypeScript -> Python bridge for ADB automation.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AndroidAction, AndroidBridgeRequest, AndroidBridgeResponse } from "./types.ts";
import { APP_PACKAGES } from "./types.ts";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const BRIDGE_TIMEOUT_MS = 35_000;

function uniquePaths(paths: string[]): string[] {
	return Array.from(new Set(paths.filter((path) => path.length > 0)));
}

/** Find Python bridge script. */
function findBridgeScript(): string {
	const envPath = process.env.AIRIS_ANDROID_BRIDGE_PATH;
	const possiblePaths = uniquePaths([
		envPath ?? "",
		join(process.cwd(), "python", "android_automation", "bridge.py"),
		join(moduleDir, "..", "python", "android_automation", "bridge.py"),
		join(moduleDir, "..", "..", "..", "..", "python", "android_automation", "bridge.py"),
		join(process.env.HOME ?? "", ".airis", "python", "android_automation", "bridge.py"),
	]);

	for (const possiblePath of possiblePaths) {
		if (existsSync(possiblePath)) {
			return possiblePath;
		}
	}

	return join(process.cwd(), "python", "android_automation", "bridge.py");
}

function resolveActionParams(
	action: AndroidAction,
	params: Record<string, string | number>,
): Record<string, string | number> {
	const resolvedParams: Record<string, string | number> = { ...params };
	if (action === "open_app" && params.app !== undefined) {
		const appName = String(params.app).toLowerCase();
		resolvedParams.package = APP_PACKAGES[appName] ?? appName;
	}
	if (action === "open_whatsapp") {
		resolvedParams.package = APP_PACKAGES.whatsapp;
	}
	if (action === "click_word" && params.text !== undefined) {
		resolvedParams.text = params.text;
	}
	return resolvedParams;
}

/** Execute Android action via Python bridge. */
export async function executeAndroidAction(
	action: AndroidAction,
	params: Record<string, string | number> = {},
): Promise<AndroidBridgeResponse> {
	const bridgeScript = findBridgeScript();
	const request: AndroidBridgeRequest = {
		action,
		...resolveActionParams(action, params),
	};

	return new Promise((resolve) => {
		const proc = spawn("python3", [bridgeScript, JSON.stringify(request)], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		const timeout = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
		}, BRIDGE_TIMEOUT_MS);

		proc.stdout.on("data", (data: Buffer) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			clearTimeout(timeout);
			if (timedOut) {
				resolve({
					ok: false,
					action,
					message: "Android automation timed out.",
					error: `Bridge exceeded ${BRIDGE_TIMEOUT_MS}ms`,
					help: "Check the connected Android device and adb state.",
				});
				return;
			}
			if (code !== 0) {
				resolve({
					ok: false,
					action,
					message: "Bridge process failed.",
					error: stderr || `Exit code: ${code}`,
					help: "Make sure Python 3 and adb are installed.",
				});
				return;
			}

			try {
				resolve(JSON.parse(stdout.trim()) as AndroidBridgeResponse);
			} catch {
				resolve({
					ok: false,
					action,
					message: "Invalid response from bridge.",
					error: stdout || stderr || "No output",
					help: "Check if the bridge script is working correctly.",
				});
			}
		});

		proc.on("error", (err) => {
			clearTimeout(timeout);
			resolve({
				ok: false,
				action,
				message: "Failed to start bridge process.",
				error: err.message,
				help: "Ensure Python 3 is installed and accessible.",
			});
		});
	});
}

/** Format Android bridge response to friendly chat message. */
export function formatResponse(response: AndroidBridgeResponse): string {
	let message = response.message;
	const text = response.data?.text;
	if (response.ok && typeof text === "string" && text.trim().length > 0) {
		message += `
${text.trim()}`;
	}
	if (!response.ok && response.error) {
		message += `
Error: ${response.error}`;
	}
	if (!response.ok && response.help) {
		message += `
${response.help}`;
	}
	return message;
} /** Get friendly description of what an action will do. */
export function getActionDescription(action: AndroidAction): string {
	const descriptions: Record<AndroidAction, string> = {
		check_device: "Checking device connection",
		screen_size: "Getting screen size",
		battery_status: "Checking battery",
		back: "Pressing back button",
		home: "Going to home screen",
		recent_apps: "Showing recent apps",
		tap: "Tapping at coordinates",
		tap_center: "Tapping center of screen",
		swipe: "Swiping on screen",
		scroll_up: "Scrolling up",
		scroll_down: "Scrolling down",
		input_text: "Typing text",
		keyevent: "Pressing key",
		open_settings: "Opening Settings",
		open_camera: "Opening Camera",
		open_whatsapp: "Opening WhatsApp",
		open_app: "Opening app",
		screenshot: "Taking screenshot",
		pull_screenshot: "Saving screenshot",
		dump_ui: "Getting UI hierarchy",
		read_screen: "Reading screen content",
		click_text: "Clicking on text",
		click_word: "Clicking on text",
		turn_flashlight_on: "Turning on flashlight",
		turn_flashlight_off: "Turning off flashlight",
		nl_execute: "Executing multi-step automation",
	};
	return descriptions[action];
}
