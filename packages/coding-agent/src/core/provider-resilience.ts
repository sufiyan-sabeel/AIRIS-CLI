/**
 * Provider Resilience — Circuit breakers, adaptive retries, degraded-mode
 * operation, and recovery suggestions for multi-provider routing.
 *
 * This module reuses health data from `provider-health.ts` and is fully
 * testable without network access. It is intentionally provider-agnostic:
 * callers record outcomes and consult the policy before each attempt.
 *
 * Design goals (aligned with AIRIS rules):
 * - Erasable TypeScript only (no enums / parameter properties).
 * - No dead code, no unreachable branches.
 * - Reuses existing health scoring rather than reimplementing it.
 */

import type { ProviderErrorType, ProviderHealthStats } from "./provider-health.ts";
import { ProviderHealthTracker } from "./provider-health.ts";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
	/** Consecutive failures before the breaker opens. */
	failureThreshold: number;
	/** Successes in half-open state required to close the breaker. */
	successThreshold: number;
	/** How long the breaker stays open before probing (half-open), in ms. */
	openMs: number;
	/** Max concurrent probes allowed while half-open. */
	halfOpenMaxProbes: number;
}

export const DEFAULT_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
	failureThreshold: 5,
	successThreshold: 2,
	openMs: 30_000,
	halfOpenMaxProbes: 1,
};

/**
 * A per-provider circuit breaker.
 *
 * States:
 *  - closed:    calls flow normally; failures accrue.
 *  - open:      calls are rejected fast; after `openMs` it becomes half-open.
 *  - half-open: a limited number of probe calls are allowed to test recovery.
 */
export class CircuitBreaker {
	private state: CircuitState = "closed";
	private consecutiveFailures = 0;
	private halfOpenSuccesses = 0;
	private openedAt = 0;
	private activeProbes = 0;
	private readonly opts: CircuitBreakerOptions;

	constructor(opts: Partial<CircuitBreakerOptions> = {}) {
		this.opts = { ...DEFAULT_CIRCUIT_OPTIONS, ...opts };
	}

	/** Current breaker state. */
	getState(): CircuitState {
		return this.state;
	}

	/** Number of consecutive failures since the last success. */
	getFailureCount(): number {
		return this.consecutiveFailures;
	}

	/** Advance time-based transitions (open -> half-open). */
	tick(now: number = Date.now()): CircuitState {
		if (this.state === "open" && now - this.openedAt >= this.opts.openMs) {
			this.state = "half-open";
			this.activeProbes = 0;
			this.halfOpenSuccesses = 0;
		}
		return this.state;
	}

	/** Whether a call may be attempted now. */
	canAttempt(now: number = Date.now()): boolean {
		const s = this.tick(now);
		if (s === "closed") return true;
		if (s === "half-open") return this.activeProbes < this.opts.halfOpenMaxProbes;
		return false;
	}

	/** Acquire a probe slot (call before attempting a half-open request). */
	beginProbe(): boolean {
		if (this.state !== "half-open") return false;
		if (this.activeProbes >= this.opts.halfOpenMaxProbes) return false;
		this.activeProbes++;
		return true;
	}

	/** Record a successful call and update state. */
	recordSuccess(): void {
		this.consecutiveFailures = 0;
		if (this.state === "half-open") {
			this.halfOpenSuccesses++;
			this.activeProbes = Math.max(0, this.activeProbes - 1);
			if (this.halfOpenSuccesses >= this.opts.successThreshold) {
				this.state = "closed";
				this.halfOpenSuccesses = 0;
				this.activeProbes = 0;
			}
		}
	}

	/** Record a failure; returns the new state. */
	recordFailure(now: number = Date.now()): CircuitState {
		this.consecutiveFailures++;
		if (this.state === "half-open") {
			this.state = "open";
			this.openedAt = now;
			this.activeProbes = 0;
			this.halfOpenSuccesses = 0;
			return this.state;
		}
		if (this.consecutiveFailures >= this.opts.failureThreshold) {
			this.state = "open";
			this.openedAt = now;
		}
		return this.state;
	}

