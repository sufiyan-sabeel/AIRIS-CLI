/**
 * Tests for the Self-Debug Brain functionality.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { ErrorContext } from "../src/core/adaptive/self-debug.ts";
import { SelfDebugBrain } from "../src/core/adaptive/self-debug.ts";

describe("SelfDebugBrain", () => {
	let brain: SelfDebugBrain;

	beforeEach(() => {
		brain = new SelfDebugBrain();
	});

	describe("analyzeError", () => {
		it("should analyze a syntax error correctly", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-1",
				args: { command: "tsc --noEmit" },
				errorMessage: "error TS1005: ';' expected",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);

			expect(analysis.category).toBe("syntax");
			expect(analysis.severity).toBe("medium");
			expect(analysis.rootCause).toBeDefined();
			expect(analysis.suggestedFixes.length).toBeGreaterThan(0);
		});

		it("should analyze a network error correctly", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-2",
				args: { command: "curl https://api.example.com" },
				errorMessage: "ECONNREFUSED 127.0.0.1:443",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);

			expect(analysis.category).toBe("network");
			expect(analysis.severity).toBe("high");
		});

		it("should analyze a permission error correctly", () => {
			const context: ErrorContext = {
				toolName: "write",
				toolCallId: "test-3",
				args: { path: "/etc/passwd" },
				errorMessage: "EACCES: permission denied",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);

			expect(analysis.category).toBe("permission");
			expect(analysis.severity).toBe("high");
		});

		it("should analyze a timeout error correctly", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-3b",
				args: { command: "npm run check" },
				errorMessage: "Command timed out after 120 seconds",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);

			expect(analysis.category).toBe("runtime");
			expect(analysis.severity).toBe("high");
			expect(analysis.rootCause).toContain("timed out");
		});

		it("should prefer related files when generating fixes", () => {
			const context: ErrorContext = {
				toolName: "edit",
				toolCallId: "test-3c",
				args: { filePath: "packages/coding-agent/src/core/adaptive/self-debug.ts" },
				errorMessage: "Failed to edit: oldText does not match",
				timestamp: Date.now(),
				cwd: "/test",
				relatedFiles: ["packages/coding-agent/src/core/adaptive/self-debug.ts"],
			};

			const analysis = brain.analyzeError(context);

			expect(analysis.affectedFiles).toContain("packages/coding-agent/src/core/adaptive/self-debug.ts");
			const investigationFix = analysis.suggestedFixes[analysis.suggestedFixes.length - 1];
			expect(investigationFix?.actions[0]?.path).toBe("packages/coding-agent/src/core/adaptive/self-debug.ts");
		});

		it("should detect recurring errors", () => {
			const context1: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-4",
				args: {},
				errorMessage: "Module not found: 'react'",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const context2: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-5",
				args: {},
				errorMessage: "Module not found: 'react'",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const firstAnalysis = brain.analyzeError(context1);
			expect(firstAnalysis.isRecurring).toBe(false);

			const analysis = brain.analyzeError(context2);
			expect(analysis.isRecurring).toBe(true);
		});
	});

	describe("createDebugSession", () => {
		it("should create a debug session", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-6",
				args: {},
				errorMessage: "Test error",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);
			const session = brain.createDebugSession(context, analysis);

			expect(session.id).toBeDefined();
			expect(session.status).toBe("in_progress");
			expect(session.attempts).toEqual([]);
		});
	});

	describe("recordAttempt", () => {
		it("should record a successful attempt", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-7",
				args: {},
				errorMessage: "Test error",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);
			const session = brain.createDebugSession(context, analysis);

			const updatedSession = brain.recordAttempt(
				session.id,
				{ type: "bash", command: "npm install" },
				"success",
				"Installed successfully",
			);

			expect(updatedSession).toBeDefined();
			expect(updatedSession!.status).toBe("resolved");
			expect(updatedSession!.attempts.length).toBe(1);
		});

		it("should record a failed attempt", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-8",
				args: {},
				errorMessage: "Test error",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);
			const session = brain.createDebugSession(context, analysis);

			const updatedSession = brain.recordAttempt(
				session.id,
				{ type: "bash", command: "npm install" },
				"failure",
				"Installation failed",
			);

			expect(updatedSession).toBeDefined();
			expect(updatedSession!.status).toBe("in_progress");
			expect(updatedSession!.attempts.length).toBe(1);
		});

		it("should not abandon after skipped attempts", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-8b",
				args: {},
				errorMessage: "Test error",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);
			const session = brain.createDebugSession(context, analysis);

			brain.recordAttempt(session.id, { type: "bash", command: "cmd1" }, "failure");
			brain.recordAttempt(session.id, { type: "bash", command: "cmd2" }, "failure");
			const updatedSession = brain.recordAttempt(session.id, { type: "bash", command: "cmd3" }, "skipped");

			expect(updatedSession!.status).toBe("in_progress");
		});

		it("should abandon after max attempts", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-9",
				args: {},
				errorMessage: "Test error",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);
			const session = brain.createDebugSession(context, analysis);

			// Record 3 failed attempts
			brain.recordAttempt(session.id, { type: "bash", command: "cmd1" }, "failure");
			brain.recordAttempt(session.id, { type: "bash", command: "cmd2" }, "failure");
			const finalSession = brain.recordAttempt(session.id, { type: "bash", command: "cmd3" }, "failure");

			expect(finalSession!.status).toBe("abandoned");
		});
	});

	describe("formatDebugContext", () => {
		it("should format debug context correctly", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-10",
				args: {},
				errorMessage: "Test error message",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);
			const session = brain.createDebugSession(context, analysis);
			const formatted = brain.formatDebugContext(analysis, session);

			expect(formatted).toContain("## Self-Debug Analysis");
			expect(formatted).toContain(session.id);
			expect(formatted).toContain("Category:");
			expect(formatted).toContain("Severity:");
			expect(formatted).toContain("Root Cause Hypothesis:");
		});
	});

	describe("getDebugInstructions", () => {
		it("should return debug instructions", () => {
			const context: ErrorContext = {
				toolName: "bash",
				toolCallId: "test-11",
				args: {},
				errorMessage: "Test error",
				timestamp: Date.now(),
				cwd: "/test",
			};

			const analysis = brain.analyzeError(context);
			const instructions = brain.getDebugInstructions(analysis);

			expect(instructions).toContain("## Self-Debug Mode Active");
			expect(instructions).toContain("Understand the Error");
			expect(instructions).toContain("Apply Fix");
			expect(instructions).toContain("Verify");
			expect(instructions).toContain("Only mark the debug session resolved after verification passes.");
		});
	});

	describe("getStats", () => {
		it("should return correct statistics", () => {
			// Add some errors
			brain.analyzeError({
				toolName: "bash",
				toolCallId: "test-12",
				args: {},
				errorMessage: "Error 1",
				timestamp: Date.now(),
				cwd: "/test",
			});

			brain.analyzeError({
				toolName: "bash",
				toolCallId: "test-13",
				args: {},
				errorMessage: "Error 2",
				timestamp: Date.now(),
				cwd: "/test",
			});

			const stats = brain.getStats();

			expect(stats.totalErrors).toBe(2);
			expect(stats.resolved).toBe(0);
			expect(stats.abandoned).toBe(0);
		});
	});

	describe("clearHistory", () => {
		it("should clear all history", () => {
			brain.analyzeError({
				toolName: "bash",
				toolCallId: "test-14",
				args: {},
				errorMessage: "Error",
				timestamp: Date.now(),
				cwd: "/test",
			});

			brain.clearHistory();

			const stats = brain.getStats();
			expect(stats.totalErrors).toBe(0);
		});
	});
});
