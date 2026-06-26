import { describe, expect, it } from "vitest";
import { getAirisUserAgent } from "../src/utils/pi-user-agent.ts";

describe("getAirisUserAgent", () => {
	it("formats the user agent expected by airis", () => {
		const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
		const userAgent = getAirisUserAgent("1.2.3");

		expect(userAgent).toBe(`airis/1.2.3 (${process.platform}; ${runtime}; ${process.arch})`);
		expect(userAgent).toMatch(/^airis\/[^\s()]+ \([^;()]+;\s*[^;()]+;\s*[^()]+\)$/);
	});
});
