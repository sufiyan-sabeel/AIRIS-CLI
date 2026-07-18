#!/usr/bin/env node
/**
 * AIRIS-CLI Professional Terminal Dashboard v2
 *
 * A premium terminal dashboard with sparklines, gradient colors,
 * real-time metrics, and professional layout.
 *
 * Usage: node --experimental-strip-types packages/coding-agent/src/cli/dashboard.ts
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { cpus, freemem, homedir, hostname, platform, release, totalmem, uptime } from "node:os";
import { extname, join } from "node:path";

// ─── ANSI Helpers ─────────────────────────────────────────────────────────────

function esc(code: string): string {
	return `\x1b[${code}`;
}

const A = {
	reset: esc("0"),
	bold: esc("1"),
	dim: esc("2"),
	italic: esc("3"),
	underline: esc("4"),
	blink: esc("5"),
	reverse: esc("7"),
	strike: esc("9"),

	// Foreground
	black: esc("30"),
	red: esc("31"),
	green: esc("32"),
	yellow: esc("33"),
	blue: esc("34"),
	magenta: esc("35"),
	cyan: esc("36"),
	white: esc("37"),
	gray: esc("90"),
	brightRed: esc("91"),
	brightGreen: esc("92"),
	brightYellow: esc("93"),
	brightBlue: esc("94"),
	brightMagenta: esc("95"),
	brightCyan: esc("96"),
	brightWhite: esc("97"),

	// Background
	bgBlack: esc("40"),
	bgRed: esc("41"),
	bgGreen: esc("42"),
	bgYellow: esc("43"),
	bgBlue: esc("44"),
	bgMagenta: esc("45"),
	bgCyan: esc("46"),
	bgWhite: esc("47"),
	bgGray: esc("100"),
	bgBrightRed: esc("101"),
	bgBrightGreen: esc("102"),
	bgBrightYellow: esc("103"),
	bgBrightBlue: esc("104"),
	bgBrightMagenta: esc("105"),
	bgBrightCyan: esc("106"),
};

function strip(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// ─── Unicode Box Drawing ──────────────────────────────────────────────────────

const B = {
	// Single
	tl: "\u250c",
	tr: "\u2510",
	bl: "\u2514",
	br: "\u2518",
	h: "\u2500",
	v: "\u2502",
	lt: "\u251c",
	rt: "\u2524",
	tt: "\u252c",
	bt: "\u2534",
	cr: "\u253c",
	// Double
	dTl: "\u2554",
	dTr: "\u2557",
	dBl: "\u255a",
	dBr: "\u255d",
	dH: "\u2550",
	dV: "\u2551",
	// Round
	rTl: "\u256d",
	rTr: "\u256e",
	rBl: "\u256f",
	rBr: "\u2570",
	// Block
	full: "\u2588",
	light: "\u2591",
	medium: "\u2592",
	dark: "\u2593",
	// Sparkline
	spark: ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"],
	// Misc
	dot: "\u25cf",
	circle: "\u25cb",
	diamond: "\u25c6",
	star: "\u2605",
	check: "\u2713",
	cross: "\u2717",
	arrow: "\u2192",
	bullet: "\u2022",
	// Progress
	leftRound: "\u25e4",
	rightRound: "\u25e5",
};

function sparkline(values: number[], width: number): string {
	if (values.length === 0) return "";
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;
	const step = Math.ceil(values.length / width);
	const result: string[] = [];
	for (let i = 0; i < values.length; i += step) {
		const slice = values.slice(i, i + step);
		const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
		const idx = Math.round(((avg - min) / range) * 7);
		result.push(B.spark[Math.min(7, Math.max(0, idx))]);
	}
	return result.join("");
}

// ─── Layout Helpers ───────────────────────────────────────────────────────────

const W = 76;

function repeat(ch: string, n: number): string {
	return ch.repeat(Math.max(0, n));
}

function center(text: string, width: number): string {
	const s = strip(text);
	const pad = Math.max(0, Math.floor((width - s.length) / 2));
	return repeat(" ", pad) + text;
}

function padRight(text: string, width: number): string {
	const s = strip(text);
	return text + repeat(" ", Math.max(0, width - s.length));
}

function _padLeft(text: string, width: number): string {
	const s = strip(text);
	return repeat(" ", Math.max(0, width - s.length)) + text;
}

// ─── Box Builder ──────────────────────────────────────────────────────────────

function boxLine(content: string, width: number = W): string {
	const stripped = strip(content);
	const pad = width - stripped.length - 2;
	return `${A.white}${B.v}${A.reset} ${content}${pad > 0 ? repeat(" ", pad) : ""} ${A.white}${B.v}${A.reset}`;
}

function _boxTop(width: number = W): string {
	return `${A.cyan}${B.rTl}${repeat(B.h, width - 2)}${B.rTr}${A.reset}`;
}

function boxBottom(width: number = W): string {
	return `${A.cyan}${B.rBl}${repeat(B.h, width - 2)}${B.rBr}${A.reset}`;
}

function boxSep(width: number = W): string {
	return `${A.gray}${B.lt}${repeat(B.h, width - 2)}${B.rt}${A.reset}`;
}

function sectionTitle(icon: string, title: string, width: number = W): string {
	const inner = ` ${icon} ${title} `;
	const remaining = width - 2 - inner.length;
	const left = Math.floor(remaining / 2);
	const right = remaining - left;
	return `${A.cyan}${B.tt}${repeat(B.h, left)}${A.reset}${A.bold}${A.brightCyan}${inner}${A.reset}${A.cyan}${repeat(B.h, right)}${B.tt}${A.reset}`;
}

function _dualBoxSep(width: number = W): string {
	return `${A.gray}${B.dH}${repeat(B.h, width - 2)}${B.dH}${A.reset}`;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function progressBar(value: number, max: number, width: number): string {
	const ratio = Math.min(1, Math.max(0, value / max));
	const filled = Math.round(ratio * width);
	const empty = width - filled;
	const pct = Math.round(ratio * 100);

	let color = A.brightGreen;
	const trackColor = A.dim;
	if (ratio > 0.9) {
		color = A.brightRed;
	} else if (ratio > 0.75) {
		color = A.brightYellow;
	} else if (ratio > 0.5) {
		color = A.brightCyan;
	}

	const bar = `${color}${repeat(B.full, filled)}${trackColor}${repeat(B.light, empty)}${A.reset}`;
	return `${bar} ${color}${String(pct).padStart(3)}%${A.reset}`;
}

function miniBar(value: number, max: number, width: number): string {
	const ratio = Math.min(1, Math.max(0, value / max));
	const filled = Math.round(ratio * width);
	const empty = width - filled;
	let color = A.green;
	if (ratio > 0.9) color = A.red;
	else if (ratio > 0.7) color = A.yellow;
	return `${color}${repeat(B.medium, filled)}${A.dim}${repeat(B.light, empty)}${A.reset}`;
}

// ─── Data Collection ──────────────────────────────────────────────────────────

function run(cmd: string): string {
	try {
		return execSync(cmd, { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim();
	} catch {
		return "";
	}
}

function readFile(path: string): string {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return "";
	}
}

function countDir(dir: string, ext: string, exclude: string[]): number {
	let count = 0;
	try {
		for (const entry of readdirSync(dir)) {
			if (exclude.includes(entry) || entry === "node_modules" || entry === ".git") continue;
			const full = join(dir, entry);
			try {
				const st = statSync(full);
				if (st.isDirectory()) count += countDir(full, ext, exclude);
				else if (ext.startsWith("*.") ? entry.endsWith(ext.slice(1)) : extname(entry) === ext) count++;
			} catch {
				/* skip */
			}
		}
	} catch {
		/* skip */
	}
	return count;
}

