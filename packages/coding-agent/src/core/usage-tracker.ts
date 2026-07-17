/**
 * Usage Tracker — token, cost, and call analytics.
 *
 * Accumulates per-session, per-provider, per-model usage and estimates cost
 * from a small built-in pricing table. Persisted to `.airis/memory/usage.json`.
 *
 * Supports the observability capabilities: token analytics, cost analytics,
 * provider analytics, and session analytics. Pricing is overridable.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "../config.ts";

export interface UsageRecord {
	provider: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	timestamp: number;
}

export interface UsageAggregate {
	calls: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	estCostUsd: number;
}

export interface UsageStore {
	version: number;
	sessionId: string;
	records: UsageRecord[];
	totals: UsageAggregate;
	byProvider: Record<string, UsageAggregate>;
	byModel: Record<string, UsageAggregate>;
}

const STORE_VERSION = 1;

// Built-in pricing in USD per 1,000,000 tokens (input / output).
// Intentionally small and overridable; not a substitute for live pricing.
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
	"claude-3-5-sonnet": { input: 3, output: 15 },
	"claude-3-5-haiku": { input: 0.8, output: 4 },
	"claude-3-opus": { input: 15, output: 75 },
	"claude-": { input: 3, output: 15 },
	"gpt-4o": { input: 2.5, output: 10 },
	"gpt-4o-mini": { input: 0.15, output: 0.6 },
	"gpt-4": { input: 30, output: 60 },
	"gpt-3.5": { input: 0.5, output: 1.5 },
	"gemini-1.5-pro": { input: 1.25, output: 5 },
	"gemini-1.5-flash": { input: 0.075, output: 0.3 },
	"gemini-2": { input: 1, output: 4 },
	deepseek: { input: 0.27, output: 1.1 },
	llama: { input: 0, output: 0 },
};

const FALLBACK_PRICING = { input: 1, output: 2 };

function resolvePricing(model: string): { input: number; output: number } {
	const lower = model.toLowerCase();
	for (const key of Object.keys(DEFAULT_PRICING)) {
		if (lower.includes(key)) return DEFAULT_PRICING[key];
	}
	return FALLBACK_PRICING;
}

/** Estimate cost in USD for a single record. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
	const price = resolvePricing(model);
	return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

function emptyAggregate(): UsageAggregate {
	return {
		calls: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		estCostUsd: 0,
	};
}

function addRecord(agg: UsageAggregate, record: UsageRecord, cost: number): void {
	agg.calls++;
	agg.inputTokens += record.inputTokens;
	agg.outputTokens += record.outputTokens;
	agg.cacheReadTokens += record.cacheReadTokens;
	agg.cacheWriteTokens += record.cacheWriteTokens;
	agg.estCostUsd += cost;
}

export class UsageTracker {
	private store: UsageStore;
	private readonly storePath: string;

	constructor(sessionId: string, storePath?: string) {
		this.storePath = storePath ?? join(getAgentDir(), "usage.json");
		this.store = this.load(sessionId);
	}

	private load(sessionId: string): UsageStore {
		try {
			if (existsSync(this.storePath)) {
				const parsed = JSON.parse(readFileSync(this.storePath, "utf-8")) as UsageStore;
				if (parsed.version === STORE_VERSION) return parsed;
			}
		} catch {
			// Corrupt; start fresh.
		}
		return {
			version: STORE_VERSION,
			sessionId,
			records: [],
			totals: emptyAggregate(),
			byProvider: {},
			byModel: {},
		};
	}

	private save(): void {
		const dir = dirname(this.storePath);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), "utf-8");
	}

	/** Record a single model usage event. */
	record(record: UsageRecord): void {
		const cost = estimateCost(record.model, record.inputTokens, record.outputTokens);
		this.store.records.push(record);
		addRecord(this.store.totals, record, cost);
		if (!this.store.byProvider[record.provider]) this.store.byProvider[record.provider] = emptyAggregate();
		const providerAgg = this.store.byProvider[record.provider];
		addRecord(providerAgg, record, cost);
		const modelKey = `${record.provider}/${record.model}`;
		if (!this.store.byModel[modelKey]) this.store.byModel[modelKey] = emptyAggregate();
		const modelAgg = this.store.byModel[modelKey];
		addRecord(modelAgg, record, cost);
		this.save();
	}

	/** Total usage across the session. */
	getTotals(): UsageAggregate {
		return { ...this.store.totals };
	}

	/** Usage broken down by provider. */
	getByProvider(): Record<string, UsageAggregate> {
		return JSON.parse(JSON.stringify(this.store.byProvider));
	}

	/** Usage broken down by model. */
	getByModel(): Record<string, UsageAggregate> {
		return JSON.parse(JSON.stringify(this.store.byModel));
	}

	/** Number of recorded usage events. */
	get count(): number {
		return this.store.records.length;
	}

	/** Render a usage report. */
	formatReport(): string {
		const t = this.store.totals;
		const lines: string[] = [];
		lines.push("Usage & Cost Report");
		lines.push("====================");
		lines.push(`Session: ${this.store.sessionId}`);
		lines.push(`Calls: ${t.calls}`);
		lines.push(`Input tokens:  ${t.inputTokens.toLocaleString()}`);
		lines.push(`Output tokens: ${t.outputTokens.toLocaleString()}`);
		lines.push(`Cache read:    ${t.cacheReadTokens.toLocaleString()}`);
		lines.push(`Cache write:   ${t.cacheWriteTokens.toLocaleString()}`);
		lines.push(`Est. cost:     $${t.estCostUsd.toFixed(4)}`);
		lines.push("");
		lines.push("By provider:");
		for (const [provider, agg] of Object.entries(this.store.byProvider)) {
			lines.push(`  ${provider}: ${agg.calls} calls, $${agg.estCostUsd.toFixed(4)}`);
		}
		lines.push("");
		lines.push("By model:");
		for (const [model, agg] of Object.entries(this.store.byModel)) {
			lines.push(
				`  ${model}: ${agg.calls} calls, ${agg.inputTokens + agg.outputTokens} tokens, $${agg.estCostUsd.toFixed(4)}`,
			);
		}
		return lines.join("\n");
	}
}
