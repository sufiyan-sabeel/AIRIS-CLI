/**
 * Audit Log - Structured event logging for tool calls, model interactions, and errors.
 *
 * Logs are appended to a JSONL file at ~/.airis/agent/audit.jsonl.
 * Each line is a JSON object with a common structure for easy parsing.
 *
 * Features:
 * - Automatic tool call logging (before/after with duration)
 * - Model response logging (provider, model, usage, errors)
 * - Session event logging (start, end, errors)
 * - Configurable via settings: audit.enabled, audit.maxEntries
 * - Rotating log file (trims to maxEntries on each write)
 * - /audit status, /audit export, /audit clear commands
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AssistantMessage, ToolResultMessage } from "@sufiyan-sabeel/airis-ai";
import { getAgentDir } from "../config.ts";

// ============================================================================
// Types
// ============================================================================

export type AuditEntryType =
	| "session_start"
	| "session_end"
	| "tool_call"
	| "tool_result"
	| "model_request"
	| "model_response"
	| "model_error"
	| "error"
	| "info";

export interface AuditEntry {
	timestamp: string;
	type: AuditEntryType;
	sessionId: string;
	data: Record<string, unknown>;
}

export interface AuditLogStats {
	totalEntries: number;
	firstEntry: string | null;
	lastEntry: string | null;
	entryTypes: Record<string, number>;
	storagePath: string;
	storageSizeBytes: number;
}

export interface AuditLogConfig {
	enabled: boolean;
	maxEntries: number;
	logDir?: string;
}

const DEFAULT_CONFIG: AuditLogConfig = {
	enabled: true,
	maxEntries: 10000,
};

// ============================================================================
// AuditLog class
// ============================================================================

export class AuditLog {
	private _config: AuditLogConfig;
	private _sessionId: string;
	private _logPath: string;
	private _entriesWritten = 0;

	constructor(sessionId: string, config?: Partial<AuditLogConfig>) {
		this._sessionId = sessionId;
		this._config = { ...DEFAULT_CONFIG, ...config };

		const agentDir = this._config.logDir ?? getAgentDir();
		const logDir = join(agentDir);
		if (!existsSync(logDir)) {
			mkdirSync(logDir, { recursive: true });
		}
		this._logPath = join(logDir, "audit.jsonl");
	}

	get logPath(): string {
		return this._logPath;
	}

	get entriesWritten(): number {
		return this._entriesWritten;
	}

	get config(): AuditLogConfig {
		return { ...this._config };
	}

	/** Set config at runtime */
	configure(config: Partial<AuditLogConfig>): void {
		this._config = { ...this._config, ...config };
	}

	/** Log an audit entry */
	log(type: AuditEntryType, data: Record<string, unknown>): void {
		if (!this._config.enabled) return;

		const entry: AuditEntry = {
			timestamp: new Date().toISOString(),
			type,
			sessionId: this._sessionId,
			data,
		};

		try {
			appendFileSync(this._logPath, JSON.stringify(entry) + "\n");
			this._entriesWritten++;

			// Rotate if exceeded max entries
			if (this._entriesWritten >= this._config.maxEntries) {
				this._rotate();
			}
		} catch (err) {
			// Silently fail - audit should never crash the application
			console.error(`Audit log write failed: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/** Log a tool call */
	logToolCall(toolName: string, toolCallId: string, input: Record<string, unknown>): void {
		this.log("tool_call", {
			toolName,
			toolCallId,
			input: this._sanitizeInput(input),
		});
	}

	/** Log a tool result */
	logToolResult(toolName: string, toolCallId: string, isError: boolean, details?: unknown): void {
		this.log("tool_result", {
			toolName,
			toolCallId,
			isError,
		});
	}

	/** Log a model request */
	logModelRequest(provider: string, modelId: string, inputTokens: number): void {
		this.log("model_request", {
			provider,
			model: modelId,
			inputTokens,
		});
	}

	/** Log a model response */
	logModelResponse(message: AssistantMessage): void {
		this.log("model_response", {
			provider: message.provider,
			model: message.model,
			stopReason: message.stopReason,
			errorMessage: message.errorMessage,
			usage: message.usage,
		});
	}

	/** Log a model error */
	logModelError(provider: string, modelId: string, errorMessage: string): void {
		this.log("model_error", {
			provider,
			model: modelId,
			errorMessage,
		});
	}

	/** Log a generic error */
	logError(context: string, errorMessage: string, details?: Record<string, unknown>): void {
		this.log("error", {
			context,
			errorMessage,
			...(details ?? {}),
		});
	}

	/** Log an info event */
	logEvent(eventName: string, details?: Record<string, unknown>): void {
		this.log("info", {
			event: eventName,
			...(details ?? {}),
		});
	}

	// ======================================================================
	// Stats & Management
	// ======================================================================

	/** Get audit log statistics */
	getStats(): AuditLogStats {
		const entryTypes: Record<string, number> = {};
		let firstEntry: string | null = null;
		let lastEntry: string | null = null;
		let totalEntries = 0;

		if (existsSync(this._logPath)) {
			const content = readFileSync(this._logPath, "utf-8").trimEnd();
			if (content) {
				const lines = content.split("\n");
				totalEntries = lines.length;
				for (const line of lines) {
					try {
						const entry = JSON.parse(line) as AuditEntry;
						entryTypes[entry.type] = (entryTypes[entry.type] ?? 0) + 1;
						if (!firstEntry) firstEntry = entry.timestamp;
						lastEntry = entry.timestamp;
					} catch {
						// Skip malformed lines
					}
				}
			}
		}

		const stats: AuditLogStats = {
			totalEntries,
			firstEntry,
			lastEntry,
			entryTypes,
			storagePath: this._logPath,
			storageSizeBytes: existsSync(this._logPath) ? readFileSync(this._logPath).length : 0,
		};

		return stats;
	}

	/** Export audit log as formatted text */
	exportText(options?: { since?: string; type?: AuditEntryType; limit?: number }): string {
		if (!existsSync(this._logPath)) return "Audit log is empty.";

		const content = readFileSync(this._logPath, "utf-8").trimEnd();
		if (!content) return "Audit log is empty.";

		const lines = content.split("\n");
		let entries: AuditEntry[] = [];

		for (const line of lines) {
			try {
				const entry = JSON.parse(line) as AuditEntry;
				entries.push(entry);
			} catch {
				// Skip malformed lines
			}
		}

		// Apply filters
		if (options?.since) {
			const sinceMs = new Date(options.since).getTime();
			entries = entries.filter((e) => new Date(e.timestamp).getTime() >= sinceMs);
		}
		if (options?.type) {
			entries = entries.filter((e) => e.type === options.type);
		}
		if (options?.limit && options.limit > 0) {
			entries = entries.slice(-options.limit);
		}

		if (entries.length === 0) return "No matching audit entries found.";

		const result: string[] = [];
		for (const entry of entries) {
			result.push(`[${entry.timestamp}] ${entry.type} | ${JSON.stringify(entry.data)}`);
		}

		return result.join("\n");
	}

	/** Clear the audit log (with rotation backup) */
	clear(): void {
		if (existsSync(this._logPath)) {
			// Rename as backup before clearing
			try {
				const backupPath = this._logPath + ".bak";
				renameSync(this._logPath, backupPath);
			} catch {
				// If rename fails, just delete
				try {
					unlinkSync(this._logPath);
				} catch {
					// Ignore
				}
			}
		}
		this._entriesWritten = 0;
	}

	// ======================================================================
	// Internal
	// ======================================================================

	/** Rotate log: keep the last maxEntries/2 entries */
	private _rotate(): void {
		try {
			if (!existsSync(this._logPath)) return;
			const content = readFileSync(this._logPath, "utf-8");
			const lines = content.trimEnd().split("\n");
			const keep = Math.max(this._config.maxEntries / 2, 100);
			const trimmed = lines.slice(-keep);
			writeFileSync(this._logPath, trimmed.join("\n") + "\n");
			this._entriesWritten = trimmed.length;
		} catch {
			// Silently fail rotation
		}
	}

	/** Sanitize sensitive data from tool inputs before logging */
	private _sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		const sensitiveKeys = ["api_key", "apiKey", "password", "token", "secret", "auth"];

		for (const [key, value] of Object.entries(input)) {
			if (typeof value === "string" && sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
				result[key] = "***";
			} else if (typeof value === "object" && value !== null) {
				result[key] = this._sanitizeInput(value as Record<string, unknown>);
			} else {
				result[key] = value;
			}
		}
		return result;
	}
}

/** Create shared audit log instance */
let _sharedAuditLog: AuditLog | null = null;

export function getSharedAuditLog(sessionId: string): AuditLog {
	if (!_sharedAuditLog) {
		_sharedAuditLog = new AuditLog(sessionId);
	}
	return _sharedAuditLog;
}
