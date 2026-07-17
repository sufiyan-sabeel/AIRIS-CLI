import { spawnSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { AgentTool, AgentToolResult } from "@sufiyan-sabeel/airis-agent-core";
import { type Static, Type } from "typebox";
import type { ExtensionContext, ToolDefinition } from "../extensions/types.ts";
import { wrapToolDefinition } from "./tool-definition-wrapper.ts";

// ---------------------------------------------------------------------------
// Common: Termux:API availability check
// ---------------------------------------------------------------------------

function isTermuxAvailable(): boolean {
	if (process.platform !== "android" && process.platform !== "linux") return false;
	return (
		existsSync("/data/data/com.termux/files/usr/bin/termux-notification") ||
		existsSync("/system/bin/termux-notification")
	);
}

function runTermuxCommand(args: string[], timeoutMs = 15_000): { exitCode: number | null; stdout: string; stderr: string } {
	const result = spawnSync("termux-notification", args, {
		stdio: ["ignore", "pipe", "pipe"],
		timeout: timeoutMs,
		encoding: "utf-8",
	});
	return {
		exitCode: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

// Generic Termux:API command executor
function execTermux(cmd: string, timeoutMs = 15_000): { exitCode: number | null; stdout: string; stderr: string } {
	const result = spawnSync("sh", ["-c", cmd], {
		stdio: ["ignore", "pipe", "pipe"],
		timeout: timeoutMs,
		encoding: "utf-8",
	});
	return {
		exitCode: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

const termuxNotifySchema = Type.Object({
	title: Type.String({ description: "Notification title" }),
	content: Type.String({ description: "Notification body text" }),
	priority: Type.Optional(Type.Union([Type.Literal("high"), Type.Literal("default"), Type.Literal("low"), Type.Literal("min")], { description: "Notification priority" })),
	id: Type.Optional(Type.String({ description: "Unique notification ID" })),
	button1: Type.Optional(Type.String({ description: "Button 1 label" })),
	button1Action: Type.Optional(Type.String({ description: "Button 1 action command" })),
	button2: Type.Optional(Type.String({ description: "Button 2 label" })),
	button2Action: Type.Optional(Type.String({ description: "Button 2 action command" })),
});

const termuxToastSchema = Type.Object({
	text: Type.String({ description: "Toast message" }),
	short: Type.Optional(Type.Boolean({ description: "Short duration (default: true)", default: true })),
	position: Type.Optional(Type.Union([Type.Literal("top"), Type.Literal("middle"), Type.Literal("bottom")], { description: "Toast position" })),
});

const termuxTtsSchema = Type.Object({
	text: Type.String({ description: "Text to speak" }),
	rate: Type.Optional(Type.Number({ description: "Speech rate (0.5-2.0)", default: 1.0 })),
	pitch: Type.Optional(Type.Number({ description: "Speech pitch (0.5-2.0)", default: 1.0 })),
	locale: Type.Optional(Type.String({ description: "Language locale (e.g., en-US)" })),
	engine: Type.Optional(Type.String({ description: "TTS engine name" })),
});

const termuxTtsEnginesSchema = Type.Object({});

const termuxVibrateSchema = Type.Object({
	duration: Type.Optional(Type.Number({ description: "Vibration duration in ms", default: 200 })),
	force: Type.Optional(Type.Boolean({ description: "Force vibration even in silent mode", default: false })),
});

const termuxClipboardSetSchema = Type.Object({
	text: Type.String({ description: "Text to copy to clipboard" }),
});

const termuxClipboardGetSchema = Type.Object({});

const termuxOpenUrlSchema = Type.Object({
	url: Type.String({ description: "URL to open in default browser" }),
});

const termuxShareSchema = Type.Object({
	text: Type.Optional(Type.String({ description: "Text to share" })),
	file: Type.Optional(Type.String({ description: "File path to share" })),
	title: Type.Optional(Type.String({ description: "Chooser dialog title" })),
});

const termuxBatteryStatusSchema = Type.Object({});

const termuxLocationSchema = Type.Object({
	provider: Type.Optional(Type.Union([Type.Literal("gps"), Type.Literal("network"), Type.Literal("passive")], { description: "Location provider", default: "gps" })),
	request: Type.Optional(Type.Union([Type.Literal("single"), Type.Literal("update"), Type.Literal("last")], { description: "Request type", default: "single" })),
});

const termuxCameraPhotoSchema = Type.Object({
	camera: Type.Optional(Type.Number({ description: "Camera ID (0=back, 1=front)", default: 0 })),
	output: Type.String({ description: "Output file path" }),
});

const termuxCameraInfoSchema = Type.Object({});

const termuxSensorSchema = Type.Object({
	sensor: Type.String({ description: "Sensor name (e.g., Accelerometer, Gyroscope, Light)" }),
	count: Type.Optional(Type.Number({ description: "Number of readings", default: 1 })),
	delay: Type.Optional(Type.Number({ description: "Delay between readings in ms", default: 100 })),
});

const termuxSensorListSchema = Type.Object({});

const termuxSensorCleanupSchema = Type.Object({});

const termuxDialogSchema = Type.Object({
	type: Type.Union([
		Type.Literal("text"),
		Type.Literal("confirm"),
		Type.Literal("sheet"),
		Type.Literal("radio"),
		Type.Literal("checkbox"),
		Type.Literal("date"),
		Type.Literal("time"),
		Type.Literal("counter"),
	], { description: "Dialog type" }),
	title: Type.Optional(Type.String({ description: "Dialog title" })),
	text: Type.Optional(Type.String({ description: "Dialog text / prompt" })),
	values: Type.Optional(Type.String({ description: "Comma-separated values for sheet/radio/checkbox" })),
	default: Type.Optional(Type.String({ description: "Default value for text/counter" })),
	min: Type.Optional(Type.String({ description: "Minimum value for counter" })),
	max: Type.Optional(Type.String({ description: "Maximum value for counter" })),
});

const termuxTelephonyDeviceInfoSchema = Type.Object({});

const termuxWifiConnectionInfoSchema = Type.Object({});

const termuxWifiScanInfoSchema = Type.Object({});

const termuxAudioInfoSchema = Type.Object({});

const termuxBrightnessSchema = Type.Object({
	level: Type.Number({ description: "Brightness level (0-255)" }),
});

const termuxMediaScanSchema = Type.Object({
	file: Type.String({ description: "File path to scan for media database" }),
});

const termuxStorageGetSchema = Type.Object({
	output: Type.String({ description: "Output file path" }),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type TermuxNotifyInput = Static<typeof termuxNotifySchema>;
export type TermuxToastInput = Static<typeof termuxToastSchema>;
export type TermuxTtsInput = Static<typeof termuxTtsSchema>;
export type TermuxTtsEnginesInput = Static<typeof termuxTtsEnginesSchema>;
export type TermuxVibrateInput = Static<typeof termuxVibrateSchema>;
export type TermuxClipboardSetInput = Static<typeof termuxClipboardSetSchema>;
export type TermuxClipboardGetInput = Static<typeof termuxClipboardGetSchema>;
export type TermuxOpenUrlInput = Static<typeof termuxOpenUrlSchema>;
export type TermuxShareInput = Static<typeof termuxShareSchema>;
export type TermuxBatteryStatusInput = Static<typeof termuxBatteryStatusSchema>;
export type TermuxLocationInput = Static<typeof termuxLocationSchema>;
export type TermuxCameraPhotoInput = Static<typeof termuxCameraPhotoSchema>;
export type TermuxCameraInfoInput = Static<typeof termuxCameraInfoSchema>;
export type TermuxSensorInput = Static<typeof termuxSensorSchema>;
export type TermuxSensorListInput = Static<typeof termuxSensorListSchema>;
export type TermuxSensorCleanupInput = Static<typeof termuxSensorCleanupSchema>;
export type TermuxDialogInput = Static<typeof termuxDialogSchema>;
export type TermuxTelephonyDeviceInfoInput = Static<typeof termuxTelephonyDeviceInfoSchema>;
export type TermuxWifiConnectionInfoInput = Static<typeof termuxWifiConnectionInfoSchema>;
export type TermuxWifiScanInfoInput = Static<typeof termuxWifiScanInfoSchema>;
export type TermuxAudioInfoInput = Static<typeof termuxAudioInfoSchema>;
export type TermuxBrightnessInput = Static<typeof termuxBrightnessSchema>;
export type TermuxMediaScanInput = Static<typeof termuxMediaScanSchema>;
export type TermuxStorageGetInput = Static<typeof termuxStorageGetSchema>;

export interface TermuxToolDetails {
	available: boolean;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

interface TermuxNotifyOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxNotifyInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxToastOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxToastInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxTtsOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxTtsInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxTtsEnginesOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxVibrateOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxVibrateInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxClipboardSetOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxClipboardSetInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxClipboardGetOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxOpenUrlOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxOpenUrlInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxShareOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxShareInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxBatteryStatusOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxLocationOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxLocationInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxCameraPhotoOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxCameraPhotoInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxCameraInfoOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxSensorOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxSensorInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxSensorListOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxSensorCleanupOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxDialogOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxDialogInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxTelephonyDeviceInfoOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxWifiConnectionInfoOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxWifiScanInfoOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxAudioInfoOperations {
	isAvailable: () => boolean;
	execute: () => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxBrightnessOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxBrightnessInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxMediaScanOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxMediaScanInput) => { exitCode: number | null; stdout: string; stderr: string };
}

interface TermuxStorageGetOperations {
	isAvailable: () => boolean;
	execute: (params: TermuxStorageGetInput) => { exitCode: number | null; stdout: string; stderr: string };
}

const defaultTermuxNotifyOps: TermuxNotifyOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => {
		const args = ["--title", params.title, "--content", params.content];
		if (params.priority) args.push("--priority", params.priority);
		if (params.id) args.push("--id", params.id);
		if (params.button1) args.push("--button1", params.button1);
		if (params.button1Action) args.push("--button1-action", params.button1Action);
		if (params.button2) args.push("--button2", params.button2);
		if (params.button2Action) args.push("--button2-action", params.button2Action);
		return execTermux(`termux-notification ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`);
	},
};

const defaultTermuxToastOps: TermuxToastOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => {
		const args = [];
		if (!params.short) args.push("-s");
		if (params.position) args.push("-g", params.position);
		args.push(params.text);
		return execTermux(`termux-toast ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`);
	},
};

const defaultTermuxTtsOps: TermuxTtsOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => {
		const args = [];
		if (params.rate) args.push("-r", String(params.rate));
		if (params.pitch) args.push("-p", String(params.pitch));
		if (params.locale) args.push("-l", params.locale);
		if (params.engine) args.push("-n", params.engine);
		args.push(params.text);
		return execTermux(`termux-tts-speak ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`);
	},
};

const defaultTermuxTtsEnginesOps: TermuxTtsEnginesOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-tts-engines"),
};

const defaultTermuxVibrateOps: TermuxVibrateOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => {
		const args = ["-d", String(params.duration ?? 200)];
		if (params.force) args.push("-f");
		return execTermux(`termux-vibrate ${args.join(" ")}`);
	},
};

const defaultTermuxClipboardSetOps: TermuxClipboardSetOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => execTermux(`echo '${params.text.replace(/'/g, "'\\''")}' | termux-clipboard-set`),
};

const defaultTermuxClipboardGetOps: TermuxClipboardGetOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-clipboard-get"),
};

