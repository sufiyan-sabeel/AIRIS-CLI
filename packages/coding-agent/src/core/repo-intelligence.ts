/**
 * Repository Intelligence — structural understanding of a codebase.
 *
 * Builds a lightweight index: language statistics, top-level directory map,
 * entry points, and an intra-repository import graph. From the graph it can
 * compute change-impact (transitive reverse dependencies). This is the local,
 * offline layer of repository intelligence: no embedding model required.
 *
 * Testable with a temporary repository on disk.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";

export interface LanguageStat {
	files: number;
	lines: number;
}

export interface RepoIndex {
	root: string;
	fileCount: number;
	totalLines: number;
	languages: Record<string, LanguageStat>;
	topDirs: Record<string, number>;
	entryPoints: string[];
	/** relative path -> relative imported local paths */
	importGraph: Record<string, string[]>;
	scannedAt: number;
}

const SKIP_DIRS = new Set([
	"node_modules",
	".git",
	".airis",
	"dist",
	"build",
	"coverage",
	".next",
	".nuxt",
	".cache",
	"target",
	"vendor",
	"out",
	".turbo",
]);

const ENTRY_NAMES = new Set(["index.ts", "index.js", "main.ts", "main.js", "cli.ts", "cli.js"]);

const IMPORT_RE = /(?:from|import)\s+['"']([^'"']+)['"']|require\(\s*['"']([^'"']+)['"']\s*\)/g;

function countLines(content: string): number {
	let count = 1;
	for (let i = 0; i < content.length; i++) {
		if (content.charCodeAt(i) === 10) count++;
	}
	return count;
}

function resolveImport(baseRel: string, spec: string, root: string): string | undefined {
	if (!spec.startsWith(".")) return undefined;
	const baseDir = dirname(join(root, baseRel));
	const resolved = normalize(join(baseDir, spec));
	if (!resolved.startsWith(root)) return undefined;
	if (!existsSync(resolved)) return undefined;
	const rel = relative(root, resolved).split(sep).join("/");
	return rel;
}

/** Index a repository rooted at `root`. */
export function indexRepository(root: string, maxFiles = 20000): RepoIndex {
	const absRoot = resolve(root);
	const languages: Record<string, LanguageStat> = {};
	const topDirs: Record<string, number> = {};
	const entryPoints: string[] = [];
	const importGraph: Record<string, string[]> = {};
	let fileCount = 0;
	let totalLines = 0;
	const visited = new Set<string>();

	const walk = (dir: string): void => {
		if (fileCount >= maxFiles) return;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return;
		}
		for (const name of entries) {
			if (fileCount >= maxFiles) return;
			const full = join(dir, name);
			let st: import("node:fs").Stats | undefined;
			try {
				st = statSync(full);
			} catch {
				continue;
			}
			if (st.isDirectory()) {
				if (SKIP_DIRS.has(name)) continue;
				walk(full);
				continue;
			}
			if (!st.isFile()) continue;
			const rel = relative(absRoot, full).split(sep).join("/");
			if (visited.has(rel)) continue;
			visited.add(rel);
			fileCount++;
			const topDir = rel.includes("/") ? rel.slice(0, rel.indexOf("/")) : "(root)";
			topDirs[topDir] = (topDirs[topDir] ?? 0) + 1;

			const ext = extname(name).toLowerCase() || "(none)";
			if (!languages[ext]) languages[ext] = { files: 0, lines: 0 };
			const stat = languages[ext];
			stat.files++;
			try {
				const content = readFileSync(full, "utf-8");
				const lines = countLines(content);
				stat.lines += lines;
				totalLines += lines;
				if (ENTRY_NAMES.has(name)) entryPoints.push(rel);

				// Parse local imports.
				const edges: string[] = [];
				IMPORT_RE.lastIndex = 0;
				let m: RegExpExecArray | null = IMPORT_RE.exec(content);
				while (m !== null) {
					const spec = m[1] ?? m[2];
					if (spec) {
						const target = resolveImport(rel, spec, absRoot);
						if (target && !edges.includes(target)) edges.push(target);
					}
					m = IMPORT_RE.exec(content);
				}
				if (edges.length > 0) importGraph[rel] = edges;
			} catch {
				// Binary or unreadable; language lines stay 0.
			}
		}
	};

	walk(absRoot);

	return {
		root: absRoot,
		fileCount,
		totalLines,
		languages,
		topDirs,
		entryPoints,
		importGraph,
		scannedAt: Date.now(),
	};
}

/** Invert the import graph: target -> list of files that import it. */
export function reverseGraph(index: RepoIndex): Record<string, string[]> {
	const rev: Record<string, string[]> = {};
	for (const [from, targets] of Object.entries(index.importGraph)) {
		for (const target of targets) {
			if (!rev[target]) rev[target] = [];
			rev[target].push(from);
		}
	}
	return rev;
}

/**
 * Compute transitive change impact for a set of changed files.
 * Returns every file that (directly or transitively) imports a changed file.
 */
export function changeImpact(index: RepoIndex, changed: ReadonlyArray<string>): string[] {
	const rev = reverseGraph(index);
	const changedSet = new Set(changed.map((f) => f.split(sep).join("/")));
	const impacted = new Set<string>();
	const queue = [...changedSet];
	while (queue.length > 0) {
		const current = queue.shift() as string;
		for (const importer of rev[current] ?? []) {
			if (!impacted.has(importer)) {
				impacted.add(importer);
				queue.push(importer);
			}
		}
	}
	return [...impacted].sort();
}

/** Produce a human-readable repository summary. */
export function summarizeRepository(index: RepoIndex): string {
	const lines: string[] = [];
	lines.push("Repository Summary");
	lines.push("===================");
	lines.push(`Files: ${index.fileCount}`);
	lines.push(`Lines: ${index.totalLines.toLocaleString()}`);
	const langEntries = Object.entries(index.languages).sort((a, b) => b[1].lines - a[1].lines);
	lines.push("");
	lines.push("Languages (by lines):");
	for (const [ext, stat] of langEntries.slice(0, 12)) {
		lines.push(`  ${ext}: ${stat.files} files, ${stat.lines.toLocaleString()} lines`);
	}
	lines.push("");
	lines.push("Top-level directories:");
	const dirEntries = Object.entries(index.topDirs).sort((a, b) => b[1] - a[1]);
	for (const [dir, count] of dirEntries.slice(0, 12)) {
		lines.push(`  ${dir}: ${count} files`);
	}
	lines.push("");
	lines.push(`Entry points (${index.entryPoints.length}):`);
	for (const ep of index.entryPoints.slice(0, 15)) {
		lines.push(`  ${ep}`);
	}
	return lines.join("\n");
}
