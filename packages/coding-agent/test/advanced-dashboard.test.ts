/**
 * Tests for advanced-dashboard.ts - Advanced dashboard component
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import type { AgentSession } from "../src/core/agent-session.ts";
import type { ReadonlyFooterDataProvider } from "../src/core/footer-data-provider.ts";
import {
	DashboardComponent,
	createDashboard,
	renderMiniDashboard,
	type DashboardOptions,
} from "../src/modes/interactive/components/advanced-dashboard.ts";
import { computeCacheWaste, generateCacheReport } from "../src/core/cache-stats.ts";

function createMockSession(overrides: Partial<{
	entries: any[];
	state: any;
}> = {}): AgentSession {
	const defaultEntries = [
		{
			type: "message",
			message: {
				role: "user",
				content: "Hello",
				timestamp: 1000,
			},
			timestamp: 1000,
		},
		{
			type: "message",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Hi there!" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5",
				usage: {
					input: 100,
					output: 50,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 150,
					cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
				},
				stopReason: "stop",
				timestamp: 2000,
			},
			timestamp: 2000,
		},
	];

	return {
		entries: overrides.entries ?? defaultEntries,
		sessionManager: {
			getEntries: () => overrides.entries ?? defaultEntries,
			getCwd: () => "/test",
			getSessionName: () => "test-session",
		},
		state: overrides.state ?? {
			model: { id: "claude-sonnet-4-5", provider: "anthropic", reasoning: true },
			thinkingLevel: "high",
		},
		agent: {
			state: {
				messages: [],
			},
		},
	} as unknown as AgentSession;
}

function createMockFooterData(): ReadonlyFooterDataProvider {
	return {
		getGitBranch: () => "main",
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: (cb: () => void) => () => {},
	};
}

describe("advanced-dashboard", () => {
	let mockSession: AgentSession;
	let mockFooterData: ReadonlyFooterDataProvider;

	beforeEach(() => {
		mockSession = createMockSession();
		mockFooterData = createMockFooterData();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("DashboardComponent", () => {
		it("creates dashboard with default options", () => {
			const dashboard = new DashboardComponent(mockSession, mockFooterData);
			expect(dashboard).toBeInstanceOf(DashboardComponent);
		});

		it("creates dashboard with custom options", () => {
			const options: DashboardOptions = {
				showSessionStats: false,
				showCacheStats: true,
				showProviderPanel: false,
				showThinkingIndicator: true,
				showAchievements: false,
				animationSpeed: 0.5,
			};
			const dashboard = new DashboardComponent(mockSession, mockFooterData, options);
			expect(dashboard).toBeInstanceOf(DashboardComponent);
		});

		it("renders dashboard output", () => {
			const dashboard = new DashboardComponent(mockSession, mockFooterData);
			const lines = dashboard.render(80);

			expect(Array.isArray(lines)).toBe(true);
			expect(lines.length).toBeGreaterThan(0);
			expect(lines[0]).toContain("AIRIS DASHBOARD");
		});

		it("respects NO_COLOR environment variable", () => {
			process.env.NO_COLOR = "1";
			const dashboard = new DashboardComponent(mockSession, mockFooterData);
			const lines = dashboard.render(80);

			// Should not contain ANSI color codes
			for (const line of lines) {
				expect(line).not.toMatch(/\x1b\[[0-9;]*m/);
			}

			delete process.env.NO_COLOR;
		});

		it("respects NO_ANIMATION environment variable", () => {
			process.env.NO_ANIMATION = "1";
			const dashboard = new DashboardComponent(mockSession, mockFooterData);
			const lines1 = dashboard.render(80);
			const lines2 = dashboard.render(80);

			// Animation frame should not advance
			expect(lines1).toEqual(lines2);

			delete process.env.NO_ANIMATION;
		});

		it("respects LOW_RESOURCE environment variable", () => {
			process.env.LOW_RESOURCE = "1";
			const dashboard = new DashboardComponent(mockSession, mockFooterData);
			const lines1 = dashboard.render(80);
			const lines2 = dashboard.render(80);

			// Should throttle renders
			expect(lines1).toEqual(lines2);

			delete process.env.LOW_RESOURCE;
		});

		it("updates session via setSession", () => {
			const dashboard = new DashboardComponent(mockSession, mockFooterData);
			const newSession = createMockSession({
				entries: [
					...mockSession.entries,
					{
						type: "message",
						message: {
							role: "user",
							content: "Another message",
							timestamp: 3000,
						},
						timestamp: 3000,
					},
				],
			});

			dashboard.setSession(newSession);
			const lines = dashboard.render(80);

			// Should reflect new message count
			const output = lines.join("\n");
			expect(output).toContain("2"); // messageCount
		});
	});

	describe("createDashboard", () => {
		it("creates DashboardComponent instance", () => {
			const dashboard = createDashboard(mockSession, mockFooterData);
			expect(dashboard).toBeInstanceOf(DashboardComponent);
		});

		it("passes options to DashboardComponent", () => {
			const dashboard = createDashboard(mockSession, mockFooterData, { showSessionStats: false });
			expect(dashboard).toBeInstanceOf(DashboardComponent);
		});
	});

	describe("renderMiniDashboard", () => {
		it("returns single-line dashboard string", () => {
			const mini = renderMiniDashboard(mockSession, mockFooterData, 80);

			expect(typeof mini).toBe("string");
			expect(mini.length).toBeGreaterThan(0);
			expect(mini).toContain("msg");
			expect(mini).toContain("tools");
			expect(mini).toContain("cache");
		});

		it("respects NO_COLOR", () => {
			process.env.NO_COLOR = "1";
			const mini = renderMiniDashboard(mockSession, mockFooterData, 80);

			expect(mini).not.toMatch(/\x1b\[[0-9;]*m/);

			delete process.env.NO_COLOR;
		});
	});

	describe("integration with cache-stats", () => {
		it("displays cache statistics from computeCacheWaste", () => {
			const prev = {
				type: "message",
				message: {
					role: "assistant",
					content: [{ type: "text", text: "response" }],
					api: "anthropic-messages",
					provider: "anthropic",
					model: "claude-sonnet-4-5",
					usage: {
						input: 1000,
						output: 500,
						cacheRead: 8000,
						cacheWrite: 100,
						totalTokens: 9600,
						cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
					},
					stopReason: "stop",
					timestamp: 1000,
				},
				timestamp: 1000,
			};

			const curr = {
				type: "message",
				message: {
					role: "assistant",
					content: [{ type: "text", text: "response2" }],
					api: "anthropic-messages",
					provider: "anthropic",
					model: "claude-sonnet-4-5",
					usage: {
						input: 2000,
						output: 500,
						cacheRead: 5000,
						cacheWrite: 100,
						totalTokens: 7600,
						cost: { input: 0.002, output: 0.002, cacheRead: 0.00008, cacheWrite: 0.0002, total: 0.00428 },
					},
					stopReason: "stop",
					timestamp: 2000,
				},
				timestamp: 2000,
			};

			const sessionWithCacheMiss = createMockSession({
				entries: [prev, curr],
			});

			const dashboard = new DashboardComponent(sessionWithCacheMiss, mockFooterData);
			const lines = dashboard.render(80);
			const output = lines.join("\n");

			expect(output).toContain("CACHE ANALYTICS");
			expect(output).toContain("Hit Rate");
			expect(output).toContain("Misses");
		});

		it("generates cache report", () => {
			const models = {
				getModel: (provider: string, modelId: string) => {
					if (provider === "anthropic" && modelId === "claude-sonnet-4-5") {
						return { cost: { cacheRead: 0.0001 } };
					}
					return undefined;
				},
			};

			const entries = mockSession.entries;
			const report = generateCacheReport(entries, models);

			expect(report).toBeDefined();
			expect(report.hitRate).toBeGreaterThanOrEqual(0);
			expect(report.waste).toBeDefined();
			expect(report.misses).toBeInstanceOf(Map);
			expect(report.modelChangeCount).toBeGreaterThanOrEqual(0);
		});
	});
});