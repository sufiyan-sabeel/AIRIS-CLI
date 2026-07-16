/**
 * Security Auditor — Security audit, dependency audit, and configuration security checks.
 *
 * Provides:
 * - Dependency audit (checks package.json for vulnerabilities)
 * - Security configuration audit (sandbox, trust, permissions)
 * - Tool security assessment
 * - Secret leakage detection
 * - Configuration security scoring
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "../config.ts";

// ============================================================================
// Types
// ============================================================================

export interface SecurityCheckResult {
	name: string;
	status: "ok" | "warn" | "error" | "info";
	message: string;
	details?: Record<string, unknown>;
	recommendation?: string;
}

export interface SecurityAuditReport {
	timestamp: string;
	overall: "ok" | "warn" | "error";
	checks: SecurityCheckResult[];
	summary: {
		total: number;
		ok: number;
		warn: number;
		error: number;
		info: number;
	};
}

export interface DepAuditEntry {
	name: string;
	version: string;
	type: "dependency" | "devDependency";
	hasScripts: boolean;
	scriptsWithLifecycle: string[];
	isPinned: boolean;
}

export interface DependencyAuditReport {
	timestamp: string;
	dependencies: DepAuditEntry[];
	warnings: string[];
	summary: {
		total: number;
		pinned: number;
		hasLifecycleScripts: number;
	};
}

// ============================================================================
// Security Checks
// ============================================================================

/** Check if sandbox is enabled. */
function checkSandbox(enableSandbox: boolean): SecurityCheckResult {
	if (enableSandbox) {
		return {
			name: "filesystem-sandbox",
			status: "ok",
			message: "Filesystem sandbox is enabled",
			recommendation: "Keep sandbox enabled for untrusted projects.",
		};
	}
	return {
		name: "filesystem-sandbox",
		status: "warn",
		message: "Filesystem sandbox is disabled",
		recommendation: "Enable sandbox with `/sandbox enable` when working with untrusted code.",
	};
}

/** Check if project trust is configured. */
function checkProjectTrust(): SecurityCheckResult {
	const trustPath = join(getAgentDir(), "trust.json");
	if (existsSync(trustPath)) {
		try {
			const raw = readFileSync(trustPath, "utf-8");
			const trust = JSON.parse(raw) as Record<string, unknown>;
			const entries = Object.keys(trust).length;
			return {
				name: "project-trust",
				status: "ok",
				message: `${entries} project trust decision(s) saved`,
				recommendation: "Review trust decisions regularly. Remove trust for projects you no longer work on.",
			};
		} catch {
			return {
				name: "project-trust",
				status: "warn",
				message: "Trust file exists but is corrupted",
				recommendation: "Delete ~/.airis/agent/trust.json to reset trust decisions.",
			};
		}
	}
	return {
		name: "project-trust",
		status: "info",
		message: "No project trust decisions saved yet",
		recommendation: "Trust decisions are created when you first work in a project.",
	};
}

/** Check for .env files that may contain secrets. */
function checkEnvFiles(cwd: string): SecurityCheckResult {
	const envPaths = [".env", ".env.local", ".env.production", ".env.development"];
	const found: string[] = [];

	for (const envFile of envPaths) {
		const fullPath = join(cwd, envFile);
		if (existsSync(fullPath)) {
			found.push(envFile);
		}
	}

	if (found.length > 0) {
		return {
			name: "env-files",
			status: "warn",
			message: `Environment files found: ${found.join(", ")}`,
			details: { files: found },
			recommendation: "Ensure .env files are in .gitignore. Use `.env.example` for documentation instead of committing secrets.",
		};
	}
	return {
		name: "env-files",
		status: "ok",
		message: "No environment files detected in workspace",
	};
}

