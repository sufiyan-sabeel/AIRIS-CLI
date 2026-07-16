/**
 * Tests for Provider Health — Per-provider health tracking, scoring, and failure diagnostics
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { ProviderHealthTracker } from "../src/core/provider-health.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ProviderHealthTracker", () => {
	let tempDir: string;
	let tracker: ProviderHealthTracker;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "airis-provider-health-"));
		tracker = new ProviderHealthTracker(join(tempDir, "provider-health.json"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("recordCall", () => {
		it("records a successful call", () => {
			tracker.recordCall({
				provider: "anthropic",
				modelId: "claude-opus-4-8",
				success: true,
				latencyMs: 1500,
				timestamp: Date.now(),
			});

			const stats = tracker.getProviderHealth("anthropic", "claude-opus-4-8");
			expect(stats).toBeDefined();
			expect(stats!.totalCalls).toBe(1);
			expect(stats!.successCount).toBe(1);
			expect(stats!.failureCount).toBe(0);
			expect(stats!.healthScore).toBeGreaterThan(0.8);
		});

		it("records a failed call", () => {
			tracker.recordCall({
				provider: "anthropic",
				modelId: "claude-opus-4-8",
				success: false,
				latencyMs: 30000,
				errorType: "timeout",
				errorMessage: "Request timed out",
				timestamp: Date.now(),
			});

			const stats = tracker.getProviderHealth("anthropic", "claude-opus-4-8");
			expect(stats).toBeDefined();
			expect(stats!.totalCalls).toBe(1);
			expect(stats!.failureCount).toBe(1);
			expect(stats!.lastErrorType).toBe("timeout");
			expect(stats!.lastErrorMessage).toBe("Request timed out");
			expect(stats!.healthScore).toBeLessThan(0.9);
		});

		it("tracks multiple calls and computes averages", () => {
			tracker.recordCall({ provider: "openai", modelId: "gpt-4", success: true, latencyMs: 500, timestamp: Date.now() });
			tracker.recordCall({ provider: "openai", modelId: "gpt-4", success: true, latencyMs: 1500, timestamp: Date.now() });
			tracker.recordCall({ provider: "openai", modelId: "gpt-4", success: true, latencyMs: 1000, timestamp: Date.now() });

			const stats = tracker.getProviderHealth("openai", "gpt-4");
			expect(stats).toBeDefined();
			expect(stats!.totalCalls).toBe(3);
			expect(stats!.avgLatencyMs).toBeCloseTo(1000, -1);
		});

		it("computes p50 and p95 latency", () => {
			const timestamps = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((ms) => Date.now() + ms);
			for (let i = 0; i < 10; i++) {
				tracker.recordCall({
					provider: "test",
					modelId: "model",
					success: true,
					latencyMs: 100 * (i + 1),
					timestamp: timestamps[i],
				});
			}

			const stats = tracker.getProviderHealth("test", "model");
			expect(stats!.p50LatencyMs).toBeGreaterThanOrEqual(500);
			expect(stats!.p50LatencyMs).toBeLessThanOrEqual(600);
			expect(stats!.p95LatencyMs).toBeGreaterThanOrEqual(900);
		});

		it("builds error breakdown", () => {
			tracker.recordCall({
				provider: "test",
				modelId: "m",
				success: false,
				latencyMs: 100,
				errorType: "timeout",
				timestamp: Date.now(),
			});
			tracker.recordCall({
				provider: "test",
				modelId: "m",
				success: false,
				latencyMs: 100,
				errorType: "auth",
				timestamp: Date.now(),
			});
			tracker.recordCall({
				provider: "test",
				modelId: "m",
				success: false,
				latencyMs: 100,
				errorType: "timeout",
				timestamp: Date.now(),
			});

			const stats = tracker.getProviderHealth("test", "m");
			expect(stats!.errorBreakdown.timeout).toBe(2);
			expect(stats!.errorBreakdown.auth).toBe(1);
		});
	});

	describe("getAllProviderHealth", () => {
		it("returns all tracked providers", () => {
			tracker.recordCall({ provider: "a", modelId: "m1", success: true, latencyMs: 100, timestamp: Date.now() });
			tracker.recordCall({ provider: "b", modelId: "m2", success: true, latencyMs: 200, timestamp: Date.now() });

			const all = tracker.getAllProviderHealth();
			expect(Object.keys(all).length).toBe(2);
		});
	});

	describe("getRecentFailures", () => {
		it("returns recent failures", () => {
			tracker.recordCall({ provider: "a", modelId: "m", success: true, latencyMs: 100, timestamp: Date.now() });
			tracker.recordCall({ provider: "a", modelId: "m", success: false, latencyMs: 100, errorType: "timeout", timestamp: Date.now() });

			const failures = tracker.getRecentFailures(5);
			expect(failures.length).toBe(1);
			expect(failures[0].success).toBe(false);
		});
	});

	describe("classifyError", () => {
		it("classifies timeout errors", () => {
			expect(ProviderHealthTracker.classifyError("Request timed out after 30s")).toBe("timeout");
		});

		it("classifies auth errors", () => {
			expect(ProviderHealthTracker.classifyError("401 Unauthorized")).toBe("auth");
			expect(ProviderHealthTracker.classifyError("Authentication failed")).toBe("auth");
		});

		it("classifies rate-limit errors", () => {
			expect(ProviderHealthTracker.classifyError("429 Too Many Requests")).toBe("rate-limit");
			expect(ProviderHealthTracker.classifyError("rate limit exceeded")).toBe("rate-limit");
		});

		it("classifies server errors", () => {
			expect(ProviderHealthTracker.classifyError("500 Internal Server Error")).toBe("server-error");
			expect(ProviderHealthTracker.classifyError("502 Bad Gateway")).toBe("server-error");
		});

		it("classifies network errors", () => {
			expect(ProviderHealthTracker.classifyError("ECONNREFUSED")).toBe("network");
			expect(ProviderHealthTracker.classifyError("getaddrinfo ENOTFOUND")).toBe("network");
		});

		it("classifies invalid request errors", () => {
			expect(ProviderHealthTracker.classifyError("400 Bad Request")).toBe("invalid-request");
		});

		it("returns unknown for unrecognized errors", () => {
			expect(ProviderHealthTracker.classifyError("Something went wrong")).toBe("unknown");
		});
	});

	describe("getRecoveryRecommendation", () => {
		it("returns recommendations for each error type", () => {
			const types = ["timeout", "auth", "rate-limit", "server-error", "network", "invalid-request", "unknown"] as const;
			for (const t of types) {
				const rec = ProviderHealthTracker.getRecoveryRecommendation(t);
				expect(rec).toBeTruthy();
				expect(typeof rec).toBe("string");
			}
		});
	});

	describe("formatHealthReport", () => {
		it("returns message when no data recorded", () => {
			const text = tracker.formatHealthReport();
			expect(text).toContain("No provider data recorded yet");
		});

		it("includes provider stats when data exists", () => {
			tracker.recordCall({
				provider: "anthropic",
				modelId: "claude-opus-4-8",
				success: true,
				latencyMs: 2000,
				timestamp: Date.now(),
			});

			const text = tracker.formatHealthReport();
			expect(text).toContain("anthropic");
			expect(text).toContain("healthy");
		});

		it("filters by provider when specified", () => {
			tracker.recordCall({ provider: "a", modelId: "m", success: true, latencyMs: 100, timestamp: Date.now() });
			tracker.recordCall({ provider: "b", modelId: "m", success: true, latencyMs: 100, timestamp: Date.now() });

			const text = tracker.formatHealthReport("a");
			expect(text).toContain("Provider: a");
			expect(text).not.toContain("Provider: b");
		});
	});

	describe("persistence", () => {
		it("persists data to disk", () => {
			tracker.recordCall({ provider: "p", modelId: "m", success: true, latencyMs: 100, timestamp: Date.now() });

			// Create a new tracker with same path
			const tracker2 = new ProviderHealthTracker(tempDir + "/provider-health.json");
			const stats = tracker2.getProviderHealth("p", "m");
			expect(stats).toBeDefined();
			expect(stats!.totalCalls).toBe(1);
		});
	});
});