	/** Reset to a healthy closed state (manual recovery). */
	reset(): void {
		this.state = "closed";
		this.consecutiveFailures = 0;
		this.halfOpenSuccesses = 0;
		this.activeProbes = 0;
		this.openedAt = 0;
	}
}

export interface RetryInput {
	attempt: number;
	maxAttempts: number;
	errorType: ProviderErrorType;
	circuit: CircuitBreaker;
	health?: ProviderHealthStats;
	baseDelayMs?: number;
	now?: number;
}

export interface RetryDecision {
	shouldRetry: boolean;
	delayMs: number;
	useFallback: boolean;
	reason: string;
}

const NON_RETRYABLE: ReadonlySet<ProviderErrorType> = new Set(["auth", "invalid-request"]);

/**
 * Compute an adaptive retry decision.
 *
 * - Non-retryable errors (auth, invalid-request) never retry.
 * - An open circuit triggers a fast failover to a fallback provider.
 * - Delay uses exponential backoff scaled by observed latency and recent
 *   failure rate, capped to avoid runaway waits.
 */
export function computeRetryDecision(input: RetryInput): RetryDecision {
	const base = input.baseDelayMs ?? 2000;
	const now = input.now ?? Date.now();

	if (NON_RETRYABLE.has(input.errorType)) {
		return {
			shouldRetry: false,
			delayMs: 0,
			useFallback: false,
			reason: `Non-retryable error (${input.errorType})`,
		};
	}

	const circuitState = input.circuit.tick(now);
	if (circuitState === "open") {
		return {
			shouldRetry: true,
			delayMs: 0,
			useFallback: true,
			reason: "Circuit open; failing over to a healthy provider",
		};
	}

	if (input.attempt >= input.maxAttempts) {
		return {
			shouldRetry: false,
			delayMs: 0,
			useFallback: false,
			reason: "Maximum retry attempts reached",
		};
	}

	// Exponential backoff: base * 2^attempt.
	let delay = base * 2 ** (input.attempt - 1);
	// Scale up if the provider is slow or degraded.
	if (input.health) {
		if (input.health.avgLatencyMs > 5000) delay = Math.round(delay * 1.5);
		if (input.health.healthScore < 0.5 && input.health.totalCalls > 3) {
			delay = Math.round(delay * 1.5);
		}
	}
	// Cap to keep user-visible waits reasonable.
	const capped = Math.min(delay, 60_000);

	return {
		shouldRetry: true,
		delayMs: capped,
		useFallback: false,
		reason: `Retry attempt ${input.attempt + 1}/${input.maxAttempts} after ${capped}ms`,
	};
}

export interface ResiliencePolicyOptions {
	circuit?: Partial<CircuitBreakerOptions>;
	/** Health score below which a provider is treated as degraded. */
	degradedThreshold?: number;
}

/**
 * Holds circuit breakers for every known provider and selects the best
 * available route. Also aggregates system-wide degradation state and
 * produces recovery suggestions.
 */
export class ResiliencePolicy {
	private readonly circuits = new Map<string, CircuitBreaker>();
	private readonly opts: Required<ResiliencePolicyOptions>;

	constructor(opts: ResiliencePolicyOptions = {}) {
		this.opts = {
			circuit: opts.circuit ?? {},
			degradedThreshold: opts.degradedThreshold ?? 0.5,
		};
	}

	/** Register (or fetch) the circuit breaker for a provider. */
	getCircuit(provider: string): CircuitBreaker {
		let breaker = this.circuits.get(provider);
		if (!breaker) {
			breaker = new CircuitBreaker(this.opts.circuit);
			this.circuits.set(provider, breaker);
		}
		return breaker;
	}

	/** All known providers. */
	getProviders(): string[] {
		return [...this.circuits.keys()];
	}

	/**
	 * Select the best routable provider from candidates.
	 *
	 * Preference order:
	 *  1. A provider whose circuit is closed and health is healthy.
	 *  2. Any provider whose circuit is closed (best health wins).
	 *  3. A half-open provider (to probe recovery).
	 * Returns null when no candidate can be attempted.
	 */
	selectProvider(
		candidates: ReadonlyArray<string>,
		healthScore: (provider: string) => number,
		now: number = Date.now(),
	): string | null {
		let best: string | null = null;
		let bestScore = -Infinity;
		for (const provider of candidates) {
			const circuit = this.getCircuit(provider);
			const state = circuit.tick(now);
			if (state === "open") continue;
			const canProbe = state === "half-open" ? circuit.canAttempt(now) : true;
			if (!canProbe) continue;
			const score = healthScore(provider) + (state === "closed" ? 0.1 : 0);
			if (score > bestScore) {
				bestScore = score;
				best = provider;
			}
		}
		return best;
	}

