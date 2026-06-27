import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { promisify } from "node:util";
import type { ExploreLimits, ExploreTaskResult } from "./types.ts";

const execFileAsync = promisify(execFile);

const DEFAULT_LIMITS: ExploreLimits = {
	maxRuntimeMs: 8000,
	maxToolCalls: 80,
	maxFiles: 40,
	maxDepth: 5,
	maxParallel: 4,
};

const IGNORED_DIRS = new Set([
	".git",
	"node_modules",
	"dist",
	"build",
	".next",
	".turbo",
	"coverage",
	"target",
	".gradle",
	".idea",
	".vscode",
]);

const SOURCE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".json",
	".md",
	".py",
	".rs",
	".go",
	".java",
	".kt",
	".kts",
	".swift",
	".rb",
	".php",
	".cs",
	".cpp",
	".c",
	".h",
	".hpp",
	".yaml",
	".yml",
	".toml",
]);

function mergeLimits(limits?: Partial<ExploreLimits>): ExploreLimits {
	return { ...DEFAULT_LIMITS, ...limits };
}

function keywordScore(path: string, content: string, keywords: string[]): number {
	const haystack = `${path}\n${content}`.toLowerCase();
	let score = 0;
	for (const keyword of keywords) {
		if (!keyword) continue;
		const normalized = keyword.toLowerCase();
		if (normalized.length < 3) continue;
		if (haystack.includes(normalized)) score += normalized.length > 6 ? 3 : 1;
	}
	if (/test|spec|vitest|jest/i.test(path)) score += 1;
	if (/src|lib|core|agent|session|tool|compact|todo|task|plan/i.test(path)) score += 2;
	return score;
}

function extractKeywords(goal: string): string[] {
	const stop = new Set([
		"the",
		"and",
		"for",
		"with",
		"that",
		"this",
		"from",
		"into",
		"when",
		"must",
		"should",
		"implement",
		"create",
		"add",
		"make",
		"using",
	]);
	return goal
		.split(/[^A-Za-z0-9_./-]+/)
		.map((word) => word.trim())
		.filter((word) => word.length >= 3 && !stop.has(word.toLowerCase()))
		.slice(0, 30);
}

