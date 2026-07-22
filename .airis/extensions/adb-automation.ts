/**
 * ADB Automation Extension
 *
 * Registers Android Automation tools via ADB shell commands.
 * Does NOT require the Python bridge — uses native `adb` commands directly.
 * Also integrates Termux:API when available for notification/toast/clipboard.
 */

import { Type } from "@sufiyan-sabeel/airis-ai";
import type { ExtensionAPI } from "@sufiyan-sabeel/airis-cli";
import { execSync } from "node:child_process";

/** Run an adb command and return trimmed stdout. */
function adb(args: string[], timeoutMs = 15_000): string {
	const result = execSync(`adb ${args.join(" ")}`, {
		encoding: "utf-8",
		timeout: timeoutMs,
		stdio: ["ignore", "pipe", "pipe"],
	});
	return result.trim();
}

/** Check if ADB device is connected. */
function isDeviceConnected(): boolean {
	try {
		const out = adb(["devices"]);
		return out.includes("\tdevice");
	} catch {
		return false;
	}
}

/** Get screen size via ADB. */
function getScreenSize(): { width: number; height: number } | null {
	try {
		const raw = adb(["shell", "wm", "size"]);
		const match = raw.match(/(\d+)x(\d+)/);
		if (match) return { width: Number(match[2]), height: Number(match[1]) };
		return null;
	} catch {
		return null;
	}
}

/** Common app packages for quick reference */
const COMMON_APPS: Record<string, string> = {
	settings: "com.android.settings",
	camera: "com.android.camera2",
	whatsapp: "com.whatsapp",
	chrome: "com.android.chrome",
	youtube: "com.google.android.youtube",
	maps: "com.google.android.apps.maps",
	photos: "com.google.android.apps.photos",
	gmail: "com.google.android.gm",
	clock: "com.google.android.deskclock",
	calculator: "com.google.android.calculator",
	calendar: "com.google.android.calendar",
	contacts: "com.android.contacts",
	phone: "com.android.dialer",
	messages: "com.android.messaging",
	files: "com.android.filemanager",
	playstore: "com.android.vending",
	termux: "com.termux",
};

const deviceCheck = {
	name: "check-device",
	label: "Check Device",
	description: "Check if an Android device is connected via ADB and report its status.",
	parameters: Type.Object({}),
	async execute() {
		if (!isDeviceConnected()) {
			const msg =
				"No Android device connected via ADB.\nEnsure USB debugging or wireless debugging is enabled.\nRun: adb devices";
			return { content: [{ type: "text" as const, text: msg }] };
		}
		const size = getScreenSize();
		let info = "Android device connected.\n";
		if (size) info += `Screen: ${size.width}x${size.height}\n`;
		info += "Use other automation tools to interact with the device.";
		return { content: [{ type: "text" as const, text: info }] };
	},
};

const adbTap = {
	name: "adb-tap",
	label: "ADB Tap",
	description: "Tap at screen coordinates via ADB.",
	parameters: Type.Object({
		x: Type.Number({ description: "X coordinate" }),
		y: Type.Number({ description: "Y coordinate" }),
	}),
	async execute(_toolCallId: string, params: { x: number; y: number }) {
		try {
			adb(["shell", "input", "tap", String(params.x), String(params.y)]);
			return { content: [{ type: "text" as const, text: `Tapped at (${params.x}, ${params.y})` }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Tap failed: ${e}` }] };
		}
	},
};

const adbSwipe = {
	name: "adb-swipe",
	label: "ADB Swipe",
	description: "Swipe/drag from one coordinate to another via ADB.",
	parameters: Type.Object({
		x1: Type.Number({ description: "Start X" }),
		y1: Type.Number({ description: "Start Y" }),
		x2: Type.Number({ description: "End X" }),
		y2: Type.Number({ description: "End Y" }),
		duration: Type.Optional(Type.Number({ description: "Duration in ms", default: 300 })),
	}),
	async execute(
		_toolCallId: string,
		params: { x1: number; y1: number; x2: number; y2: number; duration?: number },
	) {
		try {
			const dur = params.duration ?? 300;
			adb(["shell", "input", "swipe", String(params.x1), String(params.y1), String(params.x2), String(params.y2), String(dur)]);
			return {
				content: [
					{
						type: "text" as const,
						text: `Swiped from (${params.x1},${params.y1}) to (${params.x2},${params.y2}) over ${dur}ms`,
					},
				],
			};
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Swipe failed: ${e}` }] };
		}
	},
};

