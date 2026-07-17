/**
 * Project Learning - Automatic project pattern detection and cross-session memory.
 *
 * Detects and records project facts (build system, test framework, language stack,
 * file conventions) across sessions. Persists to `.airis/memory/project-profile.json`.
 *
 * v2 enhancements:
 * - Pattern confidence scoring based on frequency + session consistency
 * - Duplicate suppression within session
 * - Acceptance/rejection tracking for conventions
 * - Per-session dedup sets
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ============================================================================
// Types
// ============================================================================

export interface ProjectProfile {
	createdAt: string;
	updatedAt: string;
	sessionCount: number;
	framework?: string;
	language?: string;
	buildSystem?: string;
	testFramework?: string;
	packageManager?: string;
	filePatterns: Record<string, number>;
	commonCommands: Record<string, number>;
	conventions: string[];
	notes: string[];
	/** Patterns explicitly rejected (false positives) */
	rejectedPatterns?: string[];
}

export interface LearnEvent {
	type: "file_access" | "command" | "error" | "observation";
	detail: string;
	timestamp: string;
}

// ============================================================================
// Project Detection
// ============================================================================

interface DetectionResult {
	buildSystem?: string;
	language?: string;
	testFramework?: string;
	packageManager?: string;
	framework?: string;
}

export function detectProjectFeatures(cwd: string): DetectionResult {
	const result: DetectionResult = {};

	try {
		const pkgPath = join(cwd, "package.json");
		if (existsSync(pkgPath)) {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
			result.packageManager = "npm";

			if (existsSync(join(cwd, "pnpm-lock.yaml")) || existsSync(join(cwd, "pnpm-lock.yml"))) {
				result.packageManager = "pnpm";
			} else if (existsSync(join(cwd, "yarn.lock"))) {
				result.packageManager = "yarn";
			} else if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) {
				result.packageManager = "bun";
			}

			const devDeps = Object.keys((pkg.devDependencies as Record<string, string>) ?? {});
			const deps = Object.keys((pkg.dependencies as Record<string, string>) ?? {});
			const allDeps = [...devDeps, ...deps];

			if (allDeps.some((d) => /^(vite|@vitejs)/.test(d))) result.buildSystem = "vite";
			else if (allDeps.some((d) => /^(webpack|@webpack)/.test(d))) result.buildSystem = "webpack";
			else if (allDeps.some((d) => /^esbuild/.test(d))) result.buildSystem = "esbuild";
			else if (allDeps.some((d) => /^rollup/.test(d))) result.buildSystem = "rollup";
			else if (allDeps.some((d) => /^(tsup|tsc|typescript)/.test(d))) result.buildSystem = "typescript";
			else if (allDeps.some((d) => /^(next|@next)/.test(d))) result.buildSystem = "nextjs";

			if (allDeps.some((d) => /^vitest/.test(d))) result.testFramework = "vitest";
			else if (allDeps.some((d) => /^jest/.test(d))) result.testFramework = "jest";
			else if (allDeps.some((d) => /^(mocha|@mocha)/.test(d))) result.testFramework = "mocha";
			else if (allDeps.some((d) => /^cypress/.test(d))) result.testFramework = "cypress";
			else if (allDeps.some((d) => /^playwright/.test(d))) result.testFramework = "playwright";

			if (allDeps.some((d) => /^(react|@react)/.test(d))) result.framework = "react";
			else if (allDeps.some((d) => /^(vue|@vue)/.test(d))) result.framework = "vue";
			else if (allDeps.some((d) => /^svelte/.test(d))) result.framework = "svelte";
			else if (allDeps.some((d) => /^(angular|@angular)/.test(d))) result.framework = "angular";
			else if (allDeps.some((d) => /^(express|@express)/.test(d))) result.framework = "express";
			else if (allDeps.some((d) => /^(next|@next)/.test(d))) result.framework = "nextjs";

			if (allDeps.some((d) => /^typescript/.test(d)) || existsSync(join(cwd, "tsconfig.json"))) {
				result.language = "typescript";
			} else if (allDeps.some((d) => /^(@babel\/preset-env|babel-jest)/.test(d)) || existsSync(join(cwd, "babel.config"))) {
				result.language = "javascript";
			}
		}
	} catch {
		// Ignore parse errors
	}

	if (existsSync(join(cwd, "Cargo.toml"))) {
		result.language = "rust";
		result.buildSystem = "cargo";
	}

	if (existsSync(join(cwd, "go.mod"))) {
		result.language = "go";
		result.buildSystem = "go build";
	}

	if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "requirements.txt"))) {
		result.language = "python";
		if (existsSync(join(cwd, "pyproject.toml"))) {
			try {
				const pyproject = readFileSync(join(cwd, "pyproject.toml"), "utf-8");
				if (/pytest/i.test(pyproject)) result.testFramework = "pytest";
				if (/poetry/i.test(pyproject)) result.buildSystem = "poetry";
			} catch {
				// Ignore
			}
		}
	}

	return result;
}

