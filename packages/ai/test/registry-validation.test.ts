import { describe, expect, it } from "vitest";
import {
	countModelsInRegistry,
	describeValidationFailure,
	MIN_RETAINED_RATIO,
	REQUIRED_PROVIDERS,
	validateRegistry,
} from "../scripts/registry-validation.ts";

const ALL_PROVIDERS = [...REQUIRED_PROVIDERS, "openrouter", "mistral"];

describe("countModelsInRegistry", () => {
	it("counts emitted model entries", () => {
		const source = [
			'\t\t\tanthropic: {\n\t\t\t\t"claude-opus-4-5": {\n\t\t\t\t} satisfies Model<"anthropic">,',
			'\t\t\t\t"claude-sonnet-4-6": {\n\t\t\t\t} satisfies Model<"anthropic">,',
		].join("\n");
		expect(countModelsInRegistry(source)).toBe(2);
	});

	it("returns 0 for a file with no entries", () => {
		expect(countModelsInRegistry("export const models = {} as const;")).toBe(0);
	});
});

describe("validateRegistry", () => {
	it("rejects a run where every fetch failed (0 models)", () => {
		const result = validateRegistry({ modelCount: 0, providers: [], previousModelCount: 1200 });
		expect(result.ok).toBe(false);
		expect(result.errors.join(" ")).toMatch(/no models were resolved/i);
	});

	it("rejects an incomplete response that drops a required provider", () => {
		// models.dev failing while OpenRouter succeeds looks like a healthy run
		// unless required providers are checked.
		const result = validateRegistry({
			modelCount: 900,
			providers: ["openrouter", "mistral"],
			previousModelCount: 1000,
		});
		expect(result.ok).toBe(false);
		expect(result.errors.join(" ")).toMatch(/required provider\(s\) missing/i);
	});

	it("rejects a drastic shrink against the committed registry", () => {
		const result = validateRegistry({
			modelCount: 100,
			providers: ALL_PROVIDERS,
			previousModelCount: 1000,
		});
		expect(result.ok).toBe(false);
		expect(result.errors.join(" ")).toMatch(/minimum 50%/i);
	});

	it("accepts a successful generation", () => {
		const result = validateRegistry({
			modelCount: 1000,
			providers: ALL_PROVIDERS,
			previousModelCount: 980,
		});
		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("accepts a first generation when no registry exists yet", () => {
		const result = validateRegistry({
			modelCount: 400,
			providers: ALL_PROVIDERS,
			previousModelCount: null,
		});
		expect(result.ok).toBe(true);
	});

	it("accepts a moderate shrink that stays above the floor", () => {
		const modelCount = Math.ceil(1000 * MIN_RETAINED_RATIO);
		const result = validateRegistry({
			modelCount,
			providers: ALL_PROVIDERS,
			previousModelCount: 1000,
		});
		expect(result.ok).toBe(true);
	});

	it("reports every problem at once, not just the first", () => {
		const result = validateRegistry({
			modelCount: 50,
			providers: ["openrouter"],
			previousModelCount: 1000,
		});
		expect(result.errors.length).toBe(2);
	});
});

describe("describeValidationFailure", () => {
	it("states that the existing registry is unchanged and gives remediation", () => {
		const text = describeValidationFailure(["Required provider(s) missing: anthropic"]);
		expect(text).toMatch(/existing registry is unchanged/i);
		expect(text).toMatch(/Remediation/);
		expect(text).toContain("Required provider(s) missing: anthropic");
	});
});