function extractSymbols(content: string): string[] {
	const symbols = new Set<string>();
	const patterns = [
		/\b(?:export\s+)?(?:class|interface|type|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
		/\b(?:fun|class|object|interface)\s+([A-Za-z_$][\w$]*)/g,
		/\bdef\s+([A-Za-z_$][\w$]*)/g,
	];
	for (const pattern of patterns) {
		for (const match of content.matchAll(pattern)) {
			symbols.add(match[1]);
			if (symbols.size >= 8) return [...symbols];
		}
	}
	return [...symbols];
}

export class ExploreTaskRunner {
	private readonly cwd: string;
	private readonly limits: Partial<ExploreLimits>;

	constructor(cwd: string, limits: Partial<ExploreLimits> = {}) {
		this.cwd = cwd;
		this.limits = limits;
	}

	async run(goal: string): Promise<ExploreTaskResult> {
		const limits = mergeLimits(this.limits);
		const startedAt = Date.now();
		let toolCalls = 0;
		let filesRead = 0;
		let truncated = false;
		const keywords = extractKeywords(goal);
		const candidates: Array<{ path: string; score: number; size: number }> = [];
		const architectureFindings: string[] = [];
		const risks: string[] = [];
		const unknowns: string[] = [];

		const checkLimits = () => {
			if (Date.now() - startedAt > limits.maxRuntimeMs) {
				truncated = true;
				return false;
			}
			if (toolCalls >= limits.maxToolCalls) {
				truncated = true;
				return false;
			}
			return true;
		};

		const walk = async (dir: string, depth: number): Promise<void> => {
			if (!checkLimits() || depth > limits.maxDepth || candidates.length >= limits.maxFiles * 3) return;
			toolCalls++;
			let entries: Dirent[];
			try {
				entries = await readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				if (!checkLimits()) return;
				const fullPath = join(dir, entry.name);
				const rel = relative(this.cwd, fullPath).replace(/\\/g, "/");
				if (entry.isDirectory()) {
					if (!IGNORED_DIRS.has(entry.name)) await walk(fullPath, depth + 1);
					continue;
				}
				if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
				let size = 0;
				try {
					size = (await stat(fullPath)).size;
				} catch {
					continue;
				}
				if (size > 256_000) continue;
				candidates.push({ path: rel, score: keywordScore(rel, "", keywords), size });
			}
		};

		await walk(this.cwd, 0);

		for (const file of candidates.slice(0, limits.maxFiles)) {
			if (!checkLimits()) break;
			try {
				toolCalls++;
				const content = await readFile(join(this.cwd, file.path), "utf8");
				filesRead++;
				file.score += keywordScore(file.path, content.slice(0, 32_000), keywords);
			} catch {
				// Ignore unreadable files; exploration is best-effort and read-only.
			}
		}

		const ranked = candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, 12);
		const relevantFilesAndSymbols = [];
		for (const file of ranked.slice(0, 8)) {
			if (!checkLimits()) break;
			try {
				toolCalls++;
				const content = await readFile(join(this.cwd, file.path), "utf8");
				relevantFilesAndSymbols.push({
					path: file.path,
					symbols: extractSymbols(content),
					reason:
						file.score > 0 ? "Matches task keywords or known runtime areas" : "Nearby source/config candidate",
				});
			} catch {
				// ignore
			}
		}

		try {
			if (checkLimits()) {
				toolCalls++;
				const { stdout } = await execFileAsync("git", ["status", "--short"], { cwd: this.cwd, timeout: 1500 });
				if (stdout.trim()) risks.push("Repository has uncommitted work; avoid overwriting unrelated changes.");
			}
			if (checkLimits()) {
				toolCalls++;
				const { stdout } = await execFileAsync("git", ["diff", "--name-only"], { cwd: this.cwd, timeout: 1500 });
				const changed = stdout.trim().split(/\r?\n/).filter(Boolean).slice(0, 12);
				if (changed.length > 0) architectureFindings.push(`Current diffs touch: ${changed.join(", ")}`);
			}
		} catch {
			// Git may be unavailable or cwd may not be a repository. Exploration remains read-only.
		}

		if (relevantFilesAndSymbols.length === 0) {
			unknowns.push("No clearly relevant source files found within exploration limits.");
		}
		if (/delete|remove|credential|secret|payment|destructive/i.test(goal)) {
			risks.push(
				"Task wording indicates destructive or sensitive changes; request permission before risky actions.",
			);
		}
		if (truncated) {
			unknowns.push("Exploration stopped at resource limits; further targeted reads may be needed.");
		}

		return {
			summary:
				relevantFilesAndSymbols.length > 0
					? `Read-only exploration found ${relevantFilesAndSymbols.length} likely relevant file(s).`
					: "Read-only exploration did not find a strong implementation target.",
			relevantFilesAndSymbols,
			architectureFindings,
			risks,
			recommendedImplementationLocation: relevantFilesAndSymbols.slice(0, 4).map((file) => file.path),
			unknownsRequiringClarification: unknowns,
			metrics: {
				runtimeMs: Date.now() - startedAt,
				toolCalls,
				filesRead,
				truncated,
			},
		};
	}
}

export function formatExploreResultForContext(result: ExploreTaskResult): string {
	const lines = ["Adaptive Explore Task findings (read-only exploration):", `Summary: ${result.summary}`];
	if (result.relevantFilesAndSymbols.length > 0) {
		lines.push("Relevant files/symbols:");
		for (const file of result.relevantFilesAndSymbols) {
			lines.push(
				`- ${file.path}${file.symbols?.length ? ` symbols=${file.symbols.join(",")}` : ""}: ${file.reason}`,
			);
		}
	}
	if (result.architectureFindings.length > 0) lines.push(`Architecture: ${result.architectureFindings.join("; ")}`);
	if (result.risks.length > 0) lines.push(`Risks: ${result.risks.join("; ")}`);
	if (result.recommendedImplementationLocation.length > 0) {
		lines.push(`Recommended locations: ${result.recommendedImplementationLocation.join(", ")}`);
	}
	if (result.unknownsRequiringClarification.length > 0) {
		lines.push(`Unknowns: ${result.unknownsRequiringClarification.join("; ")}`);
	}
	lines.push(
		`Limits: ${result.metrics.toolCalls} read-only calls, ${result.metrics.filesRead} files read, ${result.metrics.runtimeMs}ms${result.metrics.truncated ? ", truncated" : ""}`,
	);
	return lines.join("\n");
}
