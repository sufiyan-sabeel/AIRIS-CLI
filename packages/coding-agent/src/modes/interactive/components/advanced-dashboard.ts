/**
 * Advanced Dashboard Component
 *
 * Provides an animated dashboard with session statistics, cache stats,
 * provider info, thinking level indicator, achievement badges, and more.
 * Respects NO_COLOR, NO_ANIMATION, LOW_RESOURCE environment variables.
 */

import { type Component } from "@sufiyan-sabeel/airis-tui";
import type { AgentSession } from "../../../core/agent-session.ts";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.ts";
import { generateCacheReport } from "../../../core/cache-stats.ts";
import { theme } from "../theme/theme.ts";

// ============================================================================
// Environment Detection
// ============================================================================

const NO_COLOR = process.env.NO_COLOR !== undefined;
const NO_ANIMATION = process.env.NO_ANIMATION !== undefined;
const LOW_RESOURCE = process.env.LOW_RESOURCE !== undefined;

// ============================================================================
// Types
// ============================================================================

export interface DashboardOptions {
	/** Show session statistics card */
	showSessionStats?: boolean;
	/** Show cache statistics panel */
	showCacheStats?: boolean;
	/** Show provider panel */
	showProviderPanel?: boolean;
	/** Show thinking level indicator */
	showThinkingIndicator?: boolean;
	/** Show achievement badges */
	showAchievements?: boolean;
	/** Animation speed multiplier (0-2) */
	animationSpeed?: number;
}

interface SessionStats {
	messageCount: number;
	toolCalls: number;
	turns: number;
	branches: number;
	uptime: number;
	totalTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
}

interface CacheStats {
	hitRate: number;
	missCount: number;
	wastedTokens: number;
	wastedCost: number;
	modelChanges: number;
}

interface ProviderInfo {
	name: string;
	model: string;
	thinkingLevel: string;
	latency: number;
}

// ============================================================================
// Animation Helpers
// ============================================================================

const FRAMES = {
	spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
	dots: ["", ".", "..", "..."],
	pulse: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"],
	gradient: [
		"░░░░░░░░░░",
		"▒░░░░░░░░░",
		"▒▒░░░░░░░░",
		"▓▒▒░░░░░░░",
		"█▓▒▒░░░░░░",
		"██▓▒▒░░░░░",
		"███▓▒▒░░░░",
		"████▓▒▒░░░",
		"█████▓▒▒░░",
		"██████▓▒▒░",
		"███████▓▒▒",
		"████████▓▒",
		"█████████▓",
		"██████████",
	],
};

let animationFrame = 0;

function getFrame<T>(frames: T[], speed = 1): T {
	if (NO_ANIMATION || LOW_RESOURCE) return frames[0];
	const index = Math.floor(animationFrame * speed) % frames.length;
	animationFrame++;
	return frames[index];
}

function gradientText(text: string, colors: string[]): string {
	if (NO_COLOR) return text;
	// Simple gradient by distributing colors across characters
	return text
		.split("")
		.map((char, i) => {
			const colorIndex = Math.floor((i / Math.max(1, text.length - 1)) * (colors.length - 1));
			return theme.fg(colors[colorIndex], char);
		})
		.join("");
}

// ============================================================================
// Statistics Computation
// ============================================================================

function computeSessionStats(session: AgentSession): SessionStats {
	const entries = session.entries;
	let messageCount = 0;
	let toolCalls = 0;
	let turns = 0;
	let branches = 0;
	let totalTokens = 0;
	let cacheReadTokens = 0;
	let cacheWriteTokens = 0;

	for (const entry of entries) {
		if (entry.type === "message") {
			messageCount++;
			if (entry.message.role === "assistant") {
				const usage = entry.message.usage;
				if (usage) {
					totalTokens += usage.input + usage.output;
					cacheReadTokens += usage.cacheRead || 0;
					cacheWriteTokens += usage.cacheWrite || 0;
				}
			}
			if (entry.message.role === "tool") {
				toolCalls++;
			}
		}
		if (entry.type === "turn_start") {
			turns++;
		}
		if (entry.type === "branch_summary") {
			branches++;
		}
	}

	// Calculate uptime from first entry
	const firstEntry = entries[0];
	const uptime = firstEntry ? Date.now() - firstEntry.timestamp : 0;

	return {
		messageCount,
		toolCalls,
		turns,
		branches,
		uptime,
		totalTokens,
		cacheReadTokens,
		cacheWriteTokens,
	};
}

