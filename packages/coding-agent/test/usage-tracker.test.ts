import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { estimateCost, type UsageRecord, UsageTracker } from "../src/core/usage-tracker.ts";

let storePath: string;

beforeEach(() => {
	storePath = join(tmpdir(), `airis-usage-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
});
afterEach(() => {
	if (existsSync(storePath)) rmSync(storePath, { force: true });
});

function record(partial: Partial<UsageRecord>): UsageRecord {
	return {
		provider: "anthropic",
		model: "claude-3-5-sonnet",
		inputTokens: 1000,
		outputTokens: 500,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		timestamp: 0,
		...partial,
	};
}

describe("estimateCost", () => {
	it("uses a known pricing tier", () => {
		// claude-3-5-sonnet: input $3, output $15 per 1M tokens
		const cost = estimateCost("claude-3-5-sonnet", 1_000_000, 1_000_000);
		expect(cost).toBeCloseTo(18, 5);
	});

	it("falls back to default pricing for unknown models", () => {
		const cost = estimateCost("mystery-model", 1_000_000, 1_000_000);
		expect(cost).toBeCloseTo(3, 5);
	});
});

describe("UsageTracker", () => {
	it("accumulates totals", () => {
		const tracker = new UsageTracker("sess-1", storePath);
		tracker.record(record({}));
		tracker.record(record({ inputTokens: 2000, outputTokens: 1000 }));
		const totals = tracker.getTotals();
		expect(totals.calls).toBe(2);
		expect(totals.inputTokens).toBe(3000);
		expect(totals.outputTokens).toBe(1500);
		expect(totals.estCostUsd).toBeGreaterThan(0);
	});

	it("breaks down by provider and model", () => {
		const tracker = new UsageTracker("sess-1", storePath);
		tracker.record(record({ provider: "anthropic", model: "claude-3-5-sonnet" }));
		tracker.record(record({ provider: "openai", model: "gpt-4o" }));
		expect(Object.keys(tracker.getByProvider())).toEqual(expect.arrayContaining(["anthropic", "openai"]));
		expect(tracker.getByModel()["anthropic/claude-3-5-sonnet"].calls).toBe(1);
	});

	it("persists across reloads", () => {
		const tracker = new UsageTracker("sess-1", storePath);
		tracker.record(record({}));
		const reloaded = new UsageTracker("sess-1", storePath);
		expect(reloaded.count).toBe(1);
		expect(reloaded.getTotals().calls).toBe(1);
	});

	it("renders a report", () => {
		const tracker = new UsageTracker("sess-1", storePath);
		tracker.record(record({}));
		const report = tracker.formatReport();
		expect(report).toContain("Usage & Cost Report");
		expect(report).toContain("claude-3-5-sonnet");
	});
});
