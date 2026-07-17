import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProviderHealthTracker } from "../src/core/provider-health.ts";
import {
	CircuitBreaker,
	computeRetryDecision,
	ResiliencePolicy,
	runResilient,
} from "../src/core/provider-resilience.ts";

let tmpDir: string;
beforeEach(() => {
	tmpDir = join(tmpdir(), `airis-resilience-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tmpDir, { recursive: true });
});
afterEach(() => {
	if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

describe("CircuitBreaker", () => {
	it("starts closed and allows attempts", () => {
		const cb = new CircuitBreaker();
		expect(cb.getState()).toBe("closed");
		expect(cb.canAttempt()).toBe(true);
	});

	it("opens after the failure threshold", () => {
		const cb = new CircuitBreaker({ failureThreshold: 3 });
		expect(cb.recordFailure(0)).toBe("closed");
		expect(cb.recordFailure(0)).toBe("closed");
		expect(cb.recordFailure(0)).toBe("open");
		expect(cb.canAttempt(0)).toBe(false);
	});

	it("halts attempts while open and recovers to half-open after openMs", () => {
		const cb = new CircuitBreaker({ failureThreshold: 1, openMs: 1000 });
		cb.recordFailure(0);
		expect(cb.canAttempt(500)).toBe(false);
		expect(cb.getState()).toBe("open");
		expect(cb.canAttempt(1001)).toBe(true);
		expect(cb.getState()).toBe("half-open");
	});

	it("closes after enough half-open successes", () => {
		const cb = new CircuitBreaker({ failureThreshold: 1, openMs: 0, successThreshold: 2 });
		cb.recordFailure(0);
		expect(cb.getState()).toBe("open");
		cb.tick(1);
		expect(cb.getState()).toBe("half-open");
		cb.beginProbe();
		cb.recordSuccess();
		expect(cb.getState()).toBe("half-open");
		cb.beginProbe();
		cb.recordSuccess();
		expect(cb.getState()).toBe("closed");
	});

	it("re-opens immediately on a half-open failure", () => {
		const cb = new CircuitBreaker({ failureThreshold: 1, openMs: 0 });
		cb.recordFailure(0);
		cb.tick(1);
		cb.beginProbe();
		expect(cb.recordFailure(2)).toBe("open");
	});

	it("reset returns to closed", () => {
		const cb = new CircuitBreaker({ failureThreshold: 1 });
		cb.recordFailure(0);
		cb.reset();
		expect(cb.getState()).toBe("closed");
		expect(cb.getFailureCount()).toBe(0);
	});
});

describe("computeRetryDecision", () => {
	it("never retries non-retryable errors", () => {
		const cb = new CircuitBreaker();
		const d = computeRetryDecision({
			attempt: 1,
			maxAttempts: 3,
			errorType: "auth",
			circuit: cb,
		});
		expect(d.shouldRetry).toBe(false);
		expect(d.useFallback).toBe(false);
	});

	it("fails over when the circuit is open", () => {
		const cb = new CircuitBreaker({ failureThreshold: 1 });
		cb.recordFailure(0);
		const d = computeRetryDecision({
			attempt: 1,
			maxAttempts: 3,
			errorType: "timeout",
			circuit: cb,
			now: 5000,
		});
		expect(d.shouldRetry).toBe(true);
		expect(d.useFallback).toBe(true);
		expect(d.delayMs).toBe(0);
	});

	it("uses exponential backoff capped at 60s", () => {
		const cb = new CircuitBreaker();
		const d = computeRetryDecision({
			attempt: 5,
			maxAttempts: 10,
			errorType: "server-error",
			circuit: cb,
			baseDelayMs: 2000,
		});
		// 2000 * 2^4 = 32000, under cap
		expect(d.delayMs).toBe(32000);
		expect(d.shouldRetry).toBe(true);
	});

	it("caps backoff delay", () => {
		const cb = new CircuitBreaker();
		const d = computeRetryDecision({
			attempt: 20,
			maxAttempts: 100,
			errorType: "server-error",
			circuit: cb,
			baseDelayMs: 2000,
		});
		expect(d.delayMs).toBeLessThanOrEqual(60000);
	});

	it("stops after max attempts", () => {
		const cb = new CircuitBreaker();
		const d = computeRetryDecision({
			attempt: 3,
			maxAttempts: 3,
			errorType: "network",
			circuit: cb,
		});
		expect(d.shouldRetry).toBe(false);
	});
});

describe("ResiliencePolicy", () => {
	it("selects the healthiest closed provider", () => {
		const policy = new ResiliencePolicy();
		const picked = policy.selectProvider(["a", "b"], (p) => (p === "a" ? 0.3 : 0.9));
		expect(picked).toBe("b");
	});

	it("avoids open circuits", () => {
		const policy = new ResiliencePolicy();
		policy.getCircuit("a").recordFailure(0);
		policy.getCircuit("a").recordFailure(0);
		policy.getCircuit("a").recordFailure(0);
		policy.getCircuit("a").recordFailure(0);
		policy.getCircuit("a").recordFailure(0);
		const picked = policy.selectProvider(["a", "b"], () => 1);
		expect(picked).toBe("b");
	});

	it("reports degraded when all candidates are open", () => {
		const policy = new ResiliencePolicy();
		for (const p of ["a", "b"]) {
			const c = policy.getCircuit(p);
			for (let i = 0; i < 5; i++) c.recordFailure(0);
		}
		expect(policy.isSystemDegraded(["a", "b"])).toBe(true);
	});

	it("produces recovery suggestions for open circuits", () => {
		const tracker = new ProviderHealthTracker(join(tmpDir, "ph.json"));
		tracker.recordCall({
			provider: "a",
			modelId: "m",
			success: false,
			latencyMs: 100,
			errorType: "rate-limit",
			errorMessage: "429",
			timestamp: 0,
		});
		const policy = new ResiliencePolicy();
		for (let i = 0; i < 5; i++) policy.getCircuit("a").recordFailure(0);
		const suggestions = policy.recoverySuggestions(tracker);
		expect(suggestions.some((s) => s.includes("a"))).toBe(true);
	});
});

describe("runResilient", () => {
	it("succeeds on the first attempt", async () => {
		const policy = new ResiliencePolicy();
		let calls = 0;
		const result = await runResilient({
			providers: ["a"],
			policy,
			healthScore: () => 1,
			now: () => 0,
			sleep: async () => {},
			classify: () => "server-error",
			executor: async () => {
				calls++;
			},
		});
		expect(result.ok).toBe(true);
		expect(calls).toBe(1);
	});

	it("retries then succeeds on a retryable error", async () => {
		const policy = new ResiliencePolicy();
		let calls = 0;
		const result = await runResilient({
			providers: ["a"],
			policy,
			healthScore: () => 1,
			now: () => 0,
			sleep: async () => {},
			classify: () => "server-error",
			executor: async () => {
				calls++;
				if (calls === 1) throw new Error("boom");
			},
		});
		expect(result.ok).toBe(true);
		expect(calls).toBe(2);
	});

	it("does not retry non-retryable errors", async () => {
		const policy = new ResiliencePolicy();
		let calls = 0;
		const result = await runResilient({
			providers: ["a"],
			policy,
			healthScore: () => 1,
			now: () => 0,
			sleep: async () => {},
			classify: () => "auth",
			executor: async () => {
				calls++;
				throw new Error("unauthorized");
			},
		});
		expect(result.ok).toBe(false);
		expect(calls).toBe(1);
	});

	it("fails over to a fallback when the circuit opens", async () => {
		const policy = new ResiliencePolicy();
		const used: string[] = [];
		policy.getCircuit("a").recordFailure(0);
		policy.getCircuit("a").recordFailure(0);
		policy.getCircuit("a").recordFailure(0);
		policy.getCircuit("a").recordFailure(0);
		policy.getCircuit("a").recordFailure(0);
		const result = await runResilient({
			providers: ["a", "b"],
			policy,
			healthScore: () => 1,
			now: () => 0,
			sleep: async () => {},
			classify: () => "timeout",
			executor: async (provider) => {
				used.push(provider);
			},
		});
		expect(result.ok).toBe(true);
		expect(used).toContain("b");
	});
});