const defaultTermuxOpenUrlOps: TermuxOpenUrlOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => execTermux(`termux-open-url '${params.url.replace(/'/g, "'\\''")}'`),
};

const defaultTermuxShareOps: TermuxShareOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => {
		const args = [];
		if (params.text) args.push("-a", `'${params.text.replace(/'/g, "'\\''")}'`);
		if (params.file) args.push("-f", `'${params.file.replace(/'/g, "'\\''")}'`);
		if (params.title) args.push("-c", `'${params.title.replace(/'/g, "'\\''")}'`);
		return execTermux(`termux-share ${args.join(" ")}`);
	},
};

const defaultTermuxBatteryStatusOps: TermuxBatteryStatusOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-battery-status"),
};

const defaultTermuxLocationOps: TermuxLocationOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => {
		const args = [];
		if (params.provider) args.push("-p", params.provider);
		if (params.request) args.push("-r", params.request);
		return execTermux(`termux-location ${args.join(" ")}`);
	},
};

const defaultTermuxCameraPhotoOps: TermuxCameraPhotoOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => execTermux(`termux-camera-photo -c ${params.camera ?? 0} '${params.output.replace(/'/g, "'\\''")}'`),
};

const defaultTermuxCameraInfoOps: TermuxCameraInfoOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-camera-info"),
};