	/** Whether the system is operating in degraded mode (all/most circuits open). */
	isSystemDegraded(candidates: ReadonlyArray<string>, now: number = Date.now()): boolean {
		if (candidates.length === 0) return false;
		const closed = candidates.filter((p) => this.getCircuit(p).tick(now) !== "open");
		return closed.length === 0;
	}

	/** Aggregate recovery suggestions across open/at-risk circuits. */
	recoverySuggestions(tracker: ProviderHealthTracker): string[] {
		const suggestions = new Set<string>();
		for (const provider of this.circuits.keys()) {
			const circuit = this.circuits.get(provider);
			if (!circuit || circuit.getState() !== "open") continue;
			const health = tracker.getAllProviderHealth();
			const entry = Object.entries(health).find(([key]) => key.startsWith(`${provider}/`));
			if (entry) {
				const stats = entry[1];
				if (stats.lastErrorType) {
					suggestions.add(`${provider}: ${ProviderHealthTracker.getRecoveryRecommendation(stats.lastErrorType)}`);
				}
			}
		}
		if (suggestions.size > 0) {
			suggestions.add("System is degraded; traffic is being routed to fallback providers where available.");
		}
		return [...suggestions];
	}

	/** Reset every circuit (used after operator intervention). */
	resetAll(): void {
		for (const breaker of this.circuits.values()) breaker.reset();
	}
}

/**
 * Run an async operation with adaptive retry and circuit awareness.
 *
 * The `executor` receives the provider to use (for failover). The caller
 * supplies a health-score function and an error classifier. This keeps the
 * module free of provider-specific networking code.
 */
export interface ResilientRunOptions {
	providers: ReadonlyArray<string>;
	policy: ResiliencePolicy;
	healthScore: (provider: string) => number;
	maxAttempts?: number;
	baseDelayMs?: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	classify: (error: unknown) => ProviderErrorType;
	executor: (provider: string, attempt: number) => Promise<unknown>;
}

export interface ResilientRunResult {
	ok: boolean;
	provider?: string;
	attempts: number;
	error?: unknown;
	lastErrorType?: ProviderErrorType;
}

export async function runResilient(options: ResilientRunOptions): Promise<ResilientRunResult> {
	const maxAttempts = options.maxAttempts ?? 3;
	const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
	const nowFn = options.now ?? Date.now;
	let lastError: unknown;
	let lastErrorType: ProviderErrorType | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const provider = options.policy.selectProvider(options.providers, options.healthScore, nowFn());
		if (!provider) {
			return {
				ok: false,
				attempts: attempt - 1,
				error: new Error("No routable provider available (all circuits open)"),
			};
		}
		const breaker = options.policy.getCircuit(provider);
		const state = breaker.tick(nowFn());
		if (state === "half-open" && !breaker.beginProbe()) {
			continue;
		}
		try {
			await options.executor(provider, attempt);
			breaker.recordSuccess();
			return { ok: true, provider, attempts: attempt };
		} catch (error) {
			lastError = error;
			lastErrorType = options.classify(error);
			const circuitState = breaker.recordFailure(nowFn());
			const decision = computeRetryDecision({
				attempt,
				maxAttempts,
				errorType: lastErrorType,
				circuit: breaker,
				baseDelayMs: options.baseDelayMs,
				now: nowFn(),
				health: undefined,
			});
			if (!decision.shouldRetry || circuitState === "open") {
				if (decision.useFallback && attempt < maxAttempts) {
					continue;
				}
				return { ok: false, provider, attempts: attempt, error: lastError, lastErrorType };
			}
			if (decision.delayMs > 0) {
				await sleep(decision.delayMs);
			}
		}
	}

	return { ok: false, attempts: maxAttempts, error: lastError, lastErrorType };
}
