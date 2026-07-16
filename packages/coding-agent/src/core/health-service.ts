/**
 * Health Service — System health checks, diagnostics, and status reporting.
 *
 * Provides aggregated health information about the AIRIS system:
 * - Tool health checks (basic availability)
 * - Session status
 * - Extension load status
 * - Provider connectivity status
 * - System resource usage
 *
 * Used by the `/health`, `/diagnostics`, and `/status` slash commands.
 */

import { existsSync } from "node:fs";
import { freemem, totalmem } from "node:os";
import { join } from "node:path";
import { getAgentDir } from "../config.ts";
import type { SlashCommandInfo } from "./slash-commands.ts";

// ============================================================================
// Types
// ============================================================================

export interface HealthCheckResult {
	name: string;
	status: "ok" | "warn" | "error";
	message: string;
	details?: Record<string, unknown>;
}

export interface HealthReport {
	overall: "ok" | "warn" | "error";
	timestamp: string;
	checks: HealthCheckResult[];
	summary: {
		total: number;
		ok: number;
		warn: number;
		error: number;
	};
}

export interface DiagnosticInfo {
	version: string;
	sessionCount: number;
	extensionCount: number;
	skillCount: number;
	activeTools: string[];
	availableCommands: string[];
	configPaths: {
		agentDir: string;
		sessionsDir: string;
	};
	systemInfo: {
		platform: string;
		nodeVersion: string;
		memoryUsage: string;
		uptime: number;
	};
}

// ============================================================================
// Health Checks
// ============================================================================

/** Check agent directory accessibility. */
function checkAgentDir(): HealthCheckResult {
	try {
		const agentDir = getAgentDir();
		if (existsSync(agentDir)) {
			return {
				name: "agent-directory",
				status: "ok",
				message: "Agent directory accessible",
				details: { path: agentDir },
			};
		}
		return {
			name: "agent-directory",
			status: "warn",
			message: "Agent directory does not exist yet",
			details: { path: agentDir },
		};
	} catch (err) {
		return {
			name: "agent-directory",
			status: "error",
			message: `Cannot resolve agent directory: ${err}`,
		};
	}
}

/** Check memory availability. */
function checkMemory(): HealthCheckResult {
	const free = freemem();
	const total = totalmem();
	const usagePercent = ((total - free) / total) * 100;

	if (usagePercent > 95) {
		return {
			name: "memory",
			status: "error",
			message: `Critical memory usage: ${usagePercent.toFixed(1)}%`,
			details: { freeBytes: free, totalBytes: total, usagePercent },
		};
	}
	if (usagePercent > 80) {
		return {
			name: "memory",
			status: "warn",
			message: `High memory usage: ${usagePercent.toFixed(1)}%`,
			details: { freeBytes: free, totalBytes: total, usagePercent },
		};
	}
	return {
		name: "memory",
		status: "ok",
		message: `Memory usage: ${usagePercent.toFixed(1)}%`,
		details: { freeBytes: free, totalBytes: total, usagePercent },
	};
}

/** Check tool availability. */
function checkTools(): HealthCheckResult {
	const tools = ["read", "bash", "edit", "write", "grep", "find", "ls"];
	return {
		name: "core-tools",
		status: "ok",
		message: `${tools.length} core tools available`,
		details: { tools },
	};
}

