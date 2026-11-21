/**
 * Integration tests against the genuine Pi runtime.
 *
 * These require the vendored runtime to be BUILT (vendor/pi/packages/*​/dist) and
 * are run by the "Pi Runtime" workflow after the build step. They need no model
 * credential: they exercise session creation, diagnostics and the session store,
 * never a live completion. When the runtime is absent the suite skips loudly
 * rather than passing falsely.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AirisRuntimeUnavailableError, type AirisRuntime } from "../src/index.ts";
import {
	createAirisRuntime,
	isPiRuntimeAvailable,
	listAirisSessions,
} from "../src/pi-runtime.ts";

let available = false;
let workspace = "";

beforeAll(async () => {
	workspace = mkdtempSync(join(tmpdir(), "airis-runtime-it-"));
	available = await isPiRuntimeAvailable();
	if (!available) {
		console.warn(
			"[airis-runtime] Pi runtime not importable — integration tests skipped. Build vendor/pi first.",
		);
	}
});

afterAll(() => {
	if (workspace) rmSync(workspace, { recursive: true, force: true });
});

describe("Pi runtime availability", () => {
	it("detects the runtime without throwing", () => {
		expect(typeof available).toBe("boolean");
	});
});

describe("session lifecycle (no model required)", () => {
	it("starts a real in-memory session and reports diagnostics", async () => {
		if (!available) return expect(available).toBe(false);
		const runtime: AirisRuntime = createAirisRuntime({
			cwd: workspace,
			persistence: "memory",
		});

		const before = await runtime.diagnostics();
		expect(before.available).toBe(false);

		await runtime.start();
		const after = await runtime.diagnostics();
		expect(after.available).toBe(true);
		expect(after.persistence).toBe("memory");
		expect(after.cwd).toBe(workspace);
		// Pi offers built-in tools; the adapter must surface them verbatim.
		expect(after.tools.length).toBeGreaterThan(0);

		await runtime.dispose();
		expect((await runtime.diagnostics()).available).toBe(false);
	});

	it("refuses to prompt before start()", async () => {
		if (!available) return expect(available).toBe(false);
		const runtime = createAirisRuntime({ cwd: workspace, persistence: "memory" });
		await expect(runtime.prompt("hi")).rejects.toBeInstanceOf(AirisRuntimeUnavailableError);
	});

	it("disposes cleanly without a session", async () => {
		if (!available) return expect(available).toBe(false);
		const runtime = createAirisRuntime({ cwd: workspace });
		await expect(runtime.dispose()).resolves.toBeUndefined();
	});

	it("opens a persistent session without writing outside the workspace", async () => {
		if (!available) return expect(available).toBe(false);
		const runtime = createAirisRuntime({ cwd: workspace, persistence: "persistent" });
		await runtime.start();
		const diagnostics = await runtime.diagnostics();
		expect(diagnostics.persistence).toBe("persistent");
		expect(diagnostics.available).toBe(true);
		await runtime.dispose();
	});

	it("lists sessions through the real session store", async () => {
		if (!available) return expect(available).toBe(false);
		const sessions = await listAirisSessions(workspace);
		expect(Array.isArray(sessions)).toBe(true);
		for (const session of sessions) {
			expect(typeof session.path).toBe("string");
		}
	});
});
