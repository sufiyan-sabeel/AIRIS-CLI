import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "../config.ts";

const SECRET_VALUE_RE = /(\b(?:api[_-]?key|token|secret|password|authorization)\b[\s"':=]+)([^\s"',}]+)/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/g;

export function getCliLogDir(): string {
	return join(getAgentDir(), "logs");
}

export function getAirisLogPath(): string {
	return join(getCliLogDir(), "airis.log");
}

export function getErrorsLogPath(): string {
	return join(getCliLogDir(), "errors.log");
}

export function getSessionsLogPath(): string {
	return join(getCliLogDir(), "sessions.log");
}

export function sanitizeLogText(value: string): string {
	return value.replace(SECRET_VALUE_RE, "$1[redacted]").replace(BEARER_RE, "Bearer [redacted]");
}

function sanitizeLogValue(value: unknown): unknown {
	if (typeof value === "string") {
		return sanitizeLogText(value);
	}
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeLogValue(item));
	}
	if (typeof value === "object" && value !== null) {
		const result: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			if (/api[_-]?key|token|secret|password|authorization/i.test(key)) {
				result[key] = "[redacted]";
			} else {
				result[key] = sanitizeLogValue(item);
			}
		}
		return result;
	}
	return value;
}

export function maskCliArgs(args: readonly string[]): string[] {
	const masked: string[] = [];
	let maskNext = false;
	for (const arg of args) {
		if (maskNext) {
			masked.push("[redacted]");
			maskNext = false;
			continue;
		}
		if (/^--(?:aairis-key|token|secret|password)(?:=|$)/i.test(arg)) {
			const eqIndex = arg.indexOf("=");
			masked.push(eqIndex === -1 ? arg : `${arg.slice(0, eqIndex + 1)}[redacted]`);
			maskNext = eqIndex === -1;
			continue;
		}
		masked.push(sanitizeLogText(arg));
	}
	return masked;
}

function writeStructuredLog(path: string, event: string, fields: Record<string, unknown>): void {
	try {
		mkdirSync(getCliLogDir(), { recursive: true });
		const sanitizedFields = sanitizeLogValue(fields);
		const record = {
			timestamp: new Date().toISOString(),
			event,
			...(typeof sanitizedFields === "object" && sanitizedFields !== null ? sanitizedFields : {}),
		};
		appendFileSync(path, `${JSON.stringify(record)}\n`, "utf-8");
	} catch {
		// Logging must never break the CLI.
	}
}

export function logCliEvent(event: string, fields: Record<string, unknown> = {}): void {
	writeStructuredLog(getAirisLogPath(), event, fields);
}

export function logSessionEvent(event: string, fields: Record<string, unknown> = {}): void {
	writeStructuredLog(getSessionsLogPath(), event, fields);
}

export function logCliError(error: unknown, context: Record<string, unknown> = {}): void {
	const normalized = error instanceof Error ? error : new Error(String(error));
	writeStructuredLog(getErrorsLogPath(), "error", {
		...context,
		name: normalized.name,
		message: normalized.message,
		stack: normalized.stack,
	});
}