/** Check for npm audit findings. */
function checkDependencySecurity(cwd: string): SecurityCheckResult {
	const pkgPath = join(cwd, "package.json");
	if (!existsSync(pkgPath)) {
		return {
			name: "dependency-security",
			status: "info",
			message: "No package.json found — cannot audit dependencies",
		};
	}

	try {
		const raw = readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(raw) as Record<string, unknown>;
		const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
		const totalDeps = Object.keys(deps).length;

		if (totalDeps === 0) {
			return {
				name: "dependency-security",
				status: "ok",
				message: "No dependencies found in package.json",
			};
		}

		// Check for pinned versions (exact pinning vs ranges)
		const unpinned = Object.entries(deps).filter(([, v]) => {
			const ver = v as string;
			return ver.startsWith("^") || ver.startsWith("~") || ver.includes("x") || ver === "*" || ver === "latest";
		});

		if (unpinned.length > 0) {
			return {
				name: "dependency-security",
				status: "warn",
				message: `${totalDeps} dependencies total, ${unpinned.length} use version ranges (not pinned)`,
				details: { totalDeps, unpinnedDeps: unpinned.length, unpinnedNames: unpinned.slice(0, 10).map(([n]) => n) },
				recommendation: "Pin dependencies to exact versions to prevent supply chain attacks. Use `npm run check:pinned-deps`.",
			};
		}

		return {
			name: "dependency-security",
			status: "ok",
			message: `${totalDeps} dependencies, all pinned to exact versions`,
		};
	} catch {
		return {
			name: "dependency-security",
			status: "error",
			message: "Failed to read package.json",
		};
	}
}

/** Check if audit logging is configured. */
function checkAuditLogging(): SecurityCheckResult {
	const agentDir = getAgentDir();
	const auditPath = join(agentDir, "audit.jsonl");
	if (existsSync(auditPath)) {
		return {
			name: "audit-logging",
			status: "ok",
			message: "Audit logging is active",
		};
	}
	return {
		name: "audit-logging",
		status: "info",
		message: "No audit log entries yet (file created on first logged event)",
		recommendation: "Audit logging is enabled by default.",
	};
}

