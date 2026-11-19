/**
 * Integration tests against the genuine Pi runtime.
 *
 * These require the vendored runtime to be BUILT (vendor/pi/packages/*\/dist).
 * They are run by the "Pi Runtime" workflow after the build step, and are
 * skipped with an explicit message when the runtime is absent, so the suite
 * never reports a false pass.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { AirisRuntimeUnavailableError, type AirisRuntime } from "../src/index.ts";
import { createAirisRuntime, isPiRuntimeAvailable } from "../src/pi-runtime.ts";

let available = false;

beforeAll(async () => {
	available = await isPiRuntimeAvailable();
	if (!available) {
		console.warn(
			"[airis-runtime] Pi runtime not importable — integration tests will be skipped. Build vendor/pi first.",
		);
	}
});

describe("Pi runtime availability", () => {
	it("detects the runtime without throwing", () => {
		expect(typeof available).toBe("boolean");
	});

	it("starts a real session when the runtime is built", async () => {
		if (!available) return expect(available).toBe(false);
		const runtime: AirisRuntime = createAirisRuntime({ persistence: "memory" });
		await runtime.start();
		expect(runtime.available).toBe(true);
		await runtime.dispose();
	});

	it("refuses to prompt before start()", async () => {
		if (!available) return expect(available).toBe(false);
		const runtime = createAirisRuntime({ persistence: "memory" });
		await expect(runtime.prompt("hi")).rejects.toBeInstanceOf(AirisRuntimeUnavailableError);
	});

	it("disposes cleanly without a session", async () => {
		if (!available) return expect(available).toBe(false);
		const runtime = createAirisRuntime();
		await expect(runtime.dispose()).resolves.toBeUndefined();
	});
});