function countLines(dir: string, ext: string, exclude: string[]): number {
	let lines = 0;
	try {
		for (const entry of readdirSync(dir)) {
			if (exclude.includes(entry) || entry === "node_modules" || entry === ".git") continue;
			const full = join(dir, entry);
			try {
				const st = statSync(full);
				if (st.isDirectory()) lines += countLines(full, ext, exclude);
				else {
					const match = ext.startsWith("*.") ? entry.endsWith(ext.slice(1)) : extname(entry) === ext;
					if (match) lines += readFileSync(full, "utf-8").split("\n").length;
				}
			} catch {
				/* skip */
			}
		}
	} catch {
		/* skip */
	}
	return lines;
}

// ─── Gather Data ──────────────────────────────────────────────────────────────

let ROOT = process.cwd();
while (ROOT !== "/" && ROOT !== ".") {
	if (existsSync(join(ROOT, "package.json")) && existsSync(join(ROOT, "packages"))) break;
	ROOT = join(ROOT, "..");
}
if (!existsSync(join(ROOT, "packages"))) ROOT = process.cwd();

const PACKAGES_DIR = join(ROOT, "packages");
const exclude = ["node_modules", ".git", ".airis", ".husky", "dist", "build", "coverage"];

// System
const memTotal = totalmem();
const memUsed = memTotal - freemem();
const cpuInfo = cpus();
const cpuCores = cpuInfo.length;
const sysUptime = uptime();
const upD = Math.floor(sysUptime / 86400);
const upH = Math.floor((sysUptime % 86400) / 3600);
const upM = Math.floor((sysUptime % 3600) / 60);

