import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { AgentTool } from "@sufiyan-sabeel/airis-agent-core";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.ts";
import { invalidArgText } from "./render-utils.ts";
import { wrapToolDefinition } from "./tool-definition-wrapper.ts";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const toastSchema = Type.Object({
	message: Type.String({
		description: "Text to display in the toast notification (up to ~50 characters for optimal display)",
	}),
	duration: Type.Optional(
		Type.Union([Type.Literal("short"), Type.Literal("long")], {
			description: "Toast duration. 'short' (~2s, default) or 'long' (~3.5s)",
		}),
	),
});

export type ToastToolInput = Static<typeof toastSchema>;

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export interface ToastToolDetails {
	available: boolean;
}

export interface ToastOperations {
	/** Check if termux-toast is available on this system */
	isAvailable: () => boolean;
	/** Execute termux-toast with the given message and duration */
	show: (message: string, duration: "short" | "long") => { exitCode: number | null; stderr: string };
}

const defaultToastOperations: ToastOperations = {
	isAvailable: () => {
		if (process.platform !== "android" && process.platform !== "linux") return false;
		return existsSync("/data/data/com.termux/files/usr/bin/termux-toast") || existsSync("/system/bin/termux-toast");
	},
	show: (message, duration) => {
		const args = ["-g", "top", message];
		if (duration === "long") args.push("-s");
		const result = spawnSync("termux-toast", args, {
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10_000,
			encoding: "utf-8",
		});
		return { exitCode: result.status, stderr: result.stderr ?? "" };
	},
};

export interface ToastToolOptions {
	operations?: ToastOperations;
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

function buildDefinition(operations: ToastOperations): ToolDefinition<typeof toastSchema, ToastToolDetails> {
	const available = operations.isAvailable();

	return {
		name: "toast",
		label: "Toast",
		description: [
			"Display an Android toast notification (brief popup at the top of the screen).",
			"Only works on Android devices with Termux:API installed (`pkg install termux-api`).",
			"On other platforms this tool reports that it is unavailable.",
		].join(" "),
		parameters: toastSchema,
		promptSnippet: available ? "**toast**: Show an Android toast notification popup on device screen" : undefined,
		promptGuidelines: available
			? [
					"- Use `toast` to display short confirmation or notification messages on Android devices.",
					"- The toast appears briefly at the top of the screen. Keep messages concise (~50 chars).",
					"- Not available on desktop platforms (Linux/macOS/Windows).",
				]
			: undefined,
		prepareArguments: (args: unknown): Static<typeof toastSchema> => {
			const input = args as Record<string, unknown>;
			if (typeof input?.message !== "string" || input.message.length === 0) {
				throw invalidArgText("toast", "message must be a non-empty string");
			}
			return {
				message: input.message,
				duration: input.duration === "long" ? "long" : "short",
			} as Static<typeof toastSchema>;
		},
		execute: async (_toolCallId, params, signal) => {
			if (signal?.aborted) {
				return { type: "text", text: "Operation aborted" };
			}

			if (!available) {
				return {
					type: "text",
					text: "Toast notifications are only available on Android devices with Termux:API installed (`pkg install termux-api`). This system does not support termux-toast.",
				};
			}

			const { message, duration } = params as Static<typeof toastSchema>;
			const truncated = message.length > 50 ? message.slice(0, 47) + "..." : message;
			const { exitCode, stderr } = operations.show(truncated, duration ?? "short");

			if (exitCode !== 0) {
				const details = stderr ? `: ${stderr.trim()}` : "";
				return {
					type: "text",
					text: `Toast notification failed (exit ${exitCode})${details}`,
				};
			}

			return {
				type: "text",
				text: `Toast notification displayed: "${truncated}"`,
			};
		},
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createToastTool(options?: ToastToolOptions): AgentTool<typeof toastSchema, ToastToolDetails> {
	const operations = options?.operations ?? defaultToastOperations;
	return wrapToolDefinition(buildToastToolDefinition(operations));
}

export function createToastToolDefinition(
	options?: ToastToolOptions,
): ToolDefinition<typeof toastSchema, ToastToolDetails> {
	const operations = options?.operations ?? defaultToastOperations;
	return buildToastToolDefinition(operations);
}

export function createToastToolDefinition(
	options?: ToastToolOptions,
): ToolDefinition<typeof toastSchema, ToastToolDetails> {
	const operations = options?.operations ?? defaultToastOperations;
	return buildDefinition(operations);
}