function getProviderInfo(): ProviderInfo {
	// This would integrate with the actual model runtime
	return {
		name: "AIRIS",
		model: "current",
		thinkingLevel: "adaptive",
		latency: 0,
	};
}

// ============================================================================
// Achievement System
// ============================================================================

interface Achievement {
	id: string;
	name: string;
	description: string;
	icon: string;
	color: string;
	check: (stats: SessionStats, cache: CacheStats) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
	{
		id: "first_message",
		name: "First Steps",
		description: "Sent your first message",
		icon: "👶",
		color: "success",
		check: (s) => s.messageCount >= 1,
	},
	{
		id: "ten_messages",
		name: "Conversationalist",
		description: "Exchanged 10 messages",
		icon: "💬",
		color: "info",
		check: (s) => s.messageCount >= 10,
	},
	{
		id: "tool_master",
		name: "Tool Master",
		description: "Executed 25 tool calls",
		icon: "🔧",
		color: "warning",
		check: (s) => s.toolCalls >= 25,
	},
	{
		id: "cache_saver",
		name: "Cache Saver",
		description: "Achieved 80% cache hit rate",
		icon: "💾",
		color: "success",
		check: (_, c) => c.hitRate >= 0.8 && c.missCount > 5,
	},
	{
		id: "marathon",
		name: "Marathon Runner",
		description: "Session lasting over 1 hour",
		icon: "🏃",
		color: "primary",
		check: (s) => s.uptime >= 3600000,
	},
	{
		id: "branch_explorer",
		name: "Branch Explorer",
		description: "Created 5 session branches",
		icon: "🌿",
		color: "info",
		check: (s) => s.branches >= 5,
	},
	{
		id: "token_millionaire",
		name: "Token Millionaire",
		description: "Processed 1M tokens in a session",
		icon: "💰",
		color: "warning",
		check: (s) => s.totalTokens >= 1_000_000,
	},
];

function getUnlockedAchievements(stats: SessionStats, cache: CacheStats): Achievement[] {
	return ACHIEVEMENTS.filter((a) => a.check(stats, cache));
}

// ============================================================================
// Dashboard Component
// ============================================================================

export class DashboardComponent implements Component {
	private session: AgentSession;
	private options: Required<DashboardOptions>;
	private lastRender = 0;
	private cachedOutput = "";
	private achievements: Achievement[] = [];

	constructor(
		session: AgentSession,
		footerData: ReadonlyFooterDataProvider,
		options: DashboardOptions = {},
	) {
		this.session = session;
		this.options = {
			showSessionStats: options.showSessionStats ?? true,
			showCacheStats: options.showCacheStats ?? true,
			showProviderPanel: options.showProviderPanel ?? true,
			showThinkingIndicator: options.showThinkingIndicator ?? true,
			showAchievements: options.showAchievements ?? true,
			animationSpeed: options.animationSpeed ?? 1,
		};
	}

	setSession(session: AgentSession): void {
		this.session = session;
		this.cachedOutput = ""; // Invalidate cache
	}

	render(width: number): string[] {
		// Throttle renders to avoid excessive computation
		const now = Date.now();
		if (now - this.lastRender < (LOW_RESOURCE ? 1000 : 200) && this.cachedOutput) {
			return this.cachedOutput.split("\n");
		}
		this.lastRender = now;

		const stats = computeSessionStats(this.session);
		const cacheReport = generateCacheReport(this.session.entries, {
			getModel: () => ({ cost: { cacheRead: 0 } }),
		});

		const cacheStats: CacheStats = {
			hitRate: cacheReport.hitRate,
			missCount: cacheReport.waste.missCount,
			wastedTokens: cacheReport.waste.missedTokens,
			wastedCost: cacheReport.waste.missedCost,
			modelChanges: cacheReport.modelChangeCount,
		};

		this.achievements = getUnlockedAchievements(stats, cacheStats);
		const provider = getProviderInfo();

		const lines: string[] = [];

		// Header
		lines.push(this.renderHeader(width));
		lines.push("");

		// Session Stats Card
		if (this.options.showSessionStats) {
			lines.push(...this.renderSessionStats(stats, width));
			lines.push("");
		}

		// Cache Stats Panel
		if (this.options.showCacheStats) {
			lines.push(...this.renderCacheStats(cacheStats, width));
			lines.push("");
		}

		// Provider Panel
		if (this.options.showProviderPanel) {
			lines.push(...this.renderProviderPanel(provider, width));
			lines.push("");
		}

		// Thinking Level Indicator
		if (this.options.showThinkingIndicator) {
			lines.push(...this.renderThinkingIndicator(width));
			lines.push("");
		}

		// Achievements
		if (this.options.showAchievements && this.achievements.length > 0) {
			lines.push(...this.renderAchievements(width));
		}

		this.cachedOutput = lines.join("\n");
		return lines;
	}

