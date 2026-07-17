import type { AssistantMessage } from "@sufiyan-sabeel/airis-ai";
import type { SessionEntry } from "./session-manager.ts";

/**
 * Prompt-cache TTL: idle gaps longer than this are worth mentioning as the
 * likely cause of a miss. Anthropic's default cache TTL is 5 minutes.
 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/** Per-turn misses at or below this are cache breakpoint granularity noise. */
const NOISE_FLOOR_TOKENS = 1024;

/** A counted cache miss on a single assistant message. */
export interface CacheMiss {
	/** Prompt tokens that were in the previous turn's prompt but not read from cache. */
	missedTokens: number;
	/** Extra dollars paid vs. a full cache hit; 0 when pricing is unknown. */
	missedCost: number;
	/** Milliseconds since the previous request (which last refreshed the cache). */
	idleMs: number;
	/** True when the model changed relative to the previous request. */
	modelChanged: boolean;
}

export interface CacheWasteTotals {
	missedTokens: number;
	missedCost: number;
	/** Number of counted misses (turns above the noise floor). */
	missCount: number;
}

/** Minimal pricing lookup, satisfied by ModelRuntime. Cost is $/million tokens. */
export interface ModelPriceSource {
	getModel(provider: string, modelId: string): { cost: { cacheRead: number } } | undefined;
}

/** The last request seen by the scan; everything in its prompt should be cached. */
interface PreviousRequest {
	promptTokens: number;
	modelKey: string;
	timestamp: number;
	/**
	 * Sticky: some earlier request in this scan segment reported cache activity.
	 * Distinguishes a total miss on a cache-read-only provider (OpenAI-style,
	 * writes unreported) from a provider that never reports caching at all.
	 */
	reportedCache: boolean;
}

/**
 * Compute the cache miss for one assistant message relative to the previous
 * request. Returns undefined when nothing is counted: first turn, after a
 * reset, no cache activity ever reported (provider without cache support), or
 * miss below the noise floor.
 */
function detectMiss(
	prev: PreviousRequest | undefined,
	message: AssistantMessage,
	models: ModelPriceSource,
): CacheMiss | undefined {
	const usage = message.usage;
	const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	// A zero-cache turn only counts when cache activity was reported before:
	// on cache-read-only providers that is a total miss, while on providers
	// that never report caching it means nothing.
	if (!prev || promptTokens <= 0 || (usage.cacheRead + usage.cacheWrite === 0 && !prev.reportedCache)) {
		return undefined;
	}

	const missedTokens = Math.min(prev.promptTokens, promptTokens) - usage.cacheRead;
	if (missedTokens <= NOISE_FLOOR_TOKENS) return undefined;

	// Extra cost = missed tokens billed at the actual paid rate (input/cacheWrite,
	// incl. write premium) instead of the cache-read rate. Missed tokens can only
	// land in the input or cacheWrite buckets, so the paid rate comes straight
	// from this message's own cost breakdown.
	const paidTokens = usage.input + usage.cacheWrite;
	const paidPerToken = paidTokens > 0 ? (usage.cost.input + usage.cost.cacheWrite) / paidTokens : 0;
	const readPerToken =
		usage.cacheRead > 0
			? usage.cost.cacheRead / usage.cacheRead
			: (models.getModel(message.provider, message.model)?.cost.cacheRead ?? 0) / 1_000_000;

	return {
		missedTokens,
		missedCost: missedTokens * Math.max(0, paidPerToken - readPerToken),
		idleMs: Math.max(0, message.timestamp - prev.timestamp),
		modelChanged: `${message.provider}/${message.model}` !== prev.modelKey,
	};
}

function asPreviousRequest(message: AssistantMessage, reportedCache: boolean): PreviousRequest | undefined {
	const usage = message.usage;
	const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	if (promptTokens <= 0) return undefined;
	return {
		promptTokens,
		modelKey: `${message.provider}/${message.model}`,
		timestamp: message.timestamp,
		reportedCache: reportedCache || usage.cacheRead + usage.cacheWrite > 0,
	};
}

function scan(
	entries: SessionEntry[],
	models: ModelPriceSource,
): { prev: PreviousRequest | undefined; totals: CacheWasteTotals; misses: Map<AssistantMessage, CacheMiss> } {
	let prev: PreviousRequest | undefined;
	const totals: CacheWasteTotals = { missedTokens: 0, missedCost: 0, missCount: 0 };
	const misses = new Map<AssistantMessage, CacheMiss>();

	for (const entry of entries) {
		if (entry.type === "compaction" || entry.type === "branch_summary") {
			// The context legitimately changed; the next turn's prompt is new content,
			// not re-billed content. Model switches are NOT exempt: they re-bill the
			// full prompt and should be counted.
			prev = undefined;
			continue;
		}
		if (entry.type === "message" && entry.message.role === "assistant") {
			const miss = detectMiss(prev, entry.message, models);
			if (miss) {
				totals.missedTokens += miss.missedTokens;
				totals.missedCost += miss.missedCost;
				totals.missCount += 1;
				misses.set(entry.message, miss);
			}
			prev = asPreviousRequest(entry.message, prev?.reportedCache ?? false) ?? prev;
		}
	}
	return { prev, totals, misses };
}