const defaultTermuxSensorOps: TermuxSensorOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => execTermux(`termux-sensor -s '${params.sensor.replace(/'/g, "'\\''")}' -n ${params.count ?? 1} -d ${params.delay ?? 100}`),
};

const defaultTermuxSensorListOps: TermuxSensorListOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-sensor -l"),
};

const defaultTermuxSensorCleanupOps: TermuxSensorCleanupOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-sensor -c"),
};

const defaultTermuxDialogOps: TermuxDialogOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => {
		const args = [params.type];
		if (params.title) args.push("-t", `'${params.title.replace(/'/g, "'\\''")}'`);
		if (params.text) args.push("-i", `'${params.text.replace(/'/g, "'\\''")}'`);
		if (params.values) args.push("-v", `'${params.values.replace(/'/g, "'\\''")}'`);
		if (params.default) args.push("-i", `'${params.default.replace(/'/g, "'\\''")}'`);
		if (params.min) args.push("--min", params.min);
		if (params.max) args.push("--max", params.max);
		return execTermux(`termux-dialog ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`);
	},
};

const defaultTermuxTelephonyDeviceInfoOps: TermuxTelephonyDeviceInfoOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-telephony-deviceinfo"),
};

const defaultTermuxWifiConnectionInfoOps: TermuxWifiConnectionInfoOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-wifi-connectioninfo"),
};

const defaultTermuxWifiScanInfoOps: TermuxWifiScanInfoOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-wifi-scaninfo"),
};

const defaultTermuxAudioInfoOps: TermuxAudioInfoOperations = {
	isAvailable: isTermuxAvailable,
	execute: () => execTermux("termux-audio-info"),
};

const defaultTermuxBrightnessOps: TermuxBrightnessOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => execTermux(`termux-brightness ${params.level}`),
};

const defaultTermuxMediaScanOps: TermuxMediaScanOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => execTermux(`termux-media-scan -f '${params.file.replace(/'/g, "'\\''")}'`),
};

const defaultTermuxStorageGetOps: TermuxStorageGetOperations = {
	isAvailable: isTermuxAvailable,
	execute: (params) => execTermux(`termux-storage-get -o '${params.output.replace(/'/g, "'\\''")}'`),
};

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

function buildTermuxDefinition<T extends Type.Static<Type.AnyType>>(
	name: string,
	label: string,
	description: string,
	schema: Type.TSchema,
	operations: { isAvailable: () => boolean; execute: (params: T) => { exitCode: number | null; stdout: string; stderr: string } },
	promptGuidelines?: string[],
): ToolDefinition<typeof schema, TermuxToolDetails> {
	const available = operations.isAvailable();

	return {
		name,
		label,
		description,
		parameters: schema,
		promptSnippet: available ? `**${name}**: ${description}` : undefined,
		promptGuidelines: available ? promptGuidelines : undefined,
		execute: async (
			_toolCallId: string,
			params: T,
			signal: AbortSignal | undefined,
			_onUpdate: ((partialResult: AgentToolResult<TermuxToolDetails>) => void) | undefined,
			_ctx: ExtensionContext | undefined,
		): Promise<AgentToolResult<TermuxToolDetails>> => {
			if (signal?.aborted) {
				return { content: [{ type: "text", text: "Operation aborted" }], details: { available } };
			}

			if (!available) {
				return {
					content: [
						{
							type: "text",
							text: `${label} is only available on Android devices with Termux:API installed (\`pkg install termux-api\`). This system does not support Termux:API.`,
						},
					],
					details: { available },
				};
			}

			const { exitCode, stdout, stderr } = operations.execute(params);

			if (exitCode !== 0) {
				const details = stderr ? `: ${stderr.trim()}` : "";
				return {
					content: [{ type: "text", text: `${label} failed (exit ${exitCode})${details}` }],
					details: { available },
				};
			}

			const output = stdout.trim();
			return {
				content: [{ type: "text", text: output || `${label} completed successfully` }],
				details: { available },
			};
		},
	};
}