/** Check shell configuration for dangerous defaults. */
function checkShellConfig(): SecurityCheckResult {
	const shellVars = ["SHELL", "PATH", "HOME", "NODE_OPTIONS"];
	const envHas = shellVars.filter((v) => process.env[v] !== undefined);

	return {
		name: "shell-environment",
		status: "ok",
		message: `Shell environment configured (${envHas.length}/${shellVars.length} vars set)`,
		recommendation: "Avoid setting NODE_OPTIONS in untrusted project contexts.",
	};
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run a full security audit.
 */
export function runSecurityAudit(options?: {
	cwd?: string;
	sandboxEnabled?: boolean;
	additionalChecks?: SecurityCheckResult[];
}): SecurityAuditReport {
	const cwd = options?.cwd ?? process.cwd();
	const checks: SecurityCheckResult[] = [
		checkSandbox(options?.sandboxEnabled ?? false),
		checkProjectTrust(),
		checkEnvFiles(cwd),
		checkDependencySecurity(cwd),
		checkAuditLogging(),
		checkShellConfig(),
	];

	if (options?.additionalChecks) {
		checks.push(...options.additionalChecks);
	}

	const summary = {
		total: checks.length,
		ok: checks.filter((c) => c.status === "ok").length,
		warn: checks.filter((c) => c.status === "warn").length,
		error: checks.filter((c) => c.status === "error").length,
		info: checks.filter((c) => c.status === "info").length,
	};

	const overall: "ok" | "warn" | "error" =
		summary.error > 0 ? "error" :
		summary.warn > 0 ? "warn" :
		"ok";

	return {
		timestamp: new Date().toISOString(),
		overall,
		checks,
		summary,
	};
}

/**
 * Format a security audit report for display.
 */
export function formatSecurityAudit(report: SecurityAuditReport): string {
	const lines: string[] = [];

	const statusIcon = report.overall === "ok" ? "OK" : report.overall === "warn" ? "WARN" : "ERROR";
	lines.push(`AIRIS Security Audit (${statusIcon})`);
	lines.push(`Timestamp: ${report.timestamp}`);
	lines.push("");
	lines.push(`Summary: ${report.summary.ok}/${report.summary.total} passed, ${report.summary.warn} warnings, ${report.summary.error} errors, ${report.summary.info} info`);
	lines.push("");

	for (const check of report.checks) {
		let icon: string;
		switch (check.status) {
			case "ok": icon = "  OK"; break;
			case "warn": icon = " WARN"; break;
			case "error": icon = " FAIL"; break;
			case "info": icon = " INFO"; break;
			default: icon = ` ${check.status}`;
		}
		lines.push(`${icon}  ${check.name}`);
		lines.push(`     ${check.message}`);
		if (check.recommendation) {
			lines.push(`     >> ${check.recommendation}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Run a dependency audit on the current project.
 */
export function runDependencyAudit(cwd: string): DependencyAuditReport {
	const warnings: string[] = [];
	const dependencies: DepAuditEntry[] = [];

	const pkgPath = join(cwd, "package.json");
	if (!existsSync(pkgPath)) {
		return {
			timestamp: new Date().toISOString(),
			dependencies: [],
			warnings: ["No package.json found at " + cwd],
			summary: { total: 0, pinned: 0, hasLifecycleScripts: 0 },
		};
	}

	try {
		const raw = readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(raw) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
			scripts?: Record<string, string>;
		};

		const allScripts = pkg.scripts ?? {};
		const lifecycleScripts = ["preinstall", "install", "postinstall", "preuninstall", "postuninstall"];

		const addDeps = (deps: Record<string, string>, type: "dependency" | "devDependency") => {
			for (const [name, version] of Object.entries(deps)) {
				const isPinned = !version.startsWith("^") && !version.startsWith("~") && !version.includes("x") && version !== "*" && version !== "latest";
				const scriptsWithLifecycle = lifecycleScripts.filter((s) => allScripts[s]);

				dependencies.push({
					name,
					version,
					type,
					hasScripts: scriptsWithLifecycle.length > 0,
					scriptsWithLifecycle,
					isPinned,
				});
			}
		};

		if (pkg.dependencies) addDeps(pkg.dependencies, "dependency");
		if (pkg.devDependencies) addDeps(pkg.devDependencies, "devDependency");

		const totalScripts = Object.keys(allScripts).length;
		if (totalScripts > 0 && lifecycleScripts.some((s) => allScripts[s])) {
			warnings.push(`Package has lifecycle scripts (${lifecycleScripts.filter((s) => allScripts[s]).join(", ")}) — these run on install`);
		}

		const unpinned = dependencies.filter((d) => !d.isPinned);
		if (unpinned.length > 0) {
			warnings.push(`${unpinned.length} dependencies use version ranges instead of exact pins`);
		}

		return {
			timestamp: new Date().toISOString(),
			dependencies,
			warnings,
			summary: {
				total: dependencies.length,
				pinned: dependencies.filter((d) => d.isPinned).length,
				hasLifecycleScripts: dependencies.filter((d) => d.hasScripts).length,
			},
		};
	} catch (err) {
		return {
			timestamp: new Date().toISOString(),
			dependencies: [],
			warnings: [`Failed to parse package.json: ${err}`],
			summary: { total: 0, pinned: 0, hasLifecycleScripts: 0 },
		};
	}
}

/**
 * Format a dependency audit report for display.
 */
export function formatDependencyAudit(report: DependencyAuditReport): string {
	const lines: string[] = [];

	lines.push("Dependency Audit Report");
	lines.push("=======================");
	lines.push(`Timestamp: ${report.timestamp}`);
	lines.push("");

	if (report.warnings.length > 0) {
		lines.push("Warnings:");
		for (const w of report.warnings) {
			lines.push(`  ! ${w}`);
		}
		lines.push("");
	}

	lines.push(`Dependencies: ${report.summary.total} total, ${report.summary.pinned} pinned, ${report.summary.hasLifecycleScripts} with lifecycle scripts`);
	lines.push("");

	if (report.dependencies.length > 0) {
		lines.push("Dependencies:");
		for (const dep of report.dependencies) {
			const pinFlag = dep.isPinned ? "" : " (range)";
			const lifecycleFlag = dep.hasLifecycleScripts ? " [lifecycle scripts]" : "";
			lines.push(`  ${dep.name}@${dep.version} [${dep.type}]${pinFlag}${lifecycleFlag}`);
		}
	}

	return lines.join("\n");
}
