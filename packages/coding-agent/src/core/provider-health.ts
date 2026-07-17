/**
 * Provider Health — Per-provider health tracking, scoring, and failure diagnostics.
 *
 * Tracks model/provider call success/failure rates across sessions.
 * Persists to `.airis/memory/provider-health.json`.
 *
 * Features:
 * - Per-provider success/failure tracking
 * - Latency monitoring (average, p50, p95)
 * - Error classification (timeout, auth, rate-limit, server-error)
 * - Health score (0.0–1.0) computed from weighted factors
 * - Recovery recommendations
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "../config.ts";

// ============================================================================
// Types
// ============================================================================

export type ProviderErrorType =
	| "timeout"
	| "auth"
	| "rate-limit"
	| "server-error"
	| "network"
	| "invalid-request"
	| "unknown";

export interface ProviderCallRecord {
	provider: string;
	modelId: string;
	success: boolean;
	latencyMs: number;
	errorType?: ProviderErrorType;
	errorMessage?: string;
	timestamp: number;
}

export interface ProviderHealthStats {
	totalCalls: number;
	successCount: number;
	failureCount: number;
	lastErrorType?: ProviderErrorType;
	lastErrorMessage?: string;
	lastErrorTimestamp?: number;
	/** Average latency in ms */
	avgLatencyMs: number;
	/** p50 latency in ms */
	p50LatencyMs: number;
	/** p95 latency in ms */
	p95LatencyMs: number;
	/** Health score 0.0–1.0 */
	healthScore: number;
	/** When the first call was recorded */
	firstCallTimestamp: number;
	/** When the last call was recorded */
	lastCallTimestamp: number;
	/** Breakdown of errors by type */
	errorBreakdown: Partial<Record<ProviderErrorType, number>>;
}

export interface ProviderHealthStore {
	version: number;
	lastUpdated: string;
	providers: Record<string, ProviderHealthStats>;
	calls: ProviderCallRecord[];
}

// ============================================================================
// Defaults
// ============================================================================

const MAX_RECORDED_CALLS = 1000;

function createEmptyStore(): ProviderHealthStore {
	return {
		version: 1,
		lastUpdated: new Date().toISOString(),
		providers: {},
		calls: [],
	};
}

// ============================================================================
// Provider Health Tracker
// ============================================================================

export class ProviderHealthTracker {
	private _store: ProviderHealthStore;
	private _storePath: string;

	constructor(storePath?: string) {
		const agentDir = storePath ?? join(getAgentDir(), "provider-health.json");
		this._storePath = agentDir;
		this._store = this._loadStore();
	}

	private _loadStore(): ProviderHealthStore {
		try {
			if (existsSync(this._storePath)) {
				const raw = readFileSync(this._storePath, "utf-8");
				const parsed = JSON.parse(raw) as ProviderHealthStore;
				if (parsed.version === 1) return parsed;
			}
		} catch {
			// Corrupted file, start fresh
		}
		return createEmptyStore();
	}

