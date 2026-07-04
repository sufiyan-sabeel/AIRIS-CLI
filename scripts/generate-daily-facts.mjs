/**
 * generate-daily-facts.mjs
 *
 * Build-time helper: generates dashboard data (daily fact + repo analysis)
 * to `website/public/dashboard-data.json`.
 *
 * This is NOT a CLI command — it is called by:
 *   - Next.js build (via website/package.json scripts)
 *   - GitHub Actions (daily cron)
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const REPO_ROOT = join(__dirname, "..");
const OUTPUT_PATH = join(REPO_ROOT, "website", "public", "dashboard-data.json");
const FACTS_PATH = join(REPO_ROOT, "website", "public", "daily-facts.json");

// ------- Daily facts pool -------
const FACTS_POOL = [
	"AIRIS CLI was started by Umaiz Sufiyan at age 15.",
	"AIRIS stands for Artificial Intelligence Responsive Integrated System.",
	"The project has a built-in `airis ship` workflow with 10 phases from Request to Commit.",
	"AIRIS supports 17 different AI providers including Anthropic, OpenAI, Google Gemini, and Groq.",
	"AIRIS has a verified autonomy system with mission contracts, capability leases, and evidence reports.",
	"The project runs on Node.js >=22.19.0 and is written in TypeScript.",
	"AIRIS has a self-debugging system that learns from error patterns.",
	"The CLI supports interactive mode, one-shot prompts, and machine-readable JSON/RPC modes.",
	"AIRIS has a theme system with dark, graphite, and tokyo-night built-in themes.",
	"The project includes native Go binaries for file search (aisearch) and web fetching (aifetch).",
	"AIRIS has an extension system that supports custom tools, themes, skills, and providers.",
	"The Termux installation path allows running AIRIS on Android devices.",
	"AIRIS has a session system that supports listing, resuming, forking, naming, and exporting sessions.",
	"The `airis --list-models` command supports search and glob patterns across providers.",
	"AIRIS uses biome for linting/formatting and vitest for testing.",
	"The repository includes a full CI/CD pipeline with GitHub Actions.",
	"The project has a website built with Next.js and Tailwind CSS.",
	"AIRIS supports OAuth-based authentication for Anthropic and other providers.",
	"The ship workflow state persists in `.airis/ship/` for interrupted workflow resumption.",
	"AIRIS has a trust system that controls access to project-local resources and mutation tools.",
	"The coding agent can read, write, edit, grep, find, and ls files in the project.",
];

function getTodayFact(seed) {
	// Deterministic daily fact from the pool
	const index = seed % FACTS_POOL.length;
	return FACTS_POOL[index];
}

// ------- Repo analysis -------
function countLines(filePath) {
	try {
		const content = readFileSync(filePath, "utf-8");
		return content.split("\n").length;
	} catch {
		return 0;
	}
}

function walkDir(dir, ext = null) {
	let files = [];
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
				files = files.concat(walkDir(fullPath, ext));
			} else if (!ext || entry.name.endsWith(ext)) {
				files.push(fullPath);
			}
		}
	} catch {}
	return files;
}

function analyzeRepo() {
	const packages = readdirSync(join(REPO_ROOT, "packages"), { withFileTypes: true })
		.filter((d) => d.isDirectory() && !d.name.startsWith("."))
		.map((d) => d.name);

	const tsFiles = walkDir(join(REPO_ROOT, "packages"), ".ts");
	const tsxFiles = walkDir(join(REPO_ROOT, "website"), ".tsx");
	const jsFiles = walkDir(join(REPO_ROOT, "scripts"), ".mjs");
	const goFiles = walkDir(join(REPO_ROOT, "packages"), ".go");
	const allCodeFiles = [...tsFiles, ...tsxFiles, ...jsFiles, ...goFiles];

	let totalLines = 0;
	for (const f of allCodeFiles) {
		totalLines += countLines(f);
	}

	const workflowFiles = readdirSync(join(REPO_ROOT, ".github", "workflows"));
	const mdDocs = walkDir(REPO_ROOT, ".md").length;

	return {
		packages: packages.length,
		packageNames: packages,
		tsSourceFiles: tsFiles.length,
		tsxComponents: tsxFiles.length,
		goModules: goFiles.length,
		scriptFiles: jsFiles.length,
		totalSourceLines: totalLines,
		githubWorkflows: workflowFiles.length,
		markdownDocs: mdDocs,
	};
}

// ------- Main -------
function main() {
	const now = new Date();
	const dateStr = now.toISOString().split("T")[0];
	const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

	const repoData = analyzeRepo();
	const fact = getTodayFact(seed);

	const dashboardData = {
		generatedAt: now.toISOString(),
		date: dateStr,
		dailyFact: {
			fact,
			index: seed % FACTS_POOL.length,
			total: FACTS_POOL.length,
		},
		analysis: {
			packages: repoData.packages,
			packageNames: repoData.packageNames,
			tsSourceFiles: repoData.tsSourceFiles,
			tsxComponents: repoData.tsxComponents,
			goModules: repoData.goModules,
			scriptFiles: repoData.scriptFiles,
			totalSourceLines: repoData.totalSourceLines,
			githubWorkflows: repoData.githubWorkflows,
			markdownDocs: repoData.markdownDocs,
		},
		codeBreakdown: [
			{ label: "TypeScript (.ts)", count: repoData.tsSourceFiles, color: "#3178c6" },
			{ label: "React/TSX (.tsx)", count: repoData.tsxComponents, color: "#06b6d4" },
			{ label: "Go modules (.go)", count: repoData.goModules, color: "#00ADD8" },
			{ label: "Scripts (.mjs)", count: repoData.scriptFiles, color: "#f0db4f" },
			{ label: "Markdown docs", count: repoData.markdownDocs, color: "#8b5cf6" },
		],
	};

	writeFileSync(OUTPUT_PATH, JSON.stringify(dashboardData, null, 2), "utf-8");
	console.log(`Generated dashboard data → ${OUTPUT_PATH}`);
	console.log(`  Date: ${dateStr}`);
	console.log(`  Fact #${dashboardData.dailyFact.index + 1}: ${dashboardData.dailyFact.fact}`);
	console.log(`  Analysis: ${repoData.totalSourceLines} lines across ${repoData.packages} packages`);
}

// Handle both direct execution and import
if (process.argv[1] && (process.argv[1].includes("generate-daily-facts") || process.argv[1].includes("daily-facts"))) {
	main();
}

export { getTodayFact, analyzeRepo, main };