function buildTermuxSimpleDefinition(
	name: string,
	label: string,
	description: string,
	schema: Type.TSchema,
	operations: { isAvailable: () => boolean; execute: () => { exitCode: number | null; stdout: string; stderr: string } },
	promptGuidelines?: string[],
): ToolDefinition<typeof schema, TermuxToolDetails> {
	const available = operations.isAvailable();

	return {
		name,
		label,
		description,
		parameters: schema,
		promptSnippet: available ? `**${name}**: ${description}` : undefined,
		promptGuidelines: available ? promptGuidelines : undefined,
		execute: async (
			_toolCallId: string,
			_params: never,
			signal: AbortSignal | undefined,
			_onUpdate: ((partialResult: AgentToolResult<TermuxToolDetails>) => void) | undefined,
			_ctx: ExtensionContext | undefined,
		): Promise<AgentToolResult<TermuxToolDetails>> => {
			if (signal?.aborted) {
				return { content: [{ type: "text", text: "Operation aborted" }], details: { available } };
			}

			if (!available) {
				return {
					content: [
						{
							type: "text",
							text: `${label} is only available on Android devices with Termux:API installed (\`pkg install termux-api\`). This system does not support Termux:API.`,
						},
					],
					details: { available },
				};
			}

			const { exitCode, stdout, stderr } = operations.execute();

			if (exitCode !== 0) {
				const details = stderr ? `: ${stderr.trim()}` : "";
				return {
					content: [{ type: "text", text: `${label} failed (exit ${exitCode})${details}` }],
					details: { available },
				};
			}

			const output = stdout.trim();
			return {
				content: [{ type: "text", text: output || `${label} completed successfully` }],
				details: { available },
			};
		},
	};
}

// ---------------------------------------------------------------------------
// Tool Creation Functions
// ---------------------------------------------------------------------------

export interface TermuxNotifyToolOptions {
	operations?: TermuxNotifyOperations;
}
export function createTermuxNotifyTool(options?: TermuxNotifyToolOptions): AgentTool<typeof termuxNotifySchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-notify",
		"Termux Notify",
		"Send an Android notification via Termux:API with title, content, priority, and optional action buttons",
		termuxNotifySchema,
		options?.operations ?? defaultTermuxNotifyOps,
		[
			"- Use termux-notify to send system notifications with titles and body text.",
			"- Supports priority levels: high, default, low, min.",
			"- Add action buttons with button1/button1Action and button2/button2Action.",
			"- Not available on desktop platforms (Linux/macOS/Windows).",
		],
	));
}
export function createTermuxNotifyToolDefinition(options?: TermuxNotifyToolOptions): ToolDefinition<typeof termuxNotifySchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-notify", "Termux Notify", "Send an Android notification via Termux:API", termuxNotifySchema, options?.operations ?? defaultTermuxNotifyOps, [
		"- Use termux-notify to send system notifications with titles and body text.",
		"- Supports priority levels: high, default, low, min.",
		"- Add action buttons with button1/button1Action and button2/button2Action.",
		"- Not available on desktop platforms (Linux/macOS/Windows).",
	]);
}

export interface TermuxToastToolOptions {
	operations?: TermuxToastOperations;
}
export function createTermuxToastTool(options?: TermuxToastToolOptions): AgentTool<typeof termuxToastSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-toast",
		"Termux Toast",
		"Show a brief toast popup on Android via Termux:API",
		termuxToastSchema,
		options?.operations ?? defaultTermuxToastOps,
		[
			"- Use termux-toast to display short popup messages on Android.",
			"- Keep messages concise (~50 chars).",
			"- Position: top, middle, bottom (default: bottom).",
			"- Duration: short (~2s) or long (~3.5s).",
			"- Not available on desktop platforms.",
		],
	));
}
export function createTermuxToastToolDefinition(options?: TermuxToastToolOptions): ToolDefinition<typeof termuxToastSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-toast", "Termux Toast", "Show a brief toast popup on Android via Termux:API", termuxToastSchema, options?.operations ?? defaultTermuxToastOps, [
		"- Use termux-toast to display short popup messages on Android.",
		"- Keep messages concise (~50 chars).",
		"- Position: top, middle, bottom (default: bottom).",
		"- Duration: short (~2s) or long (~3.5s).",
		"- Not available on desktop platforms.",
	]);
}

export interface TermuxTtsToolOptions {
	operations?: TermuxTtsOperations;
}
export function createTermuxTtsTool(options?: TermuxTtsToolOptions): AgentTool<typeof termuxTtsSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-tts",
		"Termux TTS",
		"Text-to-speech via Termux:API with rate, pitch, locale, and engine options",
		termuxTtsSchema,
		options?.operations ?? defaultTermuxTtsOps,
		[
			"- Use termux-tts to speak text aloud on Android.",
			"- Rate: 0.5-2.0 (default 1.0). Pitch: 0.5-2.0 (default 1.0).",
			"- Locale: e.g., en-US, fr-FR. Engine: from termux-tts-engines.",
			"- Not available on desktop platforms.",
		],
	));
}
export function createTermuxTtsToolDefinition(options?: TermuxTtsToolOptions): ToolDefinition<typeof termuxTtsSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-tts", "Termux TTS", "Text-to-speech via Termux:API", termuxTtsSchema, options?.operations ?? defaultTermuxTtsOps, [
		"- Use termux-tts to speak text aloud on Android.",
		"- Rate: 0.5-2.0 (default 1.0). Pitch: 0.5-2.0 (default 1.0).",
		"- Locale: e.g., en-US, fr-FR. Engine: from termux-tts-engines.",
		"- Not available on desktop platforms.",
	]);
}