	private _saveStore(): void {
		this._store.lastUpdated = new Date().toISOString();
		const dir = dirname(this._storePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(this._storePath, JSON.stringify(this._store, null, 2), "utf-8");
	}

	private _computePercentile(values: number[], percentile: number): number {
		if (values.length === 0) return 0;
		const sorted = [...values].sort((a, b) => a - b);
		const index = Math.ceil((percentile / 100) * sorted.length) - 1;
		return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
	}

	private _computeHealthScore(stats: ProviderHealthStats): number {
		// Base score from success rate
		const successRate = stats.totalCalls > 0 ? stats.successCount / stats.totalCalls : 1.0;

		// Penalty for recent failures (last 10 calls weighted more)
		const recentCalls = this._store.calls
			.filter(
				(c) => c.provider === Object.keys(this._store.providers).find((k) => this._store.providers[k] === stats),
			)
			.slice(-10);
		const recentSuccessRate =
			recentCalls.length > 0 ? recentCalls.filter((c) => c.success).length / recentCalls.length : successRate;

		// Penalty for high latency (relative: >10s avg = penalty)
		const latencyPenalty = stats.avgLatencyMs > 10000 ? Math.min(0.3, (stats.avgLatencyMs - 10000) / 60000) : 0;

		// Weighted score
		const score = successRate * 0.5 + recentSuccessRate * 0.4 - latencyPenalty;
		return Math.max(0, Math.min(1, score));
	}

	/** Record a provider call result. */
	recordCall(call: ProviderCallRecord): void {
		this._store.calls.push(call);

		// Trim to max
		if (this._store.calls.length > MAX_RECORDED_CALLS) {
			this._store.calls = this._store.calls.slice(-MAX_RECORDED_CALLS);
		}

		// Update per-provider stats
		const providerKey = `${call.provider}/${call.modelId}`;
		const providerCalls = this._store.calls.filter((c) => c.provider === call.provider && c.modelId === call.modelId);
		const latencies = providerCalls.map((c) => c.latencyMs);
		const successCount = providerCalls.filter((c) => c.success).length;
		const failureCount = providerCalls.filter((c) => !c.success).length;
		const errorBreakdown: Partial<Record<ProviderErrorType, number>> = {};
		for (const c of providerCalls) {
			if (!c.success && c.errorType) {
				errorBreakdown[c.errorType] = (errorBreakdown[c.errorType] ?? 0) + 1;
			}
		}

		const stats: ProviderHealthStats = {
			totalCalls: providerCalls.length,
			successCount,
			failureCount,
			avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
			p50LatencyMs: this._computePercentile(latencies, 50),
			p95LatencyMs: this._computePercentile(latencies, 95),
			healthScore: 1.0,
			errorBreakdown,
			firstCallTimestamp: providerCalls[0]?.timestamp ?? call.timestamp,
			lastCallTimestamp: call.timestamp,
		};

		if (!call.success) {
			stats.lastErrorType = call.errorType;
			stats.lastErrorMessage = call.errorMessage;
			stats.lastErrorTimestamp = call.timestamp;
		}

		stats.healthScore = this._computeHealthScore(stats);
		this._store.providers[providerKey] = stats;
		this._saveStore();
	}

	/** Get health stats for a specific provider/model combination. */
	getProviderHealth(provider: string, modelId: string): ProviderHealthStats | undefined {
		return this._store.providers[`${provider}/${modelId}`];
	}

	/** Get all tracked provider/model health stats. */
	getAllProviderHealth(): Record<string, ProviderHealthStats> {
		return { ...this._store.providers };
	}

	/** Get all recorded calls. */
	getCalls(): ProviderCallRecord[] {
		return [...this._store.calls];
	}

	/** Get recent failures (last N). */
	getRecentFailures(count = 10): ProviderCallRecord[] {
		return this._store.calls.filter((c) => !c.success).slice(-count);
	}

	/** Classify an error message into an error type. */
	static classifyError(errorMessage: string): ProviderErrorType {
		const lower = errorMessage.toLowerCase();
		if (lower.includes("timeout") || lower.includes("timed out")) return "timeout";
		if (lower.includes("auth") || lower.includes("unauthorized") || lower.includes("401") || lower.includes("403"))
			return "auth";
		if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many requests"))
			return "rate-limit";
		if (
			lower.includes("5") &&
			(lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504"))
		)
			return "server-error";
		if (
			lower.includes("network") ||
			lower.includes("econnrefused") ||
			lower.includes("enotfound") ||
			lower.includes("econnreset")
		)
			return "network";
		if (lower.includes("invalid") || lower.includes("400") || lower.includes("bad request")) return "invalid-request";
		return "unknown";
	}

	/** Get recovery recommendation based on error type. */
	static getRecoveryRecommendation(errorType: ProviderErrorType): string {
		switch (errorType) {
			case "timeout":
				return "Consider reducing prompt size, switching to a faster model, or increasing the timeout.";
			case "auth":
				return "Check provider API key. Run `/login <provider>` to reconfigure authentication.";
			case "rate-limit":
				return "Wait before retrying. Consider switching to a different provider or model with higher rate limits.";
			case "server-error":
				return "Provider-side issue. Retry after 30 seconds or switch to a backup provider.";
			case "network":
				return "Check internet connectivity. If behind a proxy, verify `HTTP_PROXY`/`HTTPS_PROXY` environment variables.";
			case "invalid-request":
				return "Review model parameters. The request format may be incompatible with this provider.";
			default:
				return "Check recent provider status or try a different model.";
		}
	}

	/** Format health report as a human-readable string. */
	formatHealthReport(filterProvider?: string): string {
		const lines: string[] = [];
		lines.push("Provider Health Report");
		lines.push("======================");
		lines.push(`Last updated: ${this._store.lastUpdated}`);
		lines.push("");

		const providers = filterProvider
			? Object.entries(this._store.providers).filter(([k]) => k.startsWith(`${filterProvider}/`))
			: Object.entries(this._store.providers);

		if (providers.length === 0) {
			lines.push("No provider data recorded yet. Make API calls first to build health history.");
			return lines.join("\n");
		}

		for (const [key, stats] of providers) {
			const [provider, model] = key.split("/", 2);
			const status = stats.healthScore >= 0.8 ? "healthy" : stats.healthScore >= 0.5 ? "degraded" : "unhealthy";
			lines.push(`Provider: ${provider}`);
			lines.push(`  Model: ${model}`);
			lines.push(`  Status: ${status} (score: ${(stats.healthScore * 100).toFixed(0)}%)`);
			lines.push(`  Calls: ${stats.totalCalls} total, ${stats.successCount} success, ${stats.failureCount} failed`);
			lines.push(
				`  Latency: avg=${stats.avgLatencyMs.toFixed(0)}ms, p50=${stats.p50LatencyMs.toFixed(0)}ms, p95=${stats.p95LatencyMs.toFixed(0)}ms`,
			);
			if (stats.lastErrorType) {
				lines.push(`  Last error: [${stats.lastErrorType}] ${stats.lastErrorMessage?.slice(0, 80) ?? "unknown"}`);
				lines.push(`  Recommendation: ${ProviderHealthTracker.getRecoveryRecommendation(stats.lastErrorType)}`);
			}
			if (Object.keys(stats.errorBreakdown).length > 0) {
				lines.push(
					`  Error breakdown: ${Object.entries(stats.errorBreakdown)
						.map(([t, c]) => `${t}=${c}`)
						.join(", ")}`,
				);
			}
			lines.push("");
		}

		return lines.join("\n");
	}
}