// ============================================================================
// Pattern learning helpers (pure functions)
// ============================================================================

export function learnFilePattern(filePath: string, existing: Record<string, number>): Record<string, number> {
	const result = { ...existing };
	const ext = filePath.match(/\.([a-z0-9]+)$/i);
	if (ext) {
		const extKey = `*.${ext[1].toLowerCase()}`;
		result[extKey] = (result[extKey] ?? 0) + 1;
	}
	const parts = filePath.replace(/\\/g, "/").split("/");
	for (let i = 0; i < parts.length - 1; i++) {
		const dir = parts[i];
		if (dir && !dir.startsWith(".") && dir !== "node_modules" && dir !== "dist" && dir !== "build") {
			const dirKey = `${dir}/`;
			result[dirKey] = (result[dirKey] ?? 0) + 1;
		}
	}
	return result;
}

export function learnCommand(cmd: string, existing: Record<string, number>): Record<string, number> {
	const result = { ...existing };
	const baseCmd = cmd.trim().split(/\s+/)[0]?.toLowerCase();
	if (baseCmd) {
		result[baseCmd] = (result[baseCmd] ?? 0) + 1;
	}
	return result;
}

/** Compute confidence for a feature (0-1) based on count and session count. */
export function computeConfidence(count: number, sessionCount: number, significanceThreshold = 2): number {
	if (count <= 0) return 0;
	const frequencyScore = Math.min(count / 10, 1); // 10+ occurrences = max frequency
	const sessionScore = Math.min(sessionCount / 5, 1); // 5+ sessions = max session score
	const significance = count >= significanceThreshold ? 1 : 0.3;
	return Math.min((frequencyScore * 0.6 + sessionScore * 0.4) * significance, 1);
}

// ============================================================================
// ProjectLearning class
// ============================================================================

export class ProjectLearning {
	private _cwd: string;
	private _profilePath: string;
	private _profile: ProjectProfile;
	private _dirty = false;
	/** Per-session dedup set */ 
	private _sessionSeenPatterns = new Set<string>();

	constructor(cwd: string) {
		this._cwd = cwd;
		const memoryDir = join(cwd, ".airis", "memory");
		this._profilePath = join(memoryDir, "project-profile.json");
		if (!existsSync(memoryDir)) {
			mkdirSync(memoryDir, { recursive: true });
		}
		this._profile = this._loadProfile();
	}

	get profile(): ProjectProfile {
		return { ...this._profile, filePatterns: { ...this._profile.filePatterns }, commonCommands: { ...this._profile.commonCommands }, conventions: [...this._profile.conventions], notes: [...this._profile.notes] };
	}

	get dirty(): boolean {
		return this._dirty;
	}

	private _loadProfile(): ProjectProfile {
		if (existsSync(this._profilePath)) {
			try {
				const data = JSON.parse(readFileSync(this._profilePath, "utf-8")) as ProjectProfile;
				if (!data.rejectedPatterns) data.rejectedPatterns = [];
				return data;
			} catch {
				// Corrupted - start fresh
			}
		}
		const detected = detectProjectFeatures(this._cwd);
		return {
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			sessionCount: 1,
			...detected,
			filePatterns: {},
			commonCommands: {},
			conventions: [],
			notes: [],
			rejectedPatterns: [],
		};
	}