const adbInputText = {
	name: "adb-input-text",
	label: "ADB Input Text",
	description: "Type text into the focused field via ADB.",
	parameters: Type.Object({
		text: Type.String({ description: "Text to type" }),
	}),
	async execute(_toolCallId: string, params: { text: string }) {
		try {
			// Escape single quotes for shell
			const safe = params.text.replace(/'/g, "'\\''");
			adb(["shell", "input", "text", `'${safe}'`]);
			return { content: [{ type: "text" as const, text: `Typed: "${params.text}"` }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Input failed: ${e}` }] };
		}
	},
};

const adbKeyEvent = {
	name: "adb-keyevent",
	label: "ADB Key Event",
	description: "Send a key event via ADB (e.g. HOME=3, BACK=4, MENU=1, POWER=26, VOLUME_UP=24, VOLUME_DOWN=25, ENTER=66, DEL=67).",
	parameters: Type.Object({
		keycode: Type.Number({ description: "Android keycode to send" }),
	}),
	async execute(_toolCallId: string, params: { keycode: number }) {
		try {
			adb(["shell", "input", "keyevent", String(params.keycode)]);
			return { content: [{ type: "text" as const, text: `Sent keyevent ${params.keycode}` }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Keyevent failed: ${e}` }] };
		}
	},
};

const adbOpenApp = {
	name: "adb-open-app",
	label: "ADB Open App",
	description: "Open an Android app by name or package.",
	parameters: Type.Object({
		app: Type.String({
			description:
				"App name (settings, camera, whatsapp, chrome, youtube, maps, gmail, termux) or full package name",
		}),
	}),
	async execute(_toolCallId: string, params: { app: string }) {
		const pkg = COMMON_APPS[params.app.toLowerCase()] ?? params.app;
		try {
			adb(["shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"]);
			return { content: [{ type: "text" as const, text: `Opened app: ${pkg}` }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Open app failed: ${e}` }] };
		}
	},
};

const adbScreenshot = {
	name: "adb-screenshot",
	label: "ADB Screenshot",
	description: "Take a screenshot via ADB and save to a file.",
	parameters: Type.Object({
		path: Type.Optional(Type.String({ description: "Save path (default: /sdcard/screenshot.png)" })),
	}),
	async execute(_toolCallId: string, params: { path?: string }) {
		const savePath = params.path || "/sdcard/screenshot.png";
		try {
			adb(["shell", "screencap", "-p", savePath]);
			return { content: [{ type: "text" as const, text: `Screenshot saved to ${savePath}` }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Screenshot failed: ${e}` }] };
		}
	},
};

const adbBattery = {
	name: "adb-battery",
	label: "ADB Battery",
	description: "Check battery status via ADB dumpsys.",
	parameters: Type.Object({}),
	async execute() {
		try {
			const raw = adb(["shell", "dumpsys", "battery"]);
			const level = raw.match(/level:\s*(\d+)/)?.[1] ?? "?";
			const temp = raw.match(/temperature:\s*(\d+)/)?.[1] ?? "?";
			const status = raw.match(/AC powered:\s*(true|false)/)?.[1] ?? "?";
			return {
				content: [
					{
						type: "text" as const,
						text: `Battery: ${level}%\nTemperature: ${temp ? `${(Number(temp) / 10).toFixed(1)}°C` : "?"}\nCharging: ${status}`,
					},
				],
			};
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Battery check failed: ${e}` }] };
		}
	},
};

const adbDumpUi = {
	name: "adb-dump-ui",
	label: "ADB Dump UI",
	description: "Get current UI hierarchy XML via ADB uiautomator dump.",
	parameters: Type.Object({}),
	async execute() {
		try {
			adb(["shell", "uiautomator", "dump", "/sdcard/ui.xml"]);
			adb(["shell", "cat", "/sdcard/ui.xml"]);
			return {
				content: [{ type: "text" as const, text: "UI hierarchy dumped to /sdcard/ui.xml. Use adb shell cat /sdcard/ui.xml to view." }],
			};
		} catch (e) {
			return { content: [{ type: "text" as const, text: `UI dump failed: ${e}` }] };
		}
	},
};

/** Termux:API integration tools */
const termuxNotify = {
	name: "termux-notify",
	label: "Termux Notify",
	description: "Send an Android notification via Termux:API.",
	parameters: Type.Object({
		title: Type.String({ description: "Notification title" }),
		content: Type.String({ description: "Notification body" }),
		priority: Type.Optional(Type.String({ enum: ["high", "default", "low", "min"] })),
	}),
	async execute(
		_toolCallId: string,
		params: { title: string; content: string; priority?: string },
	) {
		try {
			const args = ["--title", params.title, "--content", params.content];
			if (params.priority) args.push("--priority", params.priority);
			execSync(`termux-notification ${args.join(" ")}`, { stdio: "ignore" });
			return { content: [{ type: "text" as const, text: `Notification sent: ${params.title}` }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Notification failed: ${e}` }] };
		}
	},
};