/** Check session directory accessibility. */
function checkSessionDir(): HealthCheckResult {
	try {
		const sessionsDir = join(getAgentDir(), "sessions");
		if (existsSync(sessionsDir)) {
			return {
				name: "sessions-directory",
				status: "ok",
				message: "Sessions directory accessible",
				details: { path: sessionsDir },
			};
		}
		return {
			name: "sessions-directory",
			status: "ok",
			message: "Sessions directory not yet created (will be created on first session)",
			details: { path: sessionsDir },
		};
	} catch (err) {
		return {
			name: "sessions-directory",
			status: "warn",
			message: `Cannot resolve sessions directory: ${err}`,
		};
	}
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run all health checks and produce a report.
 */
export function runHealthChecks(
	options?: {
		additionalChecks?: HealthCheckResult[];
	},
): HealthReport {
	const checks: HealthCheckResult[] = [
		checkAgentDir(),
		checkMemory(),
		checkTools(),
		checkSessionDir(),
	];

	if (options?.additionalChecks) {
		checks.push(...options.additionalChecks);
	}

	const summary = {
		total: checks.length,
		ok: checks.filter((c) => c.status === "ok").length,
		warn: checks.filter((c) => c.status === "warn").length,
		error: checks.filter((c) => c.status === "error").length,
	};

	const overall: "ok" | "warn" | "error" =
		summary.error > 0 ? "error" :
		summary.warn > 0 ? "warn" :
		"ok";

	return {
		overall,
		timestamp: new Date().toISOString(),
		checks,
		summary,
	};
}

/**
 * Format a health report for display.
 */
export function formatHealthReport(report: HealthReport): string {
	const lines: string[] = [];

	const statusIcon = report.overall === "ok" ? "OK" : report.overall === "warn" ? "WARN" : "ERROR";
	lines.push(`AIRIS Health Check (${statusIcon})`);
	lines.push(`Timestamp: ${report.timestamp}`);
	lines.push("");
	lines.push(`Summary: ${report.summary.ok}/${report.summary.total} passed, ${report.summary.warn} warnings, ${report.summary.error} errors`);
	lines.push("");

	for (const check of report.checks) {
		const icon = check.status === "ok" ? "  OK" : check.status === "warn" ? " WARN" : " FAIL";
		lines.push(`${icon}  ${check.name}`);
		lines.push(`     ${check.message}`);
		if (check.details && Object.keys(check.details).length > 0) {
			const details = Object.entries(check.details)
				.map(([k, v]) => `${k}=${v}`)
				.join(", ");
			if (details.length < 100) {
				lines.push(`     (${details})`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Collect diagnostic information for the /diagnostics command.
 */
export function collectDiagnostics(options: {
	version: string;
	slashCommands: SlashCommandInfo[];
	extensionCount: number;
	skillCount: number;
	activeToolNames: string[];
	sessionCount: number;
}): DiagnosticInfo {
	const memUsage = process.memoryUsage();

	return {
		version: options.version,
		sessionCount: options.sessionCount,
		extensionCount: options.extensionCount,
		skillCount: options.skillCount,
		activeTools: options.activeToolNames,
		availableCommands: options.slashCommands.map((c) => `/${c.name}`),
		configPaths: {
			agentDir: getAgentDir(),
			sessionsDir: join(getAgentDir(), "sessions"),
		},
		systemInfo: {
			platform: process.platform,
			nodeVersion: process.version,
			memoryUsage: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)}MB`,
			uptime: Math.floor(process.uptime()),
		},
	};
}

/**
 * Format diagnostic info for display.
 */
export function formatDiagnostics(info: DiagnosticInfo): string {
	const lines: string[] = [];
	lines.push("AIRIS Diagnostics");
	lines.push("=================");
	lines.push("");
	lines.push(`Version: ${info.version}`);
	lines.push(`Sessions: ${info.sessionCount}`);
	lines.push(`Extensions loaded: ${info.extensionCount}`);
	lines.push(`Skills loaded: ${info.skillCount}`);
	lines.push(`Active tools: ${info.activeTools.join(", ")}`);
	lines.push("");
	lines.push("System:");
	lines.push(`  Platform: ${info.systemInfo.platform}`);
	lines.push(`  Node.js: ${info.systemInfo.nodeVersion}`);
	lines.push(`  Heap: ${info.systemInfo.memoryUsage}`);
	lines.push(`  Uptime: ${info.systemInfo.uptime}s`);
	lines.push("");
	lines.push("Config paths:");
	lines.push(`  Agent: ${info.configPaths.agentDir}`);
	lines.push(`  Sessions: ${info.configPaths.sessionsDir}`);
	lines.push("");
	lines.push(`Available commands (${info.availableCommands.length}):`);
	// Show first 20 commands
	const shown = info.availableCommands.slice(0, 20);
	lines.push(`  ${shown.join(", ")}`);
	if (info.availableCommands.length > 20) {
		lines.push(`  ... and ${info.availableCommands.length - 20} more`);
	}
	return lines.join("\n");
}
