/**
 * Pure unit tests: these import only the AIRIS-owned interface and must pass
 * whether or not the vendored Pi runtime is built. They run everywhere.
 */
import { describe, expect, it } from "vitest";
import { AirisRuntimeUnavailableError, normalizeRuntimeError } from "../src/index.ts";

describe("normalizeRuntimeError", () => {
	it("passes through Error messages", () => {
		expect(normalizeRuntimeError(new Error("boom"))).toBe("boom");
	});

	it("preserves AirisRuntimeUnavailableError text", () => {
		expect(normalizeRuntimeError(new AirisRuntimeUnavailableError("not built"))).toBe("not built");
	});

	it("stringifies plain strings and objects", () => {
		expect(normalizeRuntimeError("plain")).toBe("plain");
		expect(normalizeRuntimeError({ code: 42 })).toBe('{"code":42}');
	});

	it("survives a non-serializable value", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(typeof normalizeRuntimeError(circular)).toBe("string");
	});
});

describe("AirisRuntimeUnavailableError", () => {
	it("carries its name and cause", () => {
		const cause = new Error("underlying");
		const err = new AirisRuntimeUnavailableError("outer", cause);
		expect(err.name).toBe("AirisRuntimeUnavailableError");
		expect(err.cause).toBe(cause);
	});
});