export interface TermuxTtsEnginesToolOptions {
	operations?: TermuxTtsEnginesOperations;
}
export function createTermuxTtsEnginesTool(options?: TermuxTtsEnginesToolOptions): AgentTool<typeof termuxTtsEnginesSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-tts-engines",
		"Termux TTS Engines",
		"List available TTS engines via Termux:API",
		termuxTtsEnginesSchema,
		options?.operations ?? defaultTermuxTtsEnginesOps,
		["- Lists installed TTS engines on Android.", "- Use engine name with termux-tts."],
	));
}
export function createTermuxTtsEnginesToolDefinition(options?: TermuxTtsEnginesToolOptions): ToolDefinition<typeof termuxTtsEnginesSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-tts-engines", "Termux TTS Engines", "List available TTS engines via Termux:API", termuxTtsEnginesSchema, options?.operations ?? defaultTermuxTtsEnginesOps, [
		"- Lists installed TTS engines on Android.",
		"- Use engine name with termux-tts.",
	]);
}

export interface TermuxVibrateToolOptions {
	operations?: TermuxVibrateOperations;
}
export function createTermuxVibrateTool(options?: TermuxVibrateToolOptions): AgentTool<typeof termuxVibrateSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-vibrate",
		"Termux Vibrate",
		"Vibrate the Android device via Termux:API",
		termuxVibrateSchema,
		options?.operations ?? defaultTermuxVibrateOps,
		[
			"- Use termux-vibrate for haptic feedback.",
			"- Duration in ms (default 200).",
			"- Force: vibrate even in silent mode.",
			"- Not available on desktop platforms.",
		],
	));
}
export function createTermuxVibrateToolDefinition(options?: TermuxVibrateToolOptions): ToolDefinition<typeof termuxVibrateSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-vibrate", "Termux Vibrate", "Vibrate the Android device via Termux:API", termuxVibrateSchema, options?.operations ?? defaultTermuxVibrateOps, [
		"- Use termux-vibrate for haptic feedback.",
		"- Duration in ms (default 200).",
		"- Force: vibrate even in silent mode.",
		"- Not available on desktop platforms.",
	]);
}

export interface TermuxClipboardSetToolOptions {
	operations?: TermuxClipboardSetOperations;
}
export function createTermuxClipboardSetTool(options?: TermuxClipboardSetToolOptions): AgentTool<typeof termuxClipboardSetSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-clipboard-set",
		"Termux Clipboard Set",
		"Copy text to Android clipboard via Termux:API",
		termuxClipboardSetSchema,
		options?.operations ?? defaultTermuxClipboardSetOps,
		["- Copies text to system clipboard on Android.", "- Use termux-clipboard-get to read back."],
	));
}
export function createTermuxClipboardSetToolDefinition(options?: TermuxClipboardSetToolOptions): ToolDefinition<typeof termuxClipboardSetSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-clipboard-set", "Termux Clipboard Set", "Copy text to Android clipboard via Termux:API", termuxClipboardSetSchema, options?.operations ?? defaultTermuxClipboardSetOps, [
		"- Copies text to system clipboard on Android.",
		"- Use termux-clipboard-get to read back.",
	]);
}

export interface TermuxClipboardGetToolOptions {
	operations?: TermuxClipboardGetOperations;
}
export function createTermuxClipboardGetTool(options?: TermuxClipboardGetToolOptions): AgentTool<typeof termuxClipboardGetSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-clipboard-get",
		"Termux Clipboard Get",
		"Read text from Android clipboard via Termux:API",
		termuxClipboardGetSchema,
		options?.operations ?? defaultTermuxClipboardGetOps,
		["- Reads current clipboard content on Android."],
	));
}
export function createTermuxClipboardGetToolDefinition(options?: TermuxClipboardGetToolOptions): ToolDefinition<typeof termuxClipboardGetSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-clipboard-get", "Termux Clipboard Get", "Read text from Android clipboard via Termux:API", termuxClipboardGetSchema, options?.operations ?? defaultTermuxClipboardGetOps, ["- Reads current clipboard content on Android."]);
}

export interface TermuxOpenUrlToolOptions {
	operations?: TermuxOpenUrlOperations;
}
export function createTermuxOpenUrlTool(options?: TermuxOpenUrlToolOptions): AgentTool<typeof termuxOpenUrlSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-open-url",
		"Termux Open URL",
		"Open a URL in the default Android browser via Termux:API",
		termuxOpenUrlSchema,
		options?.operations ?? defaultTermuxOpenUrlOps,
		["- Opens URLs in the default browser on Android."],
	));
}
export function createTermuxOpenUrlToolDefinition(options?: TermuxOpenUrlToolOptions): ToolDefinition<typeof termuxOpenUrlSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-open-url", "Termux Open URL", "Open a URL in the default Android browser via Termux:API", termuxOpenUrlSchema, options?.operations ?? defaultTermuxOpenUrlOps, ["- Opens URLs in the default browser on Android."]);
}