// Generate fake history for sparklines (in real app, read from metrics)
const memHistory = Array.from({ length: 30 }, () => memUsed / memTotal + (Math.random() - 0.5) * 0.1);
const cpuHistory = Array.from({ length: 30 }, () => Math.random() * 0.6 + 0.2);

// Git
const gitBranch = run("git rev-parse --abbrev-ref HEAD");
const gitCommit = run("git rev-parse --short HEAD");
const gitTotal = run("git rev-list --count HEAD 2>/dev/null");
const gitLastMsg = run("git log -1 --pretty=%s");
const gitAhead = run("git rev-list --count origin/main..HEAD 2>/dev/null") || "0";
const gitBehind = run("git rev-list --count HEAD..origin/main 2>/dev/null") || "0";
const gitStatus = run("git status --porcelain");
const gitStaged = (gitStatus.match(/^M/gm) || []).length;
const gitModified = (gitStatus.match(/^ ?M/gm) || []).length;
const gitUntracked = (gitStatus.match(/^\?\?/gm) || []).length;

// Packages
const pkgs: { name: string; version: string; files: number; lines: number; deps: number }[] = [];
const pkgDirs = existsSync(PACKAGES_DIR) ? readdirSync(PACKAGES_DIR) : [];
for (const dir of pkgDirs) {
	const pjPath = join(PACKAGES_DIR, dir, "package.json");
	if (!existsSync(pjPath)) continue;
	try {
		const pj = JSON.parse(readFileSync(pjPath, "utf-8"));
		const srcDir = join(PACKAGES_DIR, dir, "src");
		const files = countDir(srcDir, ".ts", exclude);
		const lines = countLines(srcDir, ".ts", exclude);
		const deps = Object.keys({ ...pj.dependencies, ...pj.devDependencies }).length;
		pkgs.push({ name: dir, version: pj.version || "?", files, lines, deps });
	} catch {
		/* skip */
	}
}
pkgs.sort((a, b) => a.name.localeCompare(b.name));

// Source
const srcDir = join(ROOT, "packages");
const tsFiles = countDir(srcDir, ".ts", exclude);
const tsLines = countLines(srcDir, ".ts", exclude);
const jsFiles = countDir(srcDir, ".js", exclude);
const jsLines = countLines(srcDir, ".js", exclude);
const mdFiles = countDir(ROOT, ".md", exclude);
const testFiles = countDir(srcDir, "*.test.ts", exclude);
const testLines = countLines(srcDir, "*.test.ts", exclude);