	private renderHeader(_width: number): string {
		const title = "AIRIS DASHBOARD";
		const spinner = getFrame(FRAMES.spinner, this.options.animationSpeed);
		const pulse = getFrame(FRAMES.pulse, this.options.animationSpeed);

		if (NO_COLOR) {
			return `${title} ${spinner}`;
		}

		const colors = ["primary", "info", "success", "warning", "error", "info", "primary"];
		return `${gradientText(title, colors)} ${theme.fg("muted", spinner)} ${theme.fg("muted", pulse)}`;
	}

	private renderSessionStats(stats: SessionStats, width: number): string[] {
		const cardWidth = Math.min(width - 4, 60);
		const border = "─".repeat(cardWidth);
		const pad = " ".repeat(2);

		const formatNumber = (n: number) =>
			n >= 1000000
				? `${(n / 1000000).toFixed(1)}M`
				: n >= 1000
					? `${(n / 1000).toFixed(1)}k`
					: n.toString();

		const uptimeHours = Math.floor(stats.uptime / 3600000);
		const uptimeMinutes = Math.floor((stats.uptime % 3600000) / 60000);
		const uptimeStr = uptimeHours > 0 ? `${uptimeHours}h ${uptimeMinutes}m` : `${uptimeMinutes}m`;

		const lines = [
			theme.fg("border", `┌${border}┐`),
			`${pad}${theme.fg("primary", "📊 SESSION STATISTICS")}`,
			theme.fg("border", `├${border}┤`),
			`${pad}Messages:      ${theme.fg("info", formatNumber(stats.messageCount))}`,
			`${pad}Tool Calls:    ${theme.fg("success", formatNumber(stats.toolCalls))}`,
			`${pad}Turns:         ${theme.fg("warning", formatNumber(stats.turns))}`,
			`${pad}Branches:      ${theme.fg("info", formatNumber(stats.branches))}`,
			`${pad}Uptime:        ${theme.fg("muted", uptimeStr)}`,
			`${pad}Total Tokens:  ${theme.fg("primary", formatNumber(stats.totalTokens))}`,
			`${pad}Cache Reads:   ${theme.fg("success", formatNumber(stats.cacheReadTokens))}`,
			`${pad}Cache Writes:  ${theme.fg("warning", formatNumber(stats.cacheWriteTokens))}`,
			theme.fg("border", `└${border}┘`),
		];

		return lines;
	}

	private renderCacheStats(cache: CacheStats, width: number): string[] {
		const cardWidth = Math.min(width - 4, 60);
		const border = "─".repeat(cardWidth);
		const pad = " ".repeat(2);

		const hitRatePct = (cache.hitRate * 100).toFixed(1);
		const hitRateColor =
			cache.hitRate >= 0.8 ? "success" : cache.hitRate >= 0.5 ? "warning" : "error";

		// Visual bar for hit rate
		const barWidth = 20;
		const filled = Math.round(cache.hitRate * barWidth);
		const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);

		const lines = [
			theme.fg("border", `┌${border}┐`),
			`${pad}${theme.fg("primary", "💾 CACHE ANALYTICS")}`,
			theme.fg("border", `├${border}┤`),
			`${pad}Hit Rate:    ${theme.fg(hitRateColor, `${hitRatePct}%`)} ${theme.fg("muted", bar)}`,
			`${pad}Misses:      ${theme.fg("error", cache.missCount.toString())}`,
			`${pad}Wasted:      ${theme.fg("warning", cache.wastedTokens.toLocaleString())} tokens ($${cache.wastedCost.toFixed(4)})`,
			`${pad}Model Chgs:  ${theme.fg("info", cache.modelChanges.toString())}`,
			theme.fg("border", `└${border}┘`),
		];

