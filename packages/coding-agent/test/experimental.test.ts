import { afterEach, describe, expect, it } from "vitest";
import { areExperimentalFeaturesEnabled } from "../src/core/experimental.ts";

describe("areExperimentalFeaturesEnabled", () => {
	const originalPiExperimental = process.env.AIRIS_EXPERIMENTAL;

	afterEach(() => {
		if (originalPiExperimental === undefined) {
			delete process.env.AIRIS_EXPERIMENTAL;
		} else {
			process.env.AIRIS_EXPERIMENTAL = originalPiExperimental;
		}
	});

	it("returns false when AIRIS_EXPERIMENTAL is unset", () => {
		delete process.env.AIRIS_EXPERIMENTAL;

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	it("returns false when AIRIS_EXPERIMENTAL is empty", () => {
		process.env.AIRIS_EXPERIMENTAL = "";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	it("returns true when AIRIS_EXPERIMENTAL is set to 1", () => {
		process.env.AIRIS_EXPERIMENTAL = "1";

		expect(areExperimentalFeaturesEnabled()).toBe(true);
	});

	it("returns false when AIRIS_EXPERIMENTAL is set to 0", () => {
		process.env.AIRIS_EXPERIMENTAL = "0";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	it("returns false when AIRIS_EXPERIMENTAL is set to a non-1 value", () => {
		process.env.AIRIS_EXPERIMENTAL = "true";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});
});
