/**
 * Tests for cache-stats.ts - cache waste detection and reporting
 */

import { describe, expect, it } from "vitest";
import type { AssistantMessage } from "@sufiyan-sabeel/airis-ai";
import type { SessionEntry } from "../src/core/session-manager.ts";
import {
	computeCacheWaste,
	collectCacheMisses,
	detectCacheMiss,
	generateCacheReport,
	CACHE_TTL_MS,
	NOISE_FLOOR_TOKENS,
	type CacheMiss,
	type CacheWasteTotals,
	type ModelPriceSource,
} from "../src/core/cache-stats.ts";

function createAssistantMessage(
	override: Partial<AssistantMessage> = {},
): AssistantMessage {
	const base: AssistantMessage = {
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
			cost: {
				input: 0.001,
				output: 0.002,
				cacheRead: 0.0001,
				cacheWrite: 0.0002,
				total: 0.0033,
			},
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
	return { ...base, ...override };
}

function createEntry(message: AssistantMessage, type: "message" = "message"): SessionEntry {
	return {
		type,
		message,
		timestamp: message.timestamp,
	};
}

const mockModels: ModelPriceSource = {
	getModel: (provider: string, modelId: string) => {
		if (provider === "anthropic" && modelId === "claude-sonnet-4-5") {
			return { cost: { cacheRead: 0.0001 } };
		}
		return undefined;
	},
};

describe("cache-stats", () => {
	describe("Constants", () => {
		it("CACHE_TTL_MS should be 5 minutes", () => {
			expect(CACHE_TTL_MS).toBe(5 * 60 * 1000);
		});

		it("NOISE_FLOOR_TOKENS should be 1024", () => {
			expect(NOISE_FLOOR_TOKENS).toBe(1024);
		});
	});

	describe("computeCacheWaste", () => {
		it("returns zero waste for empty session", () => {
			const waste = computeCacheWaste([], mockModels);
			expect(waste.missedTokens).toBe(0);
			expect(waste.missedCost).toBe(0);
			expect(waste.missCount).toBe(0);
		});

		it("returns zero waste for first assistant message (no previous to compare)", () => {
			const msg = createAssistantMessage({ timestamp: 1000 });
			const waste = computeCacheWaste([createEntry(msg)], mockModels);
			expect(waste.missCount).toBe(0);
		});

		it("detects cache miss when cacheRead is less than previous prompt tokens", () => {
			const prev = createAssistantMessage({
				timestamp: 1000,
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 8000,
					cacheWrite: 100,
					totalTokens: 9600,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const curr = createAssistantMessage({
				timestamp: 2000,
				usage: {
					input: 2000,
					output: 500,
					cacheRead: 5000,
					cacheWrite: 100,
					totalTokens: 7600,
					cost: { input: 0.002, output: 0.002, cacheRead: 0.00008, cacheWrite: 0.0002, total: 0.00428 },
				},
			});

			const waste = computeCacheWaste([createEntry(prev), createEntry(curr)], mockModels);

			// Previous prompt: 1000 + 8000 + 100 = 9100
			// Current prompt: 2000 + 5000 + 100 = 7100
			// min(9100, 7100) = 7100
			// Missed = 7100 - 5000 (cacheRead) = 2100
			expect(waste.missCount).toBe(1);
			expect(waste.missedTokens).toBe(2100);
			expect(waste.missedCost).toBeGreaterThan(0);
		});

		it("ignores misses below noise floor (1024 tokens)", () => {
			const prev = createAssistantMessage({
				timestamp: 1000,
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 8000,
					cacheWrite: 100,
					totalTokens: 9600,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const curr = createAssistantMessage({
				timestamp: 2000,
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 7999,
					cacheWrite: 100,
					totalTokens: 9599,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const waste = computeCacheWaste([createEntry(prev), createEntry(curr)], mockModels);
			expect(waste.missCount).toBe(0);
		});

		it("resets on compaction entries", () => {
			const prev = createAssistantMessage({
				timestamp: 1000,
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 8000,
					cacheWrite: 100,
					totalTokens: 9600,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const compactEntry: SessionEntry = {
				type: "compaction",
				reason: "threshold",
				timestamp: 1500,
				summary: "summary",
				keptUserEntryId: "user-1",
				tokensBefore: 10000,
				tokensAfter: 5000,
			};

			const curr = createAssistantMessage({
				timestamp: 2000,
				usage: {
					input: 2000,
					output: 500,
					cacheRead: 5000,
					cacheWrite: 100,
					totalTokens: 7600,
					cost: { input: 0.002, output: 0.002, cacheRead: 0.00008, cacheWrite: 0.0002, total: 0.00428 },
				},
			});

			const waste = computeCacheWaste([createEntry(prev), compactEntry, createEntry(curr)], mockModels);
			expect(waste.missCount).toBe(0);
		});

		it("resets on branch summary entries", () => {
			const prev = createAssistantMessage({
				timestamp: 1000,
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 8000,
					cacheWrite: 100,
					totalTokens: 9600,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const branchEntry: SessionEntry = {
				type: "branch_summary",
				timestamp: 1500,
				branchName: "test-branch",
				messageCount: 5,
				tokenCount: 1000,
			};

			const curr = createAssistantMessage({
				timestamp: 2000,
				usage: {
					input: 2000,
					output: 500,
					cacheRead: 5000,
					cacheWrite: 100,
					totalTokens: 7600,
					cost: { input: 0.002, output: 0.002, cacheRead: 0.00008, cacheWrite: 0.0002, total: 0.00428 },
				},
			});

			const waste = computeCacheWaste([createEntry(prev), branchEntry, createEntry(curr)], mockModels);
			expect(waste.missCount).toBe(0);
		});

		it("counts model changes as cache misses", () => {
			const prev = createAssistantMessage({
				timestamp: 1000,
				model: "claude-sonnet-4-5",
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 8000,
					cacheWrite: 100,
					totalTokens: 9600,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const curr = createAssistantMessage({
				timestamp: 2000,
				model: "claude-opus-4", // Different model
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 8000,
					cacheWrite: 100,
					totalTokens: 9600,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const waste = computeCacheWaste([createEntry(prev), createEntry(curr)], mockModels);
			expect(waste.missCount).toBe(1);
			expect(waste.missedTokens).toBeGreaterThan(0);
		});

		it("handles multiple turns with some misses", () => {
			const entries: SessionEntry[] = [];

			// Turn 1 - no previous, no miss
			entries.push(createEntry(createAssistantMessage({ timestamp: 1000 })));

			// Turn 2 - miss
			entries.push(
				createEntry(
					createAssistantMessage({
						timestamp: 2000,
						usage: {
							input: 2000,
							output: 500,
							cacheRead: 5000,
							cacheWrite: 100,
							totalTokens: 7600,
							cost: { input: 0.002, output: 0.002, cacheRead: 0.00008, cacheWrite: 0.0002, total: 0.00428 },
						},
					}),
				),
			);

			// Turn 3 - another miss
			entries.push(
				createEntry(
					createAssistantMessage({
						timestamp: 3000,
						usage: {
							input: 3000,
							output: 500,
							cacheRead: 3000,
							cacheWrite: 100,
							totalTokens: 6600,
							cost: { input: 0.003, output: 0.002, cacheRead: 0.00006, cacheWrite: 0.0002, total: 0.00526 },
						},
					}),
				),
			);

			const waste = computeCacheWaste(entries, mockModels);
			expect(waste.missCount).toBe(2);
			expect(waste.missedTokens).toBeGreaterThan(0);
		});
	});

	describe("collectCacheMisses", () => {
		it("returns map of messages to their cache misses", () => {
			const prev = createAssistantMessage({
				timestamp: 1000,
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 8000,
					cacheWrite: 100,
					totalTokens: 9600,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const curr = createAssistantMessage({
				timestamp: 2000,
				usage: {
					input: 2000,
					output: 500,
					cacheRead: 5000,
					cacheWrite: 100,
					totalTokens: 7600,
					cost: { input: 0.002, output: 0.002, cacheRead: 0.00008, cacheWrite: 0.0002, total: 0.00428 },
				},
			});

			const misses = collectCacheMisses([createEntry(prev), createEntry(curr)], mockModels);
			expect(misses.size).toBe(1);
			expect(misses.has(curr)).toBe(true);
			const miss = misses.get(curr)!;
			expect(miss.missedTokens).toBeGreaterThan(0);
		});

		it("returns empty map when no misses", () => {
			const msg = createAssistantMessage({ timestamp: 1000 });
			const misses = collectCacheMisses([createEntry(msg)], mockModels);
			expect(misses.size).toBe(0);
		});
	});

	describe("detectCacheMiss", () => {
		it("detects miss for new message relative to existing entries", () => {
			const prev = createAssistantMessage({
				timestamp: 1000,
				usage: {
					input: 1000,
					output: 500,
					cacheRead: 8000,
					cacheWrite: 100,
					totalTokens: 9600,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
				},
			});

			const curr = createAssistantMessage({
				timestamp: 2000,
				usage: {
					input: 2000,
					output: 500,
					cacheRead: 5000,
					cacheWrite: 100,
					totalTokens: 7600,
					cost: { input: 0.002, output: 0.002, cacheRead: 0.00008, cacheWrite: 0.0002, total: 0.00428 },
				},
			});

			const miss = detectCacheMiss([createEntry(prev)], curr, mockModels);
			expect(miss).toBeDefined();
			expect(miss?.missedTokens).toBeGreaterThan(0);
		});

		it("returns undefined when no previous entries", () => {
			const msg = createAssistantMessage({ timestamp: 1000 });
			const miss = detectCacheMiss([], msg, mockModels);
			expect(miss).toBeUndefined();
		});
	});

	describe("generateCacheReport", () => {
		it("returns complete cache report with all fields", () => {
			const entries: SessionEntry[] = [
				createEntry(createAssistantMessage({ timestamp: 1000 })),
				createEntry(
					createAssistantMessage({
						timestamp: 2000,
						usage: {
							input: 2000,
							output: 500,
							cacheRead: 5000,
							cacheWrite: 100,
							totalTokens: 7600,
							cost: { input: 0.002, output: 0.002, cacheRead: 0.00008, cacheWrite: 0.0002, total: 0.00428 },
						},
					}),
				),
			];

			const report = generateCacheReport(entries, mockModels);

			expect(report).toBeDefined();
			expect(typeof report.hitRate).toBe("number");
			expect(report.hitRate).toBeGreaterThanOrEqual(0);
			expect(report.hitRate).toBeLessThanOrEqual(100);
			expect(report.waste).toBeDefined();
			expect(report.waste.missedTokens).toBeGreaterThanOrEqual(0);
			expect(report.waste.missedCost).toBeGreaterThanOrEqual(0);
			expect(report.waste.missCount).toBeGreaterThanOrEqual(0);
			expect(report.misses).toBeInstanceOf(Map);
			expect(typeof report.modelChangeCount).toBe("number");
		});

		it("returns zero hit rate when no cache activity", () => {
			const entries: SessionEntry[] = [
				createEntry(createAssistantMessage({ timestamp: 1000, usage: { ...mockModels.getModel("anthropic", "claude-sonnet-4-5")!.cost, input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150 } })),
			];

			const report = generateCacheReport(entries, mockModels);
			expect(report.hitRate).toBe(0);
		});
	});
});