	save(): void {
		if (!this._dirty) return;
		this._profile.updatedAt = new Date().toISOString();
		try {
			writeFileSync(this._profilePath, JSON.stringify(this._profile, null, 2));
			this._dirty = false;
		} catch (err) {
			console.error(`Failed to save project profile: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	incrementSession(): void {
		this._profile.sessionCount++;
		this._dirty = true;
	}

	/** Learn from a file access with dedup. */
	learnFileAccess(filePath: string): void {
		const resolved = resolve(this._cwd, filePath);
		const relativePath = relative(this._cwd, resolved);
		if (relativePath.startsWith("..") || relativePath.startsWith(".airis/")) return;

		// Dedup: skip if this path was already learned this session
		if (this._sessionSeenPatterns.has(relativePath)) return;
		this._sessionSeenPatterns.add(relativePath);

		this._profile.filePatterns = learnFilePattern(relativePath, this._profile.filePatterns);
		this._dirty = true;
	}

	/** Learn from a command execution with dedup. */
	learnCommand(command: string): void {
		const baseCmd = command.trim().split(/\s+/)[0]?.toLowerCase();
		if (!baseCmd) return;

		const seenKey = `cmd:${baseCmd}`;
		if (this._sessionSeenPatterns.has(seenKey)) return;
		this._sessionSeenPatterns.add(seenKey);

		this._profile.commonCommands = learnCommand(command, this._profile.commonCommands);
		this._dirty = true;
	}

	/** Add a convention observation (suppresses if rejected before). */
	addConvention(convention: string): void {
		if (this._profile.conventions.includes(convention)) return;
		if (this._profile.rejectedPatterns?.includes(convention)) return;
		this._profile.conventions.push(convention);
		this._dirty = true;
	}

	/** Reject a convention (mark as false positive). */
	rejectConvention(convention: string): void {
		const idx = this._profile.conventions.indexOf(convention);
		if (idx >= 0) {
			this._profile.conventions.splice(idx, 1);
		}
		if (!this._profile.rejectedPatterns!.includes(convention)) {
			this._profile.rejectedPatterns!.push(convention);
		}
		this._dirty = true;
	}

	addNote(note: string): void {
		this._profile.notes.push(note);
		this._dirty = true;
	}

	clear(): void {
		this._profile.filePatterns = {};
		this._profile.commonCommands = {};
		this._profile.conventions = [];
		this._profile.notes = [];
		this._profile.rejectedPatterns = [];
		this._sessionSeenPatterns.clear();
		this._dirty = true;
	}

	/** Get a human-readable summary with confidence scores. */
	getSummary(): string {
		const p = this._profile;
		const lines: string[] = [];
		lines.push("**Project Profile**");
		lines.push("");
		lines.push("| Aspect | Value |");
		lines.push("|--------|-------|");
		lines.push(`| Sessions | ${p.sessionCount} |`);
		if (p.language) lines.push(`| Language | ${p.language} |`);
		if (p.framework) lines.push(`| Framework | ${p.framework} |`);
		if (p.buildSystem) lines.push(`| Build System | ${p.buildSystem} |`);
		if (p.testFramework) lines.push(`| Test Framework | ${p.testFramework} |`);
		if (p.packageManager) lines.push(`| Package Manager | ${p.packageManager} |`);

		const fileCount = Object.keys(p.filePatterns).length;
		const cmdCount = Object.keys(p.commonCommands).length;
		lines.push(`| File Patterns | ${fileCount} tracked |`);
		lines.push(`| Common Commands | ${cmdCount} tracked |`);
		lines.push(`| Rejected | ${p.rejectedPatterns?.length ?? 0} |`);

		if (fileCount > 0) {
			lines.push("");
			lines.push("**Top File Patterns (confidence):**");
			const maxCount = Math.max(...Object.values(p.filePatterns), 1);
			const sorted = Object.entries(p.filePatterns)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10);
			for (const [pattern, count] of sorted) {
				const conf = computeConfidence(count, p.sessionCount);
				const bar = conf > 0.7 ? "🟢" : conf > 0.4 ? "🟡" : "🔴";
				lines.push(`- ${pattern} (${count}x, ${bar} ${(conf * 100).toFixed(0)}%)`);
			}
		}

		if (cmdCount > 0) {
			lines.push("");
			lines.push("**Top Commands:**");
			const sorted = Object.entries(p.commonCommands)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5);
			for (const [cmd, count] of sorted) {
				lines.push(`- ${cmd} (${count}x)`);
			}
		}

		if (p.conventions.length > 0) {
			lines.push("");
			lines.push("**Conventions:**");
			for (const conv of p.conventions) {
				lines.push(`- ${conv}`);
			}
		}

		if (p.notes.length > 0) {
			lines.push("");
			lines.push("**Notes:**");
			for (const note of p.notes) {
				lines.push(`> ${note}`);
			}
		}

		return lines.join("\n");
	}
}
