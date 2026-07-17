/**
 * Tests for Health Service — System health checks, diagnostics, and status reporting
 */

import { describe, expect, it } from "vitest";
import {
	collectDiagnostics,
	formatDiagnostics,
	formatHealthReport,
	runHealthChecks,
} from "../src/core/health-service.ts";
import type { SlashCommandInfo } from "../src/core/slash-commands.ts";

describe("Health Service", () => {
	describe("runHealthChecks", () => {
		it("returns a report with all checks", () => {
			const report = runHealthChecks();
			expect(report).toBeDefined();
			expect(report.timestamp).toBeDefined();
			expect(report.checks.length).toBeGreaterThanOrEqual(4);
			expect(["ok", "warn", "error"]).toContain(report.overall);
		});

		it("includes agent-directory check", () => {
			const report = runHealthChecks();
			const check = report.checks.find((c) => c.name === "agent-directory");
			expect(check).toBeDefined();
			expect(check!.status).toMatch(/ok|warn|error/);
		});

		it("includes memory check", () => {
			const report = runHealthChecks();
			const check = report.checks.find((c) => c.name === "memory");
			expect(check).toBeDefined();
			expect(check!.message).toContain("Memory usage");
		});

		it("includes core-tools check", () => {
			const report = runHealthChecks();
			const check = report.checks.find((c) => c.name === "core-tools");
			expect(check).toBeDefined();
			expect(check!.status).toBe("ok");
			expect(check!.details?.tools).toBeDefined();
		});

		it("includes additional checks when provided", () => {
			const report = runHealthChecks({
				additionalChecks: [{ name: "custom-check", status: "ok", message: "Custom check passed" }],
			});
			const check = report.checks.find((c) => c.name === "custom-check");
			expect(check).toBeDefined();
			expect(check!.status).toBe("ok");
		});

		it("sets overall to warn when there are warnings", () => {
			const report = runHealthChecks({
				additionalChecks: [{ name: "warn-check", status: "warn", message: "Warning" }],
			});
			expect(report.overall).toBe("warn");
			expect(report.summary.warn).toBeGreaterThanOrEqual(1);
		});

		it("sets overall to error when there are errors", () => {
			const report = runHealthChecks({
				additionalChecks: [{ name: "error-check", status: "error", message: "Error" }],
			});
			expect(report.overall).toBe("error");
			expect(report.summary.error).toBeGreaterThanOrEqual(1);
		});
	});

	describe("formatHealthReport", () => {
		it("formats ok report", () => {
			const report = runHealthChecks();
			const formatted = formatHealthReport(report);
			expect(formatted).toContain("AIRIS Health Check");
			expect(formatted).toContain(report.timestamp);
			expect(formatted).toContain("Summary:");
		});

		it("includes check messages", () => {
			const report = runHealthChecks();
			const formatted = formatHealthReport(report);
			for (const check of report.checks) {
				expect(formatted).toContain(check.message);
			}
		});
	});

	describe("collectDiagnostics", () => {
		const mockCommands: SlashCommandInfo[] = [
			{ name: "health", description: "Health check", source: "builtin", sourceInfo: { source: "builtin" } },
			{ name: "stats", description: "Stats", source: "builtin", sourceInfo: { source: "builtin" } },
		];

		it("collects version info", () => {
			const info = collectDiagnostics({
				version: "0.79.9",
				slashCommands: mockCommands,
				extensionCount: 5,
				skillCount: 3,
				activeToolNames: ["read", "bash", "edit", "write"],
				sessionCount: 2,
			});
			expect(info.version).toBe("0.79.9");
			expect(info.sessionCount).toBe(2);
			expect(info.extensionCount).toBe(5);
			expect(info.skillCount).toBe(3);
		});

		it("includes active tools", () => {
			const info = collectDiagnostics({
				version: "1.0",
				slashCommands: mockCommands,
				extensionCount: 0,
				skillCount: 0,
				activeToolNames: ["read", "bash"],
				sessionCount: 0,
			});
			expect(info.activeTools).toContain("read");
			expect(info.activeTools).toContain("bash");
		});

		it("includes all available commands", () => {
			const info = collectDiagnostics({
				version: "1.0",
				slashCommands: mockCommands,
				extensionCount: 0,
				skillCount: 0,
				activeToolNames: [],
				sessionCount: 0,
			});
			expect(info.availableCommands).toContain("/health");
			expect(info.availableCommands).toContain("/stats");
		});

		it("includes system info", () => {
			const info = collectDiagnostics({
				version: "1.0",
				slashCommands: [],
				extensionCount: 0,
				skillCount: 0,
				activeToolNames: [],
				sessionCount: 0,
			});
			expect(info.systemInfo.platform).toBeDefined();
			expect(info.systemInfo.nodeVersion).toBeDefined();
			expect(info.systemInfo.uptime).toBeGreaterThanOrEqual(0);
		});
	});

	describe("formatDiagnostics", () => {
		it("formats diagnostic info", () => {
			const info = collectDiagnostics({
				version: "0.79.9",
				slashCommands: [
					{ name: "test", description: "Test", source: "builtin", sourceInfo: { source: "builtin" } },
				],
				extensionCount: 1,
				skillCount: 2,
				activeToolNames: ["read", "bash"],
				sessionCount: 3,
			});
			const formatted = formatDiagnostics(info);
			expect(formatted).toContain("AIRIS Diagnostics");
			expect(formatted).toContain("Version: 0.79.9");
			expect(formatted).toContain("Sessions: 3");
			expect(formatted).toContain("Extensions loaded: 1");
			expect(formatted).toContain("Skills loaded: 2");
			expect(formatted).toContain("Active tools:");
		});
	});
});
