#!/usr/bin/env node
/**
 * AIRIS-CLI Professional Terminal Dashboard
 *
 * Displays system health, package info, source metrics, git status,
 * and environment details in a formatted terminal layout.
 *
 * Usage: node --experimental-strip-types packages/coding-agent/src/cli/dashboard.ts
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { cpus, freemem, homedir, hostname, platform, release, totalmem, uptime } from "node:os";
import { extname, join } from "node:path";

// ─── ANSI Colors ──────────────────────────────────────────────────────────────

const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	underline: "\x1b[4m",

	black: "\x1b[30m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	gray: "\x1b[90m",

	bgBlack: "\x1b[40m",
	bgRed: "\x1b[41m",
	bgGreen: "\x1b[42m",
	bgYellow: "\x1b[43m",
	bgBlue: "\x1b[44m",
	bgMagenta: "\x1b[45m",
	bgCyan: "\x1b[46m",
	bgWhite: "\x1b[47m",

	brightRed: "\x1b[91m",
	brightGreen: "\x1b[92m",
	brightYellow: "\x1b[93m",
	brightBlue: "\x1b[94m",
	brightMagenta: "\x1b[95m",
	brightCyan: "\x1b[96m",
	brightWhite: "\x1b[97m",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
		const entries = readdirSync(dir);
		for (const entry of entries) {
			if (exclude.includes(entry) || entry === "node_modules" || entry === ".git") continue;
			const full = join(dir, entry);
			try {
				const st = statSync(full);
				if (st.isDirectory()) {
					count += countDir(full, ext, exclude);
				} else if (ext.startsWith("*.")) {
					// Pattern like "*.test.ts" — match filename suffix
					if (entry.endsWith(ext.slice(1))) count++;
				} else if (extname(entry) === ext) {
					count++;
				}
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
		const entries = readdirSync(dir);
		for (const entry of entries) {
			if (exclude.includes(entry) || entry === "node_modules" || entry === ".git") continue;
			const full = join(dir, entry);
			try {
				const st = statSync(full);
				if (st.isDirectory()) {
					lines += countLines(full, ext, exclude);
				} else {
					const match = ext.startsWith("*.") ? entry.endsWith(ext.slice(1)) : extname(entry) === ext;
					if (match) {
						const content = readFileSync(full, "utf-8");
						lines += content.split("\n").length;
					}
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

// ─── Box Drawing ──────────────────────────────────────────────────────────────

const BOX = {
	tl: "┌",
	tr: "┐",
	bl: "└",
	br: "┘",
	h: "─",
	v: "│",
	lt: "├",
	rt: "┤",
	tt: "┬",
	bt: "┴",
	cr: "┼",
};

function repeat(ch: string, n: number): string {
	return ch.repeat(Math.max(0, n));
}

function boxLine(text: string, width: number, color: string): string {
	const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
	const padding = width - stripped.length - 4;
	return `${color}${BOX.v}${C.reset} ${text}${padding > 0 ? repeat(" ", padding) : ""} ${color}${BOX.v}${C.reset}`;
}

function _boxTop(width: number, color: string): string {
	return `${color}${BOX.tl}${repeat(BOX.h, width - 2)}${BOX.tr}${C.reset}`;
}

function boxBottom(width: number, color: string): string {
	return `${color}${BOX.bl}${repeat(BOX.h, width - 2)}${BOX.br}${C.reset}`;
}

function boxSeparator(width: number, color: string): string {
	return `${color}${BOX.lt}${repeat(BOX.h, width - 2)}${BOX.rt}${C.reset}`;
}

// ─── Section Header ───────────────────────────────────────────────────────────

function sectionHeader(icon: string, title: string, width: number): string[] {
	const lines: string[] = [];
	const titleText = ` ${icon} ${title} `;
	const padLeft = Math.floor((width - 2 - titleText.length) / 2);
	const padRight = width - 2 - titleText.length - padLeft;
	lines.push(
		`${C.cyan}${BOX.tt}${repeat(BOX.h, padLeft)}${C.reset}${C.bold}${C.brightCyan}${titleText}${C.reset}${C.cyan}${repeat(BOX.h, padRight)}${BOX.tt}${C.reset}`,
	);
	return lines;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function progressBar(value: number, max: number, width: number, color: string): string {
	const ratio = Math.min(1, Math.max(0, value / max));
	const filled = Math.round(ratio * width);
	const empty = width - filled;
	const pct = Math.round(ratio * 100);

	let barColor = color;
	if (ratio > 0.9) barColor = C.red;
	else if (ratio > 0.7) barColor = C.yellow;

	return `${barColor}${repeat("█", filled)}${C.dim}${repeat("░", empty)}${C.reset} ${String(pct).padStart(3)}%`;
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

function metricRow(label: string, value: string, width: number): string {
	const labelW = 18;
	const valueW = width - labelW - 5;
	const labelStr = `${C.dim}${label.padEnd(labelW)}${C.reset}`;
	const valueStr = `${C.bold}${C.brightWhite}${value.padEnd(valueW)}${C.reset}`;
	return boxLine(`${labelStr} ${valueStr}`, width, C.white);
}

// ─── Gather Data ──────────────────────────────────────────────────────────────

// Find repo root by walking up from cwd looking for package.json with workspaces
let ROOT = process.cwd();
while (ROOT !== "/" && ROOT !== ".") {
	if (existsSync(join(ROOT, "package.json")) && existsSync(join(ROOT, "packages"))) break;
	ROOT = join(ROOT, "..");
}
if (!existsSync(join(ROOT, "packages"))) ROOT = process.cwd();
const PACKAGES_DIR = join(ROOT, "packages");
const excludeDirs = ["node_modules", ".git", ".airis", ".husky", "dist", "build"];

// System info
const memTotal = totalmem();
const memFree = freemem();
const memUsed = memTotal - memFree;
const cpuInfo = cpus();
const cpuModel = cpuInfo[0]?.model || "unknown";
const cpuCores = cpuInfo.length;
const sysUptime = uptime();
const uptimeH = Math.floor(sysUptime / 3600);
const uptimeM = Math.floor((sysUptime % 3600) / 60);

// Git info
const gitBranch = run("git rev-parse --abbrev-ref HEAD");
const gitCommit = run("git rev-parse --short HEAD");
const gitCommitCount = run("git rev-list --count HEAD 2>/dev/null");
const gitLastMsg = run("git log -1 --pretty=%s");
const gitAhead = run("git rev-list --count origin/main..HEAD 2>/dev/null");
const gitBehind = run("git rev-list --count HEAD..origin/main 2>/dev/null");
const gitStatus = run("git status --porcelain");
const gitModified = (gitStatus.match(/^ ?M/gm) || []).length;
const gitUntracked = (gitStatus.match(/^\?\?/gm) || []).length;
const gitStaged = (gitStatus.match(/^M/gm) || []).length;

// Package info
const packages: Record<string, { version: string; description: string; files: number; lines: number; deps: number }> =
	{};
const pkgDirs = existsSync(PACKAGES_DIR) ? readdirSync(PACKAGES_DIR) : [];
for (const dir of pkgDirs) {
	const pkgJsonPath = join(PACKAGES_DIR, dir, "package.json");
	if (!existsSync(pkgJsonPath)) continue;
	try {
		const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
		const srcDir = join(PACKAGES_DIR, dir, "src");
		const files = countDir(srcDir, ".ts", excludeDirs);
		const lines = countDir(srcDir, ".ts", excludeDirs) > 0 ? countLines(srcDir, ".ts", excludeDirs) : 0;
		const deps = Object.keys({ ...pkgJson.dependencies, ...pkgJson.devDependencies }).length;
		packages[dir] = {
			version: pkgJson.version || "0.0.0",
			description: pkgJson.description || "",
			files,
			lines,
			deps,
		};
	} catch {
		/* skip */
	}
}

