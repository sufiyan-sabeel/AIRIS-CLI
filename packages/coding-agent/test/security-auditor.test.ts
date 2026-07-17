/**
 * Tests for Security Auditor — Security audit, dependency audit, and configuration security checks
 */

import { describe, expect, it } from "vitest";
import {
	formatDependencyAudit,
	formatSecurityAudit,
	runDependencyAudit,
	runSecurityAudit,
} from "../src/core/security-auditor.ts";

describe("Security Auditor", () => {
	describe("runSecurityAudit", () => {
		it("returns a report with all checks", () => {
			const report = runSecurityAudit();
			expect(report).toBeDefined();
			expect(report.timestamp).toBeDefined();
			expect(report.checks.length).toBeGreaterThanOrEqual(6);
			expect(["ok", "warn", "error"]).toContain(report.overall);
		});

		it("includes filesystem-sandbox check", () => {
			const report = runSecurityAudit();
			const check = report.checks.find((c) => c.name === "filesystem-sandbox");
			expect(check).toBeDefined();
		});

		it("shows sandbox enabled when sandboxEnabled=true", () => {
			const report = runSecurityAudit({ sandboxEnabled: true });
			const check = report.checks.find((c) => c.name === "filesystem-sandbox");
			expect(check).toBeDefined();
			expect(check!.status).toBe("ok");
		});

		it("shows sandbox warning when sandboxEnabled=false", () => {
			const report = runSecurityAudit({ sandboxEnabled: false });
			const check = report.checks.find((c) => c.name === "filesystem-sandbox");
			expect(check).toBeDefined();
			expect(check!.status).toBe("warn");
		});

		it("includes project-trust check", () => {
			const report = runSecurityAudit();
			const check = report.checks.find((c) => c.name === "project-trust");
			expect(check).toBeDefined();
		});

		it("includes env-files check", () => {
			const report = runSecurityAudit({ cwd: "/tmp" });
			const check = report.checks.find((c) => c.name === "env-files");
			expect(check).toBeDefined();
			expect(check!.status).toMatch(/ok|warn/);
		});

		it("includes dependency-security check", () => {
			const report = runSecurityAudit({ cwd: "/tmp" });
			const check = report.checks.find((c) => c.name === "dependency-security");
			expect(check).toBeDefined();
		});

		it("includes audit-logging and shell-environment checks", () => {
			const report = runSecurityAudit();
			expect(report.checks.find((c) => c.name === "audit-logging")).toBeDefined();
			expect(report.checks.find((c) => c.name === "shell-environment")).toBeDefined();
		});

		it("includes additional checks when provided", () => {
			const report = runSecurityAudit({
				additionalChecks: [{ name: "custom", status: "warn", message: "Custom check", recommendation: "Fix it" }],
			});
			const check = report.checks.find((c) => c.name === "custom");
			expect(check).toBeDefined();
			expect(check!.status).toBe("warn");
			expect(check!.recommendation).toBe("Fix it");
		});

		it("sets overall to error when checks fail", () => {
			const report = runSecurityAudit({
				additionalChecks: [{ name: "fail", status: "error", message: "Broke" }],
			});
			expect(report.overall).toBe("error");
		});

		it("correctly tallies summary counts", () => {
			const report = runSecurityAudit({
				additionalChecks: [
					{ name: "ok1", status: "ok", message: "ok" },
					{ name: "ok2", status: "ok", message: "ok" },
				],
			});
			expect(report.summary.ok).toBeGreaterThanOrEqual(2);
		});
	});

	describe("formatSecurityAudit", () => {
		it("formats the report", () => {
			const report = runSecurityAudit();
			const formatted = formatSecurityAudit(report);
			expect(formatted).toContain("AIRIS Security Audit");
			expect(formatted).toContain("Summary:");
		});

		it("includes recommendations for warn checks", () => {
			const report = runSecurityAudit({ sandboxEnabled: false });
			const formatted = formatSecurityAudit(report);
			expect(formatted).toContain(">>");
		});
	});

	describe("runDependencyAudit", () => {
		it("returns empty audit for non-existent package.json", () => {
			const report = runDependencyAudit("/nonexistent");
			expect(report.warnings.length).toBeGreaterThanOrEqual(1);
			expect(report.dependencies).toHaveLength(0);
			expect(report.summary.total).toBe(0);
		});

		it("scans real package.json when available", () => {
			// The repo root should have a package.json
			const report = runDependencyAudit("/mnt/sdcard/Download/AIRIS-CLI");
			expect(report).toBeDefined();
			expect(report.summary.total).toBeGreaterThan(0);
			expect(report.timestamp).toBeDefined();
		});
	});

	describe("formatDependencyAudit", () => {
		it("formats empty audit", () => {
			const report = runDependencyAudit("/nonexistent");
			const formatted = formatDependencyAudit(report);
			expect(formatted).toContain("Dependency Audit Report");
			expect(formatted).toContain("Dependencies: 0");
		});

		it("formats populated audit", () => {
			const report = runDependencyAudit("/mnt/sdcard/Download/AIRIS-CLI");
			const formatted = formatDependencyAudit(report);
			expect(formatted).toContain("Dependency Audit Report");
			expect(formatted).toContain("Dependencies:");
		});
	});
});
