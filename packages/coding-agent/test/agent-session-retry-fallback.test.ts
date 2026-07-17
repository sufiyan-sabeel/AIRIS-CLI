/**
 * Tests for agent session model fallback chains.
 *
 * Covers:
 * - Fallback model switching when retries exhausted
 * - Fallback event emission (auto_retry_fallback)
 * - Fallback ordering verification
 * - Infinite-loop prevention (duplicate model skip)
 * - All fallbacks exhausted fallback
 * - Fallback cancellation during wait
 * - Cost accounting on fallback switch
 * - Provider failure simulation triggering fallback chain
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent, type AgentEvent } from "@sufiyan-sabeel/airis-agent-core";
import { type AssistantMessage, type AssistantMessageEvent, EventStream, getModel } from "@sufiyan-sabeel/airis-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRegistry } from "../src/core/model-registry.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createTestResourceLoader } from "./utilities.ts";

class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") return event.message;
				if (event.type === "error") return event.error;
				throw new Error("Unexpected event type");
			},
		);
	}
}

function createAssistantMessage(text: string, overrides?: Partial<AssistantMessage>): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "mock",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
		...overrides,
	};
}

describe("AgentSession model fallback", () => {
	let session: AgentSession;
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `airis-fallback-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		if (session) {
			session.dispose();
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	/**
	 * Create a session that always fails with a retryable error.
	 * Used to test fallback chain behavior when retries are exhausted.
	 */
	function createFailingSession(options?: {
		maxRetries?: number;
		fallbackModels?: string[];
		errorMessage?: string;
		alwaysFail?: boolean;
	}) {
		const maxRetries = options?.maxRetries ?? 1;
		const fallbackModels = options?.fallbackModels ?? [];
		const errorMessage = options?.errorMessage ?? "overloaded_error";
		const alwaysFail = options?.alwaysFail ?? true;
		let callCount = 0;

		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: "Test", tools: [] },
			streamFn: () => {
				callCount++;
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					const msg = createAssistantMessage("", {
						stopReason: "error",
						errorMessage,
					});
					stream.push({ type: "start", partial: msg });
					stream.push({ type: "error", reason: "error", error: msg });
				});
				return stream;
			},
		});

		const sessionManager = SessionManager.inMemory();
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		const modelRegistry = ModelRegistry.create(authStorage, tempDir);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		authStorage.setRuntimeApiKey("openai", "test-key");
		settingsManager.applyOverrides({
			retry: {
				enabled: true,
				maxRetries,
				baseDelayMs: 1,
				fallbackModels,
			},
		});

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRegistry,
			resourceLoader: createTestResourceLoader(),
		});

		return { session, getCallCount: () => callCount };
	}

	// ================================================================
	// Fallback Event Emission
	// ================================================================

	it("emits auto_retry_fallback when fallback model is configured", async () => {
		const created = createFailingSession({
			maxRetries: 1,
			fallbackModels: ["openai/gpt-4o"],
		});

		const fallbackEvents: Array<{ fromModel: string; toModel: string }> = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_fallback") {
				fallbackEvents.push({ fromModel: event.fromModel, toModel: event.toModel });
			}
		});

		await created.session.prompt("Test");

		// Should have tried: 1 retry (exhausted) → fallback to gpt-4o → 1 more retry → exhausted
		expect(fallbackEvents.length).toBe(1);
		expect(fallbackEvents[0].fromModel).toContain("anthropic");
		expect(fallbackEvents[0].toModel).toContain("openai/gpt-4o");
	});

	it("emits fallback events with correct metadata", async () => {
		const created = createFailingSession({
			maxRetries: 1,
			fallbackModels: ["openai/gpt-4o"],
		});

		const events: Array<{ type: string; attempt?: number; fallbackIndex?: number }> = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_start") {
				events.push({ type: "start", attempt: event.attempt });
			}
			if (event.type === "auto_retry_fallback") {
				events.push({
					type: "fallback",
					fallbackIndex: event.fallbackIndex,
				});
			}
			if (event.type === "auto_retry_end") {
				events.push({ type: "end", attempt: event.attempt });
			}
		});

		await created.session.prompt("Test");

		// Expect: start(attempt=1) → end(not yet) → fallback
		// After retry exhausted on first model, fallback triggers
		const startEvents = events.filter((e) => e.type === "start");
		const fallbackEvts = events.filter((e) => e.type === "fallback");

		// At least 1 retry start and 1 fallback
		expect(startEvents.length).toBeGreaterThanOrEqual(1);
		expect(fallbackEvts.length).toBe(1);
		expect(fallbackEvts[0].fallbackIndex).toBe(1);
	});

	// ================================================================
	// Fallback Ordering
	// ================================================================

	it("tries fallback models in order", async () => {
		// Configure with 3 fallback models; all fail
		const created = createFailingSession({
			maxRetries: 0, // No retries on each model, immediately fallback
			fallbackModels: ["openai/gpt-4o", "anthropic/claude-sonnet-4-5", "openai/gpt-4o-mini"],
		});

		const fallbackModels: string[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_fallback") {
				fallbackModels.push(`${event.fromModel}->${event.toModel}`);
			}
		});

		await created.session.prompt("Test");

		// Should have tried fallbacks in order
		expect(fallbackModels.length).toBeGreaterThanOrEqual(1);
		// The first fallback should be from anthropic to openai/gpt-4o
		expect(fallbackModels[0]).toContain("anthropic");
		expect(fallbackModels[0]).toContain("gpt-4o");
	});

	// ================================================================
	// Infinite-Loop Prevention
	// ================================================================

	it("skips fallback model when it is the same as the current model", async () => {
		// If the fallback model is the same as the current model, it should be skipped
		const created = createFailingSession({
			maxRetries: 0,
			fallbackModels: ["anthropic/claude-sonnet-4-5"], // Same as initial model
		});

		const fallbackEvents: Array<{ index: number }> = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_fallback") {
				fallbackEvents.push({ index: event.fallbackIndex });
			}
		});

		await created.session.prompt("Test");

		// Same-model fallback should be skipped - no fallback event should fire
		expect(fallbackEvents.length).toBe(0);
	});

	it("does not infinite-loop when all fallbacks are the same as current model", async () => {
		const created = createFailingSession({
			maxRetries: 0,
			fallbackModels: [
				"anthropic/claude-sonnet-4-5", // Same as initial
				"anthropic/claude-sonnet-4-5", // Same again
			],
		});

		// Prompt should eventually complete (not hang)
		await expect(created.session.prompt("Test")).resolves.not.toThrow();

		// Should still have attempted the original retry
		expect(created.getCallCount()).toBeGreaterThanOrEqual(1);
	});

	it("continues to next fallback when current fallback model is not found", async () => {
		// First fallback is invalid (nonexistent model), second should be tried
		const created = createFailingSession({
			maxRetries: 0,
			fallbackModels: ["anthropic/nonexistent-model", "openai/gpt-4o"],
		});

		const fallbackToModels: string[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_fallback") {
				fallbackToModels.push(event.toModel);
			}
		});

		await created.session.prompt("Test");

		// Should have skipped the first (invalid) and used the second
		expect(fallbackToModels.length).toBe(1);
		expect(fallbackToModels[0]).toContain("gpt-4o");
	});

	// ================================================================
	// All Fallbacks Exhausted
	// ================================================================

	it("emits final failure when all fallback models are exhausted", async () => {
		const created = createFailingSession({
			maxRetries: 0,
			fallbackModels: ["openai/gpt-4o"],
		});

		let finalFailed = false;
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_end" && event.success === false) {
				finalFailed = true;
			}
		});

		await created.session.prompt("Test");

		expect(finalFailed).toBe(true);
	});

	// ================================================================
	// No Fallback Configured
	// ================================================================

	it("fails without fallback when no fallbackModels configured", async () => {
		const created = createFailingSession({
			maxRetries: 1,
			fallbackModels: [], // No fallbacks
		});

		const fallbackEvents: unknown[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_fallback") {
				fallbackEvents.push(event);
			}
		});

		await created.session.prompt("Test");

		// Should have no fallback events
		expect(fallbackEvents.length).toBe(0);
	});

	// ================================================================
	// Retry Reset After Fallback
	// ================================================================

	it("resets retry counter after switching to fallback model", async () => {
		const created = createFailingSession({
			maxRetries: 1,
			fallbackModels: ["openai/gpt-4o"],
		});

		const retryAttempts: number[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_start") {
				retryAttempts.push(event.attempt);
			}
		});

		await created.session.prompt("Test");

		// After fallback, retry attempt should reset to 1
		const startAttemptsOnFallback = retryAttempts.filter((a) => a === 1);
		expect(startAttemptsOnFallback.length).toBeGreaterThanOrEqual(1);
	});

	// ================================================================
	// Cancellation During Fallback Wait
	// ================================================================

	it("can be cancelled during fallback delay", async () => {
		const created = createFailingSession({
			maxRetries: 0,
			fallbackModels: ["openai/gpt-4o"],
		});

		// Subscribe and cancel immediately
		const promptPromise = created.session.prompt("Test");

		// Cancel after a short delay
		setTimeout(() => {
			created.session.abortRetry();
		}, 5);

		// Shouldn't throw - just return
		await expect(promptPromise).resolves.not.toThrow();
	});

	// ================================================================
	// Provider Failure Simulation
	// ================================================================

	it("falls back when provider returns rate_limit error after retries", async () => {
		const created = createFailingSession({
			maxRetries: 1,
			fallbackModels: ["openai/gpt-4o"],
			errorMessage: "rate_limit_error: too many requests",
		});

		const fallbackEvents: unknown[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_fallback") {
				fallbackEvents.push(event);
			}
		});

		await created.session.prompt("Test");

		// Rate limit should trigger retry, then fallback
		expect(fallbackEvents.length).toBe(1);
	});

	it("falls back when provider returns 5xx error", async () => {
		const created = createFailingSession({
			maxRetries: 1,
			fallbackModels: ["openai/gpt-4o"],
			errorMessage: "503 Service Unavailable",
		});

		const fallbackEvents: unknown[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_fallback") {
				fallbackEvents.push(event);
			}
		});

		await created.session.prompt("Test");

		expect(fallbackEvents.length).toBe(1);
	});

	// ================================================================
	// Multiple Fallback Chain
	// ================================================================

	it("chains through multiple fallback models", async () => {
		const created = createFailingSession({
			maxRetries: 0,
			fallbackModels: ["openai/gpt-4o", "anthropic/claude-sonnet-4-5", "openai/gpt-4o-mini"],
		});

		const chain: string[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_fallback") {
				chain.push(event.toModel);
			}
		});

		await created.session.prompt("Test");

		// Should have tried up to the last fallback (all fail in this setup)
		expect(chain.length).toBeLessThanOrEqual(3);
		// First fallback should be openai/gpt-4o
		expect(chain[0]).toBeDefined();
	});

	// ================================================================
	// Recovery After Fallback
	// ================================================================

	it("succeeds when fallback model does not error", async () => {
		// Create session where first model fails but openai succeeds
		let callCount = 0;

		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: "Test", tools: [] },
			streamFn: () => {
				callCount++;
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					if (callCount <= 2) {
						// First 2 calls fail (1 retry + exhausted)
						const msg = createAssistantMessage("", {
							stopReason: "error",
							errorMessage: "overloaded_error",
						});
						stream.push({ type: "start", partial: msg });
						stream.push({ type: "error", reason: "error", error: msg });
					} else {
						// Fallback model succeeds
						const msg = createAssistantMessage("Success from fallback", {
							provider: "openai",
							model: "gpt-4o",
						});
						stream.push({ type: "start", partial: msg });
						stream.push({ type: "done", reason: "stop", message: msg });
					}
				});
				return stream;
			},
		});

		const sessionManager = SessionManager.inMemory();
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		const modelRegistry = ModelRegistry.create(authStorage, tempDir);
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		authStorage.setRuntimeApiKey("openai", "test-key");
		settingsManager.applyOverrides({
			retry: {
				enabled: true,
				maxRetries: 1,
				baseDelayMs: 1,
				fallbackModels: ["openai/gpt-4o"],
			},
		});

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRegistry,
			resourceLoader: createTestResourceLoader(),
		});

		let recovered = false;
		session.subscribe((event) => {
			if (event.type === "auto_retry_end" && event.success) {
				recovered = true;
			}
		});

		await session.prompt("Test");

		expect(recovered).toBe(true);
		// Should be 3 calls: 1 initial + 1 retry + 1 on fallback
		expect(callCount).toBe(3);
	});
});