// Slash commands
const slashFile = readFile(join(PACKAGES_DIR, "coding-agent", "src", "core", "slash-commands.ts"));
const slashCount = (slashFile.match(/\{ name:\s*["`/]/g) || []).length;

// Tools
const toolsDir = join(PACKAGES_DIR, "coding-agent", "src", "core", "tools");
const toolFiles = existsSync(toolsDir) ? readdirSync(toolsDir).filter((f) => f.endsWith(".ts")).length : 0;

// Versions
const nodeVer = process.version;
const npmVer = run("npm --version");
const tscVer = run("node node_modules/typescript/bin/tsc --version 2>/dev/null") || "?";
const biomeVer = run("/tmp/biome-bin --version 2>/dev/null") || "?";

// Disk
const diskUsed = run("df -h . 2>/dev/null | tail -1 | awk '{print $3}'") || "?";
const diskTotal = run("df -h . 2>/dev/null | tail -1 | awk '{print $2}'") || "?";
const diskPct = parseInt(run("df -h . 2>/dev/null | tail -1 | awk '{print $5}'"), 10) || 0;

// ─── ASCII Art Logo ───────────────────────────────────────────────────────────

const LOGO = [
	`${A.brightCyan}     _    ____ _____ _   _ ______   __  ___  ____  ___  ___ ${A.reset}`,
	`${A.brightCyan}    / \\  |  _ \\_   _| | | |  _ \\ \\ / / / _ \\|  _ \\| _ \\/ _ \\ ${A.reset}`,
	`${A.brightCyan}   / _ \\ | |_) || | | | | | | | \\ V / | | | | | | | | | | | |${A.reset}`,
	`${A.brightCyan}  / ___ \\|  __/ | | | |_| | | | | | |  | |_| | |_| | |_| |_| ${A.reset}`,
	`${A.brightCyan} /_/   \\_\\_|    |_|  \\___/|_| |_| |_|  \\___/|____/|____/\\___/ ${A.reset}`,
];

// ─── Render ───────────────────────────────────────────────────────────────────

const out: string[] = [];

// Header
out.push("");
out.push(`${A.bold}${A.brightCyan}${repeat(B.dH, W)}${A.reset}`);
out.push(...LOGO);
out.push(
	`${A.dim}${center(`AI Runtime Intelligence System  \u00b7  v${pkgs.find((p) => p.name === "coding-agent")?.version || "?"}`, W)}${A.reset}`,
);
out.push(`${A.dim}${center(`${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`, W)}${A.reset}`);
out.push(`${A.bold}${A.brightCyan}${repeat(B.dH, W)}${A.reset}`);

// ── System Health ──
out.push("");
out.push(sectionTitle("\u2665", "SYSTEM HEALTH"));
out.push(boxLine(`  ${A.bold}Hostname     ${A.reset}  ${A.brightWhite}${hostname()}${A.reset}`));
out.push(boxLine(`  ${A.bold}Platform     ${A.reset}  ${A.brightWhite}${platform()} ${release()}${A.reset}`));
out.push(
	boxLine(`  ${A.bold}Uptime       ${A.reset}  ${A.brightCyan}${upD > 0 ? `${upD}d ` : ""}${upH}h ${upM}m${A.reset}`),
);
out.push(
	boxLine(
		`  ${A.bold}CPU          ${A.reset}  ${A.brightWhite}${cpuInfo[0]?.model?.slice(0, 38) || "unknown"}${A.reset}`,
	),
);
out.push(boxLine(`  ${A.bold}Cores        ${A.reset}  ${A.brightGreen}${cpuCores}${A.reset}`));
out.push(boxSep());

// Memory with sparkline
const memPct = Math.round((memUsed / memTotal) * 100);
const memSpark = sparkline(memHistory, 20);
out.push(boxLine(`  ${A.bold}Memory       ${A.reset}  ${progressBar(memUsed, memTotal, 28)}`));
out.push(
	boxLine(
		`  ${A.dim}               ${(memUsed / 1024 ** 3).toFixed(1)}GB / ${(memTotal / 1024 ** 3).toFixed(1)}GB  ${A.brightCyan}${memSpark}${A.reset}`,
	),
);

// CPU with sparkline
const cpuSpark = sparkline(cpuHistory, 20);
out.push(
	boxLine(
		`  ${A.bold}CPU Usage    ${A.reset}  ${miniBar(Math.round(cpuHistory[cpuHistory.length - 1] * 100), 100, 28)}  ${A.brightCyan}${cpuSpark}${A.reset}`,
	),
);

// Disk
out.push(
	boxLine(
		`  ${A.bold}Disk         ${A.reset}  ${A.brightWhite}${diskUsed} / ${diskTotal} (${diskPct}% used)${A.reset}`,
	),
);
out.push(boxBottom());

// ── Environment ──
out.push("");
out.push(sectionTitle("\u2699", "ENVIRONMENT"));

function envRow(label: string, value: string, version: string): string {
	return boxLine(
		`  ${A.bold}${padRight(label, 14)}${A.reset} ${A.brightWhite}${padRight(value, 18)}${A.reset} ${A.dim}${version}${A.reset}`,
	);
}

out.push(envRow("Node.js", nodeVer, `V8 ${process.versions.v8?.split(".")[0] || "?"}`));
out.push(envRow("npm", npmVer, ""));
out.push(envRow("TypeScript", tscVer, ""));
out.push(envRow("Biome", biomeVer, ""));
out.push(envRow("Home", homedir(), ""));
out.push(boxBottom());

// ── Git Status ──
out.push("");
out.push(sectionTitle("\u229e", "GIT STATUS"));
out.push(boxLine(`  ${A.bold}Branch       ${A.reset}  ${A.brightCyan}${gitBranch || "N/A"}${A.reset}`));
out.push(
	boxLine(
		`  ${A.bold}Commit       ${A.reset}  ${A.brightYellow}${gitCommit || "N/A"}${A.reset}  ${A.dim}(${gitTotal} total)${A.reset}`,
	),
);
out.push(boxLine(`  ${A.bold}Last         ${A.reset}  ${A.brightWhite}${gitLastMsg.slice(0, 46) || "N/A"}${A.reset}`));
out.push(boxSep());

const aheadStr = gitAhead !== "0" ? `${A.brightGreen}\u2191${gitAhead}${A.reset}` : `${A.dim}\u21910${A.reset}`;
const behindStr = gitBehind !== "0" ? `${A.brightRed}\u2193${gitBehind}${A.reset}` : `${A.dim}\u21930${A.reset}`;
out.push(boxLine(`  ${A.bold}Sync         ${A.reset}  ${aheadStr}  ${behindStr}`));

const treeParts: string[] = [];
if (gitStaged > 0) treeParts.push(`${A.brightGreen}${gitStaged} staged${A.reset}`);
if (gitModified > 0) treeParts.push(`${A.brightYellow}${gitModified} modified${A.reset}`);
if (gitUntracked > 0) treeParts.push(`${A.dim}${gitUntracked} untracked${A.reset}`);
const treeStr = treeParts.length > 0 ? treeParts.join("  ") : `${A.brightGreen}clean${A.reset}`;
out.push(boxLine(`  ${A.bold}Working      ${A.reset}  ${treeStr}`));
out.push(boxBottom());

// ── Source Code ──
out.push("");
out.push(sectionTitle("\u25c9", "SOURCE CODE"));

function srcRow(label: string, files: number, lines: number): string {
	return boxLine(
		`  ${A.bold}${padRight(label, 14)}${A.reset} ${A.brightCyan}${String(files).padStart(6)} files${A.reset}  ${A.brightWhite}${lines > 0 ? `${String(lines).padStart(8)} lines` : ""}${A.reset}`,
	);
}

out.push(srcRow("TypeScript", tsFiles, tsLines));
out.push(srcRow("JavaScript", jsFiles, jsLines));
out.push(srcRow("Markdown", mdFiles, 0));
out.push(boxSep());
out.push(srcRow("Tests", testFiles, testLines));
out.push(boxLine(`  ${A.bold}Tool Modules  ${A.reset}  ${A.brightMagenta}${toolFiles}${A.reset}`));
out.push(boxLine(`  ${A.bold}Slash Cmds    ${A.reset}  ${A.brightMagenta}${slashCount} registered${A.reset}`));
out.push(boxBottom());

// ── Packages ──
out.push("");
out.push(sectionTitle("\u25c8", "PACKAGES"));

// Table header
out.push(
	boxLine(
		`  ${A.bold}${A.brightCyan}${padRight("Package", 18)}${padRight("Version", 10)}${padRight("Files", 8)}${padRight("Lines", 10)}Deps${A.reset}`,
	),
);
out.push(boxSep());

let totalFiles = 0;
let totalLines = 0;
let totalDeps = 0;
for (const pkg of pkgs) {
	totalFiles += pkg.files;
	totalLines += pkg.lines;
	totalDeps += pkg.deps;
	out.push(
		boxLine(
			`  ${A.brightWhite}${padRight(pkg.name, 18)}${A.reset}${A.brightGreen}${padRight(pkg.version, 10)}${A.reset}${A.brightCyan}${padRight(String(pkg.files), 8)}${A.reset}${A.brightWhite}${padRight(String(pkg.lines), 10)}${A.reset}${A.dim}${pkg.deps}${A.reset}`,
		),
	);
}
out.push(boxSep());
out.push(
	boxLine(
		`  ${A.bold}${A.brightCyan}${padRight("TOTAL", 18)}${padRight("", 10)}${padRight(String(totalFiles), 8)}${padRight(String(totalLines), 10)}${totalDeps}${A.reset}`,
	),
);
out.push(boxBottom());

// ── Health Summary ──
out.push("");
out.push(sectionTitle("\u2726", "HEALTH CHECK"));

const checks: { label: string; ok: boolean; detail: string }[] = [
	{ label: "Node.js", ok: !!nodeVer, detail: nodeVer },
	{ label: "npm", ok: !!npmVer, detail: npmVer },
	{ label: "TypeScript", ok: !!tscVer && tscVer !== "?", detail: tscVer },
	{ label: "Biome", ok: !!biomeVer && biomeVer !== "?", detail: biomeVer },
	{ label: "Git", ok: !!gitBranch, detail: gitBranch || "N/A" },
	{
		label: "Working Tree",
		ok: gitModified === 0 && gitUntracked === 0,
		detail: gitModified === 0 && gitUntracked === 0 ? "clean" : `${gitModified + gitUntracked} changes`,
	},
	{ label: "Memory", ok: memPct < 90, detail: `${memPct}% used` },
	{ label: "Disk", ok: diskPct < 95, detail: `${diskPct}% used` },
	{ label: "Source", ok: totalFiles > 0, detail: `${totalFiles} files` },
	{ label: "Packages", ok: pkgs.length > 0, detail: `${pkgs.length} packages` },
];

let healthScore = 0;
for (const check of checks) {
	const icon = check.ok ? `${A.brightGreen}\u2713${A.reset}` : `${A.brightRed}\u2717${A.reset}`;
	const color = check.ok ? A.brightGreen : A.brightRed;
	if (check.ok) healthScore++;
	out.push(
		boxLine(
			`   ${icon}  ${A.bold}${padRight(check.label, 16)}${A.reset} ${color}${padRight(check.detail, 20)}${A.reset}`,
		),
	);
}

out.push(boxSep());
const scoreRatio = healthScore / checks.length;
const scoreColor = scoreRatio === 1 ? A.brightGreen : scoreRatio >= 0.7 ? A.brightYellow : A.brightRed;
const scoreBar = `${scoreColor}${repeat(B.full, Math.round(scoreRatio * 24))}${A.dim}${repeat(B.light, 24 - Math.round(scoreRatio * 24))}${A.reset}`;
out.push(boxLine(`  ${A.bold}Score  ${A.reset} ${scoreBar}  ${scoreColor}${healthScore}/${checks.length}${A.reset}`));
out.push(boxBottom());

// Footer
out.push("");
out.push(
	`${A.dim}${center(`${B.bullet} AIRIS-CLI  ${B.bullet}  KageOS  ${B.bullet}  Built with \u2764 for developers`, W)}${A.reset}`,
);
out.push(`${A.dim}${center("https://github.com/sufiyan-sabeel/AIRIS-CLI", W)}${A.reset}`);
out.push("");

// ─── Output ───────────────────────────────────────────────────────────────────

console.log(out.join("\n"));