export interface TermuxShareToolOptions {
	operations?: TermuxShareOperations;
}
export function createTermuxShareTool(options?: TermuxShareToolOptions): AgentTool<typeof termuxShareSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-share",
		"Termux Share",
		"Share text or files through Android share sheet via Termux:API",
		termuxShareSchema,
		options?.operations ?? defaultTermuxShareOps,
		["- Shares text or files via Android share sheet.", "- Provide text, file path, or both.", "- Custom chooser title optional."],
	));
}
export function createTermuxShareToolDefinition(options?: TermuxShareToolOptions): ToolDefinition<typeof termuxShareSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-share", "Termux Share", "Share text or files through Android share sheet via Termux:API", termuxShareSchema, options?.operations ?? defaultTermuxShareOps, ["- Shares text or files via Android share sheet.", "- Provide text, file path, or both.", "- Custom chooser title optional."]);
}

export interface TermuxBatteryStatusToolOptions {
	operations?: TermuxBatteryStatusOperations;
}
export function createTermuxBatteryStatusTool(options?: TermuxBatteryStatusToolOptions): AgentTool<typeof termuxBatteryStatusSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-battery-status",
		"Termux Battery Status",
		"Get battery status (percentage, temperature, health, etc.) via Termux:API",
		termuxBatteryStatusSchema,
		options?.operations ?? defaultTermuxBatteryStatusOps,
		["- Returns JSON with battery percentage, temperature, health, charging status, etc."],
	));
}
export function createTermuxBatteryStatusToolDefinition(options?: TermuxBatteryStatusToolOptions): ToolDefinition<typeof termuxBatteryStatusSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-battery-status", "Termux Battery Status", "Get battery status via Termux:API", termuxBatteryStatusSchema, options?.operations ?? defaultTermuxBatteryStatusOps, ["- Returns JSON with battery percentage, temperature, health, charging status, etc."]);
}

export interface TermuxLocationToolOptions {
	operations?: TermuxLocationOperations;
}
export function createTermuxLocationTool(options?: TermuxLocationToolOptions): AgentTool<typeof termuxLocationSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-location",
		"Termux Location",
		"Get GPS/network location via Termux:API",
		termuxLocationSchema,
		options?.operations ?? defaultTermuxLocationOps,
		["- Provider: gps (accurate), network (fast), passive (battery-efficient).", "- Request: single (one-time), update (continuous), last (cached).", "- Returns JSON with latitude, longitude, altitude, accuracy, etc."],
	));
}
export function createTermuxLocationToolDefinition(options?: TermuxLocationToolOptions): ToolDefinition<typeof termuxLocationSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-location", "Termux Location", "Get GPS/network location via Termux:API", termuxLocationSchema, options?.operations ?? defaultTermuxLocationOps, ["- Provider: gps (accurate), network (fast), passive (battery-efficient).", "- Request: single (one-time), update (continuous), last (cached).", "- Returns JSON with latitude, longitude, altitude, accuracy, etc."]);
}

export interface TermuxCameraPhotoToolOptions {
	operations?: TermuxCameraPhotoOperations;
}
export function createTermuxCameraPhotoTool(options?: TermuxCameraPhotoToolOptions): AgentTool<typeof termuxCameraPhotoSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-camera-photo",
		"Termux Camera Photo",
		"Take a photo using device camera via Termux:API",
		termuxCameraPhotoSchema,
		options?.operations ?? defaultTermuxCameraPhotoOps,
		["- Camera ID: 0 (back), 1 (front).", "- Specify output file path.", "- Requires camera permission."],
	));
}
export function createTermuxCameraPhotoToolDefinition(options?: TermuxCameraPhotoToolOptions): ToolDefinition<typeof termuxCameraPhotoSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-camera-photo", "Termux Camera Photo", "Take a photo using device camera via Termux:API", termuxCameraPhotoSchema, options?.operations ?? defaultTermuxCameraPhotoOps, ["- Camera ID: 0 (back), 1 (front).", "- Specify output file path.", "- Requires camera permission."]);
}

export interface TermuxCameraInfoToolOptions {
	operations?: TermuxCameraInfoOperations;
}
export function createTermuxCameraInfoTool(options?: TermuxCameraInfoToolOptions): AgentTool<typeof termuxCameraInfoSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-camera-info",
		"Termux Camera Info",
		"Get camera information via Termux:API",
		termuxCameraInfoSchema,
		options?.operations ?? defaultTermuxCameraInfoOps,
		["- Lists available cameras with IDs and capabilities."],
	));
}
export function createTermuxCameraInfoToolDefinition(options?: TermuxCameraInfoToolOptions): ToolDefinition<typeof termuxCameraInfoSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-camera-info", "Termux Camera Info", "Get camera information via Termux:API", termuxCameraInfoSchema, options?.operations ?? defaultTermuxCameraInfoOps, ["- Lists available cameras with IDs and capabilities."]);
}

export interface TermuxSensorToolOptions {
	operations?: TermuxSensorOperations;
}
export function createTermuxSensorTool(options?: TermuxSensorToolOptions): AgentTool<typeof termuxSensorSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-sensor",
		"Termux Sensor",
		"Read sensor data (accelerometer, gyroscope, light, etc.) via Termux:API",
		termuxSensorSchema,
		options?.operations ?? defaultTermuxSensorOps,
		["- Sensor name: Accelerometer, Gyroscope, Light, Proximity, etc.", "- Count: number of readings (default 1).", "- Delay: ms between readings (default 100).", "- Use termux-sensor-list to see available sensors."],
	));
}
export function createTermuxSensorToolDefinition(options?: TermuxSensorToolOptions): ToolDefinition<typeof termuxSensorSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-sensor", "Termux Sensor", "Read sensor data via Termux:API", termuxSensorSchema, options?.operations ?? defaultTermuxSensorOps, ["- Sensor name: Accelerometer, Gyroscope, Light, Proximity, etc.", "- Count: number of readings (default 1).", "- Delay: ms between readings (default 100).", "- Use termux-sensor-list to see available sensors."]);
}