/**
 * Cumulative cache waste across a session: prompt tokens that should have been
 * cache reads (they were in the previous turn's prompt) but were re-billed.
 */
export function computeCacheWaste(entries: SessionEntry[], models: ModelPriceSource): CacheWasteTotals {
	return scan(entries, models).totals;
}

/**
 * All counted cache misses across a session, keyed by the assistant message
 * (by reference) that paid for them. Used to re-derive transcript notices when
 * rebuilding the chat from entries (resume, post-compaction rebuild).
 */
export function collectCacheMisses(
	entries: SessionEntry[],
	models: ModelPriceSource,
): Map<AssistantMessage, CacheMiss> {
	return scan(entries, models).misses;
}

/** Prompts tokens combined across all assistant messages, used for hit-rate computation. */
interface AggregateCounts {
	totalPromptTokens: number;
	totalCacheRead: number;
	modelChangeCount: number;
}

/**
 * Full cache report with hit rate, waste details, and per-message misses.
 */
export interface CacheReport {
	hitRate: number;
	waste: CacheWasteTotals;
	misses: Map<AssistantMessage, CacheMiss>;
	modelChangeCount: number;
}

function computeAggregates(entries: SessionEntry[], _models: ModelPriceSource): AggregateCounts {
	let totalPromptTokens = 0;
	let totalCacheRead = 0;
	let modelChangeCount = 0;
	let prev: PreviousRequest | undefined;

	for (const entry of entries) {
		if (entry.type === "compaction" || entry.type === "branch_summary") {
			prev = undefined;
			continue;
		}
		if (entry.type === "message" && entry.message.role === "assistant") {
			const usage = entry.message.usage;
			const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
			totalPromptTokens += promptTokens;
			totalCacheRead += usage.cacheRead;

			if (prev) {
				const modelKey = `${entry.message.provider}/${entry.message.model}`;
				if (modelKey !== prev.modelKey) {
					modelChangeCount++;
				}
			}
			prev = asPreviousRequest(entry.message, prev?.reportedCache ?? false) ?? prev;
		}
	}

	return { totalPromptTokens, totalCacheRead, modelChangeCount };
}

/**
 * Generate a comprehensive cache report for the given session entries.
 * Returns hit rate, waste totals, and per-message cache miss details.
 */
export function generateCacheReport(
	entries: SessionEntry[],
	models: ModelPriceSource,
): CacheReport {
	const { prev: _prev, totals, misses } = scan(entries, models);
	const { totalPromptTokens, totalCacheRead, modelChangeCount } = computeAggregates(entries, models);

	const hitRate = totalPromptTokens > 0
		? (totalCacheRead / totalPromptTokens) * 100
		: 0;

	return {
		hitRate,
		waste: totals,
		misses,
		modelChangeCount,
	};
}

/**
 * Format a cache report as a human-readable string.
 */
export function formatCacheReport(report: CacheReport): string {
	const lines: string[] = [];
	lines.push("Cache Report");
	lines.push("============");

	if (report.waste.missCount === 0 && report.misses.size === 0) {
		lines.push("No cache misses detected in this session.");
		lines.push(`Overall hit rate: ${report.hitRate.toFixed(1)}%`);
		return lines.join("\n");
	}

	lines.push(`Hit Rate: ${report.hitRate.toFixed(1)}%`);
	lines.push(`Miss Count: ${report.waste.missCount}`);
	lines.push(`Wasted Tokens: ${report.waste.missedTokens.toLocaleString()}`);
	lines.push(`Wasted Cost: $${report.waste.missedCost.toFixed(6)}`);
	lines.push(`Model Changes: ${report.modelChangeCount}`);

	if (report.misses.size > 0) {
		lines.push("");
		lines.push("Miss Details:");
		lines.push("-------------");
		let index = 0;
		for (const [, miss] of report.misses) {
			index++;
			const idleStr = miss.idleMs > 60000
				? `${Math.round(miss.idleMs / 60000)}m`
				: `${miss.idleMs}ms`;
			lines.push(`  ${index}. Missed ${miss.missedTokens.toLocaleString()} tokens ($${miss.missedCost.toFixed(6)}), idle ${idleStr}, model changed: ${miss.modelChanged}`);
		}
	}

	return lines.join("\n");
}

/**
 * Detect a cache miss on a just-completed assistant message.
 * `entries` must not yet contain `message` (message_end fires before persistence).
 */
export function detectCacheMiss(
	entries: SessionEntry[],
	message: AssistantMessage,
	models: ModelPriceSource,
): CacheMiss | undefined {
	return detectMiss(scan(entries, models).prev, message, models);
}