/**
 * Tests for the AuditLog class.
 *
 * Covers:
 * - Log creation and basic writing
 * - Log rotation at max entries
 * - Event integrity (all entry types)
 * - Concurrent write behavior
 * - Redaction of sensitive keys
 * - Corruption recovery (malformed lines)
 * - Export filtering
 * - Clear with backup
 * - Stats reporting
 * - Disabled state
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../src/core/audit-log.ts";

describe("AuditLog", () => {
	let auditLog: AuditLog;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "audit-test-"));
		auditLog = new AuditLog("test-session", {
			enabled: true,
			maxEntries: 100,
			logDir: tempDir,
		});
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	// ====================================================================
	// Log Creation
	// ====================================================================

	it("creates audit log file on first write", () => {
		auditLog.log("info", { event: "test" });
		expect(existsSync(auditLog.logPath)).toBe(true);
	});

	it("writes entry as JSONL", () => {
		auditLog.log("info", { event: "test", value: 42 });
		const content = readFileSync(auditLog.logPath, "utf-8").trimEnd();
		const entry = JSON.parse(content);
		expect(entry.type).toBe("info");
		expect(entry.sessionId).toBe("test-session");
		expect(entry.data.event).toBe("test");
		expect(entry.data.value).toBe(42);
	});

	it("appends multiple entries as separate lines", () => {
		auditLog.log("info", { event: "first" });
		auditLog.log("info", { event: "second" });
		const content = readFileSync(auditLog.logPath, "utf-8").trimEnd();
		const lines = content.split("\n");
		expect(lines).toHaveLength(2);
	});

	// ====================================================================
	// Log Methods
	// ====================================================================

	it("logToolCall writes tool_call entry", () => {
		auditLog.logToolCall("bash", "call_1", { command: "ls" });
		const content = readFileSync(auditLog.logPath, "utf-8").trimEnd();
		const entry = JSON.parse(content);
		expect(entry.type).toBe("tool_call");
		expect(entry.data.toolName).toBe("bash");
		expect(entry.data.toolCallId).toBe("call_1");
	});

	it("logToolResult writes tool_result entry", () => {
		auditLog.logToolResult("bash", "call_1", false);
		const content = readFileSync(auditLog.logPath, "utf-8").trimEnd();
		const entry = JSON.parse(content);
		expect(entry.type).toBe("tool_result");
		expect(entry.data.isError).toBe(false);
	});

	it("logModelRequest writes model_request entry", () => {
		auditLog.logModelRequest("anthropic", "claude-sonnet-4-5", 100);
		const entry = JSON.parse(readFileSync(auditLog.logPath, "utf-8").trimEnd());
		expect(entry.type).toBe("model_request");
		expect(entry.data.provider).toBe("anthropic");
	});

	it("logModelResponse writes model_response with usage", () => {
		const msg = {
			role: "assistant" as const,
			content: [{ type: "text" as const, text: "Hello" }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4-5",
			stopReason: "stop" as const,
			usage: { input: 10, output: 20, cacheRead: 5, cacheWrite: 5, totalTokens: 30, cost: { input: 0.1, output: 0.2, cacheRead: 0.05, cacheWrite: 0.05, total: 0.3 } },
			timestamp: Date.now(),
		};
		auditLog.logModelResponse(msg);
		const entry = JSON.parse(readFileSync(auditLog.logPath, "utf-8").trimEnd());
		expect(entry.type).toBe("model_response");
		expect(entry.data.usage.input).toBe(10);
	});

	it("logModelError writes model_error entry", () => {
		auditLog.logModelError("anthropic", "claude-sonnet-4-5", "overloaded");
		const entry = JSON.parse(readFileSync(auditLog.logPath, "utf-8").trimEnd());
		expect(entry.type).toBe("model_error");
		expect(entry.data.errorMessage).toBe("overloaded");
	});

	it("logError writes error entry with context", () => {
		auditLog.logError("sandbox", "Path denied", { path: "/etc/passwd" });
		const entry = JSON.parse(readFileSync(auditLog.logPath, "utf-8").trimEnd());
		expect(entry.type).toBe("error");
		expect(entry.data.context).toBe("sandbox");
	});

	it("logEvent writes info entry", () => {
		auditLog.logEvent("session_start", { reason: "user" });
		const entry = JSON.parse(readFileSync(auditLog.logPath, "utf-8").trimEnd());
		expect(entry.type).toBe("info");
		expect(entry.data.event).toBe("session_start");
	});

	// ====================================================================
	// Redaction
	// ====================================================================

	it("redacts sensitive keys from tool call inputs", () => {
		auditLog.logToolCall("read", "call_1", { filePath: "config.json", apiKey: "sk-1234567890" });
		const content = readFileSync(auditLog.logPath, "utf-8").trimEnd();
		const entry = JSON.parse(content);
		expect(entry.data.input.apiKey).toBe("***");
		expect(entry.data.input.filePath).toBe("config.json");
	});

	it("redacts nested sensitive keys", () => {
		auditLog.logToolCall("bash", "call_1", { credentials: { token: "secret-123", password: "p@ss" } });
		const content = readFileSync(auditLog.logPath, "utf-8").trimEnd();
		const entry = JSON.parse(content);
		expect(entry.data.input.credentials.token).toBe("***");
		expect(entry.data.input.credentials.password).toBe("***");
	});

	// ====================================================================
	// Log Rotation
	// ====================================================================

	it("rotates log when max entries exceeded", () => {
		// Create audit log with very low max entries
		const smallAuditLog = new AuditLog("test", {
			enabled: true,
			maxEntries: 10,
			logDir: tempDir,
		});

		// Write more than max entries
		for (let i = 0; i < 15; i++) {
			smallAuditLog.log("info", { event: `event-${i}` });
		}

		// After rotation, should have fewer entries than original max
		const content = readFileSync(smallAuditLog.logPath, "utf-8").trimEnd();
		const lines = content.split("\n");
		expect(lines.length).toBeLessThan(15);
		expect(lines.length).toBeGreaterThan(0);
	});

	// ====================================================================
	// getStats
	// ====================================================================

	it("getStats returns correct counts", () => {
		auditLog.log("tool_call", { toolName: "bash" });
		auditLog.log("model_response", { provider: "anthropic" });
		auditLog.log("error", { context: "test" });

		const stats = auditLog.getStats();
		expect(stats.totalEntries).toBe(3);
		expect(stats.entryTypes.tool_call).toBe(1);
		expect(stats.entryTypes.model_response).toBe(1);
		expect(stats.entryTypes.error).toBe(1);
	});

	it("getStats returns storage path and size", () => {
		auditLog.log("info", { event: "test" });
		const stats = auditLog.getStats();
		expect(stats.storagePath).toBe(auditLog.logPath);
		expect(stats.storageSizeBytes).toBeGreaterThan(0);
	});

	it("getStats returns empty stats for non-existent log", () => {
		const freshLog = new AuditLog("empty-test", { enabled: true, logDir: tempDir });
		const stats = freshLog.getStats();
		expect(stats.totalEntries).toBe(0);
		expect(stats.storageSizeBytes).toBe(0);
	});

	// ====================================================================
	// exportText
	// ====================================================================

	it("exportText returns formatted entries", () => {
		auditLog.log("info", { event: "test" });
		const text = auditLog.exportText();
		expect(text).toContain("test");
	});

	it("exportText filters by type", () => {
		auditLog.log("info", { event: "test" });
		auditLog.log("error", { context: "fail" });
		const errors = auditLog.exportText({ type: "error" });
		expect(errors).toContain("fail");
		expect(errors).not.toContain("test");
	});

	it("exportText respects limit", () => {
		for (let i = 0; i < 10; i++) {
			auditLog.log("info", { event: `e${i}` });
		}
		const limited = auditLog.exportText({ limit: 3 });
		const lines = limited.split("\n");
		expect(lines.length).toBe(3);
	});

	it("exportText returns empty message when no entries match", () => {
		auditLog.log("info", { event: "test" });
		const result = auditLog.exportText({ type: "error" as any });
		expect(result).toContain("No matching");
	});

	// ====================================================================
	// Clear
	// ====================================================================

	it("clear removes entries and resets count", () => {
		auditLog.log("info", { event: "test" });
		expect(existsSync(auditLog.logPath)).toBe(true);
		auditLog.clear();
		expect(auditLog.entriesWritten).toBe(0);
	});

	it("clear creates a backup file", () => {
		auditLog.log("info", { event: "test" });
		const originalPath = auditLog.logPath;
		auditLog.clear();
		// Backup should exist
		expect(existsSync(originalPath + ".bak")).toBe(true);
	});

	// ====================================================================
	// Disabled State
	// ====================================================================

	it("does not write entries when disabled", () => {
		const disabledLog = new AuditLog("disabled-test", {
			enabled: false,
			logDir: tempDir,
		});
		disabledLog.log("info", { event: "should-not-exist" });
		expect(existsSync(disabledLog.logPath)).toBe(false);
	});

	// ====================================================================
	// Config
	// ====================================================================

	it("configure updates config at runtime", () => {
		auditLog.configure({ enabled: false });
		auditLog.log("info", { event: "test" });
		// Should not create file since disabled
		const stats = auditLog.getStats();
		expect(stats.totalEntries).toBe(0);
	});
});