		return lines;
	}

	private renderProviderPanel(provider: ProviderInfo, width: number): string[] {
		const cardWidth = Math.min(width - 4, 60);
		const border = "─".repeat(cardWidth);
		const pad = " ".repeat(2);

		const lines = [
			theme.fg("border", `┌${border}┐`),
			`${pad}${theme.fg("primary", "🤖 PROVIDER PANEL")}`,
			theme.fg("border", `├${border}┤`),
			`${pad}Provider:    ${theme.fg("info", provider.name)}`,
			`${pad}Model:       ${theme.fg("success", provider.model)}`,
			`${pad}Thinking:    ${theme.fg("warning", provider.thinkingLevel)}`,
			`${pad}Latency:     ${theme.fg("muted", `${provider.latency}ms`)}`,
			theme.fg("border", `└${border}┘`),
		];

		return lines;
	}

	private renderThinkingIndicator(width: number): string[] {
		const cardWidth = Math.min(width - 4, 60);
		const pad = " ".repeat(2);

		const levels = ["minimal", "low", "medium", "high", "adaptive"];
		const currentLevel = "adaptive"; // Would come from actual state
		const levelIndex = levels.indexOf(currentLevel);

		const bar = levels
			.map((l, i) => {
				const filled = i <= levelIndex;
				return filled ? theme.fg("primary", "█") : theme.fg("muted", "░");
			})
			.join("");

		return [
			`${pad}${theme.fg("primary", "🧠 THINKING LEVEL")}`,
			`${pad}${bar} ${theme.fg("info", currentLevel.toUpperCase())}`,
			`${pad}${theme.fg("muted", "Adaptive thinking adjusts depth based on task complexity")}`,
		];
	}

	private renderAchievements(width: number): string[] {
		const cardWidth = Math.min(width - 4, 60);
		const border = "─".repeat(cardWidth);
		const pad = " ".repeat(2);

		const lines = [
			theme.fg("border", `┌${border}┐`),
			`${pad}${theme.fg("primary", "🏆 ACHIEVEMENTS")} ${theme.fg("muted", `(${this.achievements.length}/${ACHIEVEMENTS.length})`)}`,
			theme.fg("border", `├${border}┤`),
		];

		for (const achievement of this.achievements.slice(0, 5)) {
			const icon = NO_COLOR ? achievement.icon : theme.fg(achievement.color as any, achievement.icon);
			lines.push(`${pad}${icon} ${theme.fg("text", achievement.name)} ${theme.fg("muted", `─ ${achievement.description}`)}`);
		}

		if (this.achievements.length > 5) {
			lines.push(`${pad}${theme.fg("muted", `... and ${this.achievements.length - 5} more`)}`);
		}

		lines.push(theme.fg("border", `└${border}┘`));
		return lines;
	}
}

/**
 * Create a dashboard component with default options
 */
export function createDashboard(
	session: AgentSession,
	footerData: ReadonlyFooterDataProvider,
	options?: DashboardOptions,
): DashboardComponent {
	return new DashboardComponent(session, footerData, options);
}

/**
 * Mini dashboard for inline display (single line)
 */
export function renderMiniDashboard(
	session: AgentSession,
	footerData: ReadonlyFooterDataProvider,
	width: number,
): string {
	const stats = computeSessionStats(session);
	const cacheReport = generateCacheReport(session.entries, {
		getModel: () => ({ cost: { cacheRead: 0 } }),
	});

	const hitRate = (cacheReport.hitRate * 100).toFixed(0);
	const parts = [
		`📊 ${stats.messageCount} msg`,
		`🔧 ${stats.toolCalls} tools`,
		`💾 ${hitRate}% cache`,
	];

	if (NO_COLOR) {
		return parts.join(" | ");
	}

	return parts
		.map((p, i) => {
			const colors = ["info", "success", "warning"];
			return theme.fg(colors[i] as any, p);
		})
		.join(theme.fg("muted", " │ "));
}