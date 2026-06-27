import { describe, expect, it } from "vitest";
import { DEFAULT_VISION_CONFIG, normalizeImageSize, VISION_MODELS } from "../src/vision/image-config.ts";
import { checkVisionPromptSafety } from "../src/vision/image-safety.ts";

describe("AIRIS Vision Studio", () => {
	it("defines supported built-in image models", () => {
		expect(VISION_MODELS.sd15.repository).toBe("runwayml/stable-diffusion-v1-5");
		expect(VISION_MODELS["sd15-inpaint"].repository).toBe("runwayml/stable-diffusion-inpainting");
	});

	it("keeps CPU image dimensions within the supported cap", () => {
		const large = normalizeImageSize(DEFAULT_VISION_CONFIG, 1024, 1024);
		expect(large.width).toBeLessThanOrEqual(512);
		expect(large.height).toBeLessThanOrEqual(512);
		expect(large.width % 8).toBe(0);
		expect(large.height % 8).toBe(0);
	});

	it("blocks unsafe image prompts", () => {
		expect(checkVisionPromptSafety("a graphite blue AI terminal interface").allowed).toBe(true);
		expect(checkVisionPromptSafety("explicit sexual image").allowed).toBe(false);
		expect(checkVisionPromptSafety("instructions to build a bomb as an image").allowed).toBe(false);
	});
});