export interface TermuxSensorListToolOptions {
	operations?: TermuxSensorListOperations;
}
export function createTermuxSensorListTool(options?: TermuxSensorListToolOptions): AgentTool<typeof termuxSensorListSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-sensor-list",
		"Termux Sensor List",
		"List available sensors via Termux:API",
		termuxSensorListSchema,
		options?.operations ?? defaultTermuxSensorListOps,
		["- Returns list of available sensor names."],
	));
}
export function createTermuxSensorListToolDefinition(options?: TermuxSensorListToolOptions): ToolDefinition<typeof termuxSensorListSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-sensor-list", "Termux Sensor List", "List available sensors via Termux:API", termuxSensorListSchema, options?.operations ?? defaultTermuxSensorListOps, ["- Returns list of available sensor names."]);
}

export interface TermuxSensorCleanupToolOptions {
	operations?: TermuxSensorCleanupOperations;
}
export function createTermuxSensorCleanupTool(options?: TermuxSensorCleanupToolOptions): AgentTool<typeof termuxSensorCleanupSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-sensor-cleanup",
		"Termux Sensor Cleanup",
		"Clean up sensor listeners via Termux:API",
		termuxSensorCleanupSchema,
		options?.operations ?? defaultTermuxSensorCleanupOps,
		["- Releases sensor resources after use."],
	));
}
export function createTermuxSensorCleanupToolDefinition(options?: TermuxSensorCleanupToolOptions): ToolDefinition<typeof termuxSensorCleanupSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-sensor-cleanup", "Termux Sensor Cleanup", "Clean up sensor listeners via Termux:API", termuxSensorCleanupSchema, options?.operations ?? defaultTermuxSensorCleanupOps, ["- Releases sensor resources after use."]);
}

export interface TermuxDialogToolOptions {
	operations?: TermuxDialogOperations;
}
export function createTermuxDialogTool(options?: TermuxDialogToolOptions): AgentTool<typeof termuxDialogSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-dialog",
		"Termux Dialog",
		"Show dialogs (text input, confirm, selection, date/time, counter) via Termux:API",
		termuxDialogSchema,
		options?.operations ?? defaultTermuxDialogOps,
		[
			"- Types: text, confirm, sheet, radio, checkbox, date, time, counter.",
			"- Text: single-line input with default value.",
			"- Confirm: yes/no dialog.",
			"- Sheet/radio/checkbox: selection from comma-separated values.",
			"- Date/time: native pickers.",
			"- Counter: numeric input with min/max.",
			"- Returns JSON with user response.",
		],
	));
}
export function createTermuxDialogToolDefinition(options?: TermuxDialogToolOptions): ToolDefinition<typeof termuxDialogSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-dialog", "Termux Dialog", "Show dialogs via Termux:API", termuxDialogSchema, options?.operations ?? defaultTermuxDialogOps, [
		"- Types: text, confirm, sheet, radio, checkbox, date, time, counter.",
		"- Text: single-line input with default value.",
		"- Confirm: yes/no dialog.",
		"- Sheet/radio/checkbox: selection from comma-separated values.",
		"- Date/time: native pickers.",
		"- Counter: numeric input with min/max.",
		"- Returns JSON with user response.",
	]);
}

export interface TermuxTelephonyDeviceInfoToolOptions {
	operations?: TermuxTelephonyDeviceInfoOperations;
}
export function createTermuxTelephonyDeviceInfoTool(options?: TermuxTelephonyDeviceInfoToolOptions): AgentTool<typeof termuxTelephonyDeviceInfoSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-telephony-deviceinfo",
		"Termux Telephony Device Info",
		"Get telephony device info (IMEI, network, etc.) via Termux:API",
		termuxTelephonyDeviceInfoSchema,
		options?.operations ?? defaultTermuxTelephonyDeviceInfoOps,
		["- Returns JSON with IMEI, network operator, SIM state, etc."],
	));
}
export function createTermuxTelephonyDeviceInfoToolDefinition(options?: TermuxTelephonyDeviceInfoToolOptions): ToolDefinition<typeof termuxTelephonyDeviceInfoSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-telephony-deviceinfo", "Termux Telephony Device Info", "Get telephony device info via Termux:API", termuxTelephonyDeviceInfoSchema, options?.operations ?? defaultTermuxTelephonyDeviceInfoOps, ["- Returns JSON with IMEI, network operator, SIM state, etc."]);
}

export interface TermuxWifiConnectionInfoToolOptions {
	operations?: TermuxWifiConnectionInfoOperations;
}
export function createTermuxWifiConnectionInfoTool(options?: TermuxWifiConnectionInfoToolOptions): AgentTool<typeof termuxWifiConnectionInfoSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-wifi-connectioninfo",
		"Termux WiFi Connection Info",
		"Get current WiFi connection info via Termux:API",
		termuxWifiConnectionInfoSchema,
		options?.operations ?? defaultTermuxWifiConnectionInfoOps,
		["- Returns JSON with SSID, BSSID, IP, signal strength, etc."],
	));
}
export function createTermuxWifiConnectionInfoToolDefinition(options?: TermuxWifiConnectionInfoToolOptions): ToolDefinition<typeof termuxWifiConnectionInfoSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-wifi-connectioninfo", "Termux WiFi Connection Info", "Get current WiFi connection info via Termux:API", termuxWifiConnectionInfoSchema, options?.operations ?? defaultTermuxWifiConnectionInfoOps, ["- Returns JSON with SSID, BSSID, IP, signal strength, etc."]);
}