// Source metrics per extension
const srcDir = join(ROOT, "packages");
const tsFiles = countDir(srcDir, ".ts", excludeDirs);
const tsLines = countLines(srcDir, ".ts", excludeDirs);
const jsFiles = countDir(srcDir, ".js", excludeDirs);
const jsLines = countLines(srcDir, ".js", excludeDirs);
const mdFiles = countDir(ROOT, ".md", excludeDirs);
const jsonFiles = countDir(ROOT, ".json", excludeDirs);

// Test metrics
const testDir = join(ROOT, "packages");
const testFiles = countDir(testDir, "*.test.ts", excludeDirs);
const testLines = countLines(testDir, "*.test.ts", excludeDirs);

// Slash commands count
const slashCmdsFile = readFile(join(PACKAGES_DIR, "coding-agent", "src", "core", "slash-commands.ts"));
const slashCmdCount = (slashCmdsFile.match(/\{ name:\s*["`/]/g) || []).length;

// Health checks
const nodeVersion = process.version;
const npmVersion = run("npm --version");
const biomeVersion = run("/tmp/biome-bin --version 2>/dev/null") || "N/A";
const tscVersion = run("node node_modules/typescript/bin/tsc --version 2>/dev/null") || "N/A";

// Disk usage
const diskUsed = run("df -h . 2>/dev/null | tail -1 | awk '{print $3}'") || "?";
const diskTotal = run("df -h . 2>/dev/null | tail -1 | awk '{print $2}'") || "?";
const diskPct = run("df -h . 2>/dev/null | tail -1 | awk '{print $5}'") || "?";

// ─── Render Dashboard ─────────────────────────────────────────────────────────

const W = 72;
const lines: string[] = [];

// Title
lines.push("");
lines.push(`${C.bold}${C.brightCyan}${repeat("═", W)}${C.reset}`);
lines.push(`${C.bold}${C.brightCyan}  ╔${repeat("═", W - 4)}╗${C.reset}`);
lines.push(
	`${C.bold}${C.brightCyan}  ║${C.reset}${C.bold}${C.brightWhite}${" AIRIS-CLI DASHBOARD ".padStart(Math.floor((W - 4 + 20) / 2))}${C.reset}${C.bold}${C.brightCyan}${" ".repeat(W - 4 - Math.floor((W - 4 + 20) / 2))}║${C.reset}`,
);
lines.push(
	`${C.bold}${C.brightCyan}  ║${C.reset}${C.dim}${` ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC `.padStart(Math.floor((W - 4 + 30) / 2))}${C.reset}${C.bold}${C.brightCyan}${" ".repeat(W - 4 - Math.floor((W - 4 + 30) / 2))}║${C.reset}`,
);
lines.push(`${C.bold}${C.brightCyan}  ╚${repeat("═", W - 4)}╝${C.reset}`);
lines.push(`${C.bold}${C.brightCyan}${repeat("═", W)}${C.reset}`);

// ── System Health ──
lines.push(...sectionHeader("♥", "SYSTEM HEALTH", W));
lines.push(boxLine(`${C.bold}Hostname${C.reset}   ${hostname()}`, W, C.white));
lines.push(boxLine(`${C.bold}Platform${C.reset}   ${platform()} ${release()}`, W, C.white));
lines.push(boxLine(`${C.bold}Uptime${C.reset}     ${uptimeH}h ${uptimeM}m`, W, C.white));
lines.push(boxLine(`${C.bold}CPU${C.reset}        ${cpuModel.slice(0, 40)}`, W, C.white));
lines.push(boxLine(`${C.bold}Cores${C.reset}      ${cpuCores}`, W, C.white));
lines.push(boxSeparator(W, C.white));
lines.push(boxLine(`${C.bold}Memory${C.reset}     ${progressBar(memUsed, memTotal, 30, C.green)}`, W, C.white));
lines.push(
	boxLine(
		`${C.dim}             Used: ${(memUsed / 1073741824).toFixed(1)}GB / ${(memTotal / 1073741824).toFixed(1)}GB${C.reset}`,
		W,
		C.white,
	),
);
lines.push(boxLine(`${C.bold}Disk${C.reset}        ${diskUsed} / ${diskTotal} (${diskPct} used)`, W, C.white));
lines.push(boxBottom(W, C.white));

// ── Environment ──
lines.push("");
lines.push(...sectionHeader("⚙", "ENVIRONMENT", W));
lines.push(metricRow("Node.js", nodeVersion, W));
lines.push(metricRow("npm", npmVersion, W));
lines.push(metricRow("TypeScript", tscVersion, W));
lines.push(metricRow("Biome", biomeVersion, W));
lines.push(metricRow("Home", homedir(), W));
lines.push(boxBottom(W, C.white));

// ── Git Status ──
lines.push("");
lines.push(...sectionHeader("⊞", "GIT STATUS", W));
lines.push(metricRow("Branch", gitBranch, W));
lines.push(metricRow("Commit", `${gitCommit} (${gitCommitCount} total)`, W));
lines.push(metricRow("Last Message", gitLastMsg.slice(0, 42), W));
lines.push(boxSeparator(W, C.white));
lines.push(
	boxLine(
		`${C.bold}Ahead / Behind${C.reset}  ${C.brightGreen}↑${gitAhead || "0"}${C.reset}  ${C.brightRed}↓${gitBehind || "0"}${C.reset}`,
		W,
		C.white,
	),
);
lines.push(
	boxLine(
		`${C.bold}Working Tree${C.reset}  ${gitStaged > 0 ? `${C.brightGreen}${gitStaged} staged${C.reset}` : ""} ${gitModified > 0 ? `${C.brightYellow}${gitModified} modified${C.reset}` : ""} ${gitUntracked > 0 ? `${C.dim}${gitUntracked} untracked${C.reset}` : ""} ${gitStaged === 0 && gitModified === 0 && gitUntracked === 0 ? `${C.brightGreen}clean${C.reset}` : ""}`,
		W,
		C.white,
	),
);
lines.push(boxBottom(W, C.white));

// ── Source Code Metrics ──
lines.push("");
lines.push(...sectionHeader("◉", "SOURCE CODE", W));
lines.push(
	boxLine(
		`${C.bold}TypeScript${C.reset}   ${C.brightCyan}${String(tsFiles).padStart(5)} files${C.reset}  ${C.brightWhite}${String(tsLines).padStart(7)} lines${C.reset}`,
		W,
		C.white,
	),
);
lines.push(
	boxLine(
		`${C.bold}JavaScript${C.reset}   ${C.brightCyan}${String(jsFiles).padStart(5)} files${C.reset}  ${C.brightWhite}${String(jsLines).padStart(7)} lines${C.reset}`,
		W,
		C.white,
	),
);
lines.push(
	boxLine(`${C.bold}Markdown${C.reset}     ${C.brightCyan}${String(mdFiles).padStart(5)} files${C.reset}`, W, C.white),
);
lines.push(
	boxLine(
		`${C.bold}JSON${C.reset}         ${C.brightCyan}${String(jsonFiles).padStart(5)} files${C.reset}`,
		W,
		C.white,
	),
);
lines.push(boxSeparator(W, C.white));
lines.push(
	boxLine(
		`${C.bold}Tests${C.reset}       ${C.brightCyan}${String(testFiles).padStart(5)} files${C.reset}  ${C.brightWhite}${String(testLines).padStart(7)} lines${C.reset}`,
		W,
		C.white,
	),
);
lines.push(
	boxLine(
		`${C.bold}Slash Commands${C.reset} ${C.brightMagenta}${String(slashCmdCount).padStart(3)} registered${C.reset}`,
		W,
		C.white,
	),
);
lines.push(boxBottom(W, C.white));

// ── Packages ──
lines.push("");
lines.push(...sectionHeader("◈", "PACKAGES", W));
lines.push(
	boxLine(
		`${C.bold}${"Package".padEnd(18)}${"Version".padEnd(10)}${"Files".padEnd(8)}${"Lines".padEnd(10)}${"Deps"}${C.reset}`,
		W,
		C.cyan,
	),
);

const pkgNames = Object.keys(packages).sort();
let totalFiles = 0;
let totalLines = 0;
for (const name of pkgNames) {
	const pkg = packages[name];
	totalFiles += pkg.files;
	totalLines += pkg.lines;
	const nameStr = `${C.brightWhite}${name.padEnd(18)}${C.reset}`;
	const verStr = `${C.brightGreen}${pkg.version.padEnd(10)}${C.reset}`;
	const fileStr = `${C.brightCyan}${String(pkg.files).padEnd(8)}${C.reset}`;
	const lineStr = `${C.brightWhite}${String(pkg.lines).padEnd(10)}${C.reset}`;
	const depStr = `${C.dim}${String(pkg.deps)}${C.reset}`;
	lines.push(boxLine(`${nameStr}${verStr}${fileStr}${lineStr}${depStr}`, W, C.white));
}
lines.push(boxSeparator(W, C.white));
lines.push(
	boxLine(
		`${C.bold}${"TOTAL".padEnd(18)}${"".padEnd(10)}${C.brightCyan}${String(totalFiles).padEnd(8)}${C.reset}${C.brightWhite}${String(totalLines).padEnd(10)}${C.reset}`,
		W,
		C.cyan,
	),
);
lines.push(boxBottom(W, C.white));

// ── Health Summary ──
lines.push("");
lines.push(...sectionHeader("✦", "HEALTH SUMMARY", W));

const healthItems: { label: string; ok: boolean; detail: string }[] = [
	{ label: "Node.js installed", ok: !!nodeVersion, detail: nodeVersion },
	{ label: "npm available", ok: !!npmVersion, detail: npmVersion },
	{ label: "TypeScript compiler", ok: !!tscVersion, detail: tscVersion },
	{ label: "Biome linter", ok: !!biomeVersion && biomeVersion !== "N/A", detail: biomeVersion },
	{ label: "Git repository", ok: !!gitBranch, detail: gitBranch },
	{
		label: "Clean working tree",
		ok: gitModified === 0 && gitUntracked === 0,
		detail: gitModified === 0 && gitUntracked === 0 ? "clean" : `${gitModified} modified, ${gitUntracked} untracked`,
	},
	{
		label: "Memory healthy",
		ok: memUsed / memTotal < 0.9,
		detail: `${((memUsed / memTotal) * 100).toFixed(0)}% used`,
	},
	{
		label: "Source code present",
		ok: totalFiles > 0,
		detail: `${totalFiles} files, ${totalLines.toLocaleString()} lines`,
	},
];

let healthScore = 0;
for (const item of healthItems) {
	const icon = item.ok ? `${C.brightGreen}✓${C.reset}` : `${C.brightRed}✗${C.reset}`;
	const statusColor = item.ok ? C.brightGreen : C.brightRed;
	if (item.ok) healthScore++;
	lines.push(boxLine(`  ${icon} ${item.label.padEnd(24)} ${statusColor}${item.detail}${C.reset}`, W, C.white));
}

lines.push(boxSeparator(W, C.white));
const scoreColor =
	healthScore === healthItems.length
		? C.brightGreen
		: healthScore >= healthItems.length * 0.75
			? C.brightYellow
			: C.brightRed;
lines.push(
	boxLine(
		`${C.bold}Health Score${C.reset}  ${scoreColor}${repeat("█", Math.round((healthScore / healthItems.length) * 20))}${C.dim}${repeat("░", 20 - Math.round((healthScore / healthItems.length) * 20))}${C.reset}  ${scoreColor}${healthScore}/${healthItems.length}${C.reset}`,
		W,
		C.white,
	),
);
lines.push(boxBottom(W, C.white));

// Footer
lines.push("");
lines.push(
	`${C.dim}${" ".repeat(Math.floor((W - 40) / 2))}AIRIS-CLI v${packages["coding-agent"]?.version || "?"} — AI Runtime Intelligence System${C.reset}`,
);
lines.push(`${C.dim}${" ".repeat(Math.floor((W - 28) / 2))}https://github.com/sufiyan-sabeel/AIRIS-CLI${C.reset}`);
lines.push("");

// ─── Output ───────────────────────────────────────────────────────────────────

console.log(lines.join("\n"));