const termuxToast = {
	name: "termux-toast",
	label: "Termux Toast",
	description: "Show a brief toast popup via Termux:API.",
	parameters: Type.Object({
		text: Type.String({ description: "Toast message" }),
		short: Type.Optional(Type.Boolean({ description: "Short duration", default: true })),
		position: Type.Optional(Type.String({ enum: ["top", "middle", "bottom"] })),
	}),
	async execute(
		_toolCallId: string,
		params: { text: string; short?: boolean; position?: string },
	) {
		try {
			const args: string[] = [];
			if (!params.short) args.push("-s");
			if (params.position) args.push("-g", params.position);
			args.push(params.text);
			execSync(`termux-toast ${args.join(" ")}`, { stdio: "ignore" });
			return { content: [{ type: "text" as const, text: "Toast shown." }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Toast failed: ${e}` }] };
		}
	},
};

const termuxTts = {
	name: "termux-tts",
	label: "Termux TTS",
	description: "Speak text aloud via Termux:API text-to-speech.",
	parameters: Type.Object({
		text: Type.String({ description: "Text to speak" }),
	}),
	async execute(_toolCallId: string, params: { text: string }) {
		try {
			execSync(`termux-tts-speak "${params.text.replace(/"/g, '\\"')}"`, { stdio: "ignore" });
			return { content: [{ type: "text" as const, text: `Speaking: "${params.text}"` }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `TTS failed: ${e}` }] };
		}
	},
};

const termuxClipboard = {
	name: "termux-clipboard",
	label: "Termux Clipboard",
	description: "Copy text to the Android clipboard via Termux:API.",
	parameters: Type.Object({
		text: Type.String({ description: "Text to copy" }),
	}),
	async execute(_toolCallId: string, params: { text: string }) {
		try {
			execSync(`echo "${params.text.replace(/"/g, '\\"')}" | termux-clipboard-set`, { stdio: "ignore" });
			return { content: [{ type: "text" as const, text: "Copied to clipboard." }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Clipboard failed: ${e}` }] };
		}
	},
};

const termuxVibrate = {
	name: "termux-vibrate",
	label: "Termux Vibrate",
	description: "Vibrate the device via Termux:API.",
	parameters: Type.Object({
		duration: Type.Optional(Type.Number({ description: "Duration in ms", default: 200 })),
	}),
	async execute(_toolCallId: string, params: { duration?: number }) {
		try {
			execSync(`termux-vibrate -d ${params.duration ?? 200}`, { stdio: "ignore" });
			return { content: [{ type: "text" as const, text: "Vibrated." }] };
		} catch (e) {
			return { content: [{ type: "text" as const, text: `Vibrate failed: ${e}` }] };
		}
	},
};

export default function (airis: ExtensionAPI): void {
	// ADB automation tools
	airis.registerTool(deviceCheck);
	airis.registerTool(adbTap);
	airis.registerTool(adbSwipe);
	airis.registerTool(adbInputText);
	airis.registerTool(adbKeyEvent);
	airis.registerTool(adbOpenApp);
	airis.registerTool(adbScreenshot);
	airis.registerTool(adbBattery);
	airis.registerTool(adbDumpUi);

	// Termux:API tools
	airis.registerTool(termuxNotify);
	airis.registerTool(termuxToast);
	airis.registerTool(termuxTts);
	airis.registerTool(termuxClipboard);
	airis.registerTool(termuxVibrate);
}