export interface TermuxWifiScanInfoToolOptions {
	operations?: TermuxWifiScanInfoOperations;
}
export function createTermuxWifiScanInfoTool(options?: TermuxWifiScanInfoToolOptions): AgentTool<typeof termuxWifiScanInfoSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-wifi-scaninfo",
		"Termux WiFi Scan Info",
		"Scan for WiFi networks via Termux:API",
		termuxWifiScanInfoSchema,
		options?.operations ?? defaultTermuxWifiScanInfoOps,
		["- Returns JSON array of networks with SSID, BSSID, signal, frequency, etc."],
	));
}
export function createTermuxWifiScanInfoToolDefinition(options?: TermuxWifiScanInfoToolOptions): ToolDefinition<typeof termuxWifiScanInfoSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-wifi-scaninfo", "Termux WiFi Scan Info", "Scan for WiFi networks via Termux:API", termuxWifiScanInfoSchema, options?.operations ?? defaultTermuxWifiScanInfoOps, ["- Returns JSON array of networks with SSID, BSSID, signal, frequency, etc."]);
}

export interface TermuxAudioInfoToolOptions {
	operations?: TermuxAudioInfoOperations;
}
export function createTermuxAudioInfoTool(options?: TermuxAudioInfoToolOptions): AgentTool<typeof termuxAudioInfoSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxSimpleDefinition(
		"termux-audio-info",
		"Termux Audio Info",
		"Get audio info via Termux:API",
		termuxAudioInfoSchema,
		options?.operations ?? defaultTermuxAudioInfoOps,
		["- Returns JSON with audio mode, volume, etc."],
	));
}
export function createTermuxAudioInfoToolDefinition(options?: TermuxAudioInfoToolOptions): ToolDefinition<typeof termuxAudioInfoSchema, TermuxToolDetails> {
	return buildTermuxSimpleDefinition("termux-audio-info", "Termux Audio Info", "Get audio info via Termux:API", termuxAudioInfoSchema, options?.operations ?? defaultTermuxAudioInfoOps, ["- Returns JSON with audio mode, volume, etc."]);
}

export interface TermuxBrightnessToolOptions {
	operations?: TermuxBrightnessOperations;
}
export function createTermuxBrightnessTool(options?: TermuxBrightnessToolOptions): AgentTool<typeof termuxBrightnessSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-brightness",
		"Termux Brightness",
		"Set screen brightness via Termux:API",
		termuxBrightnessSchema,
		options?.operations ?? defaultTermuxBrightnessOps,
		["- Level: 0-255 (0=darkest, 255=brightest)."],
	));
}
export function createTermuxBrightnessToolDefinition(options?: TermuxBrightnessToolOptions): ToolDefinition<typeof termuxBrightnessSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-brightness", "Termux Brightness", "Set screen brightness via Termux:API", termuxBrightnessSchema, options?.operations ?? defaultTermuxBrightnessOps, ["- Level: 0-255 (0=darkest, 255=brightest)."]);
}

export interface TermuxMediaScanToolOptions {
	operations?: TermuxMediaScanOperations;
}
export function createTermuxMediaScanTool(options?: TermuxMediaScanToolOptions): AgentTool<typeof termuxMediaScanSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-media-scan",
		"Termux Media Scan",
		"Scan a file for Android media database via Termux:API",
		termuxMediaScanSchema,
		options?.operations ?? defaultTermuxMediaScanOps,
		["- Adds file to media gallery/database.", "- Useful after downloading/creating media files."],
	));
}
export function createTermuxMediaScanToolDefinition(options?: TermuxMediaScanToolOptions): ToolDefinition<typeof termuxMediaScanSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-media-scan", "Termux Media Scan", "Scan a file for Android media database via Termux:API", termuxMediaScanSchema, options?.operations ?? defaultTermuxMediaScanOps, ["- Adds file to media gallery/database.", "- Useful after downloading/creating media files."]);
}

export interface TermuxStorageGetToolOptions {
	operations?: TermuxStorageGetOperations;
}
export function createTermuxStorageGetTool(options?: TermuxStorageGetToolOptions): AgentTool<typeof termuxStorageGetSchema, TermuxToolDetails> {
	return wrapToolDefinition(buildTermuxDefinition(
		"termux-storage-get",
		"Termux Storage Get",
		"Get a file from shared storage via Termux:API",
		termuxStorageGetSchema,
		options?.operations ?? defaultTermuxStorageGetOps,
		["- Opens system file picker to select a file.", "- Saves selected file to specified output path."],
	));
}
export function createTermuxStorageGetToolDefinition(options?: TermuxStorageGetToolOptions): ToolDefinition<typeof termuxStorageGetSchema, TermuxToolDetails> {
	return buildTermuxDefinition("termux-storage-get", "Termux Storage Get", "Get a file from shared storage via Termux:API", termuxStorageGetSchema, options?.operations ?? defaultTermuxStorageGetOps, ["- Opens system file picker to select a file.", "- Saves selected file to specified output path."]);
}