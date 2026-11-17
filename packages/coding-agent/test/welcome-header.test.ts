import { visibleWidth } from "@sufiyan-sabeel/airis-tui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeHeader, type WelcomeHeaderInfo } from "../src/modes/interactive/components/welcome-header.ts";

// The mock must expose every theme method WelcomeHeader actually calls,
// otherwise the component throws "theme.<method> is not a function" and the
// assertions never run. The real theme (src/modes/interactive/theme/theme.ts)
// implements fg, bg, bold, italic, underline, inverse and strikethrough; this
// component uses fg, bold and italic.
vi.mock("../src/modes/interactive/theme/theme.ts", () => ({
	theme: {
		fg: (_color: string, text: string) => text,
		bg: (_color: string, text: string) => text,
		bold: (text: string) => text,
		italic: (text: string) => text,
		underline: (text: string) => text,
		inverse: (text: string) => text,
		strikethrough: (text: string) => text,
	},
}));

describe("WelcomeHeader", () => {
	const baseInfo: WelcomeHeaderInfo = {
		model: "mimo-v2.5-free",
		provider: "opencode",
		mode: "normal · @coding · @automation",
		cwd: "/home/user/projects/airis-cli",
		version: "2.0.0",
	};

	describe("variant selection", () => {
		it("uses the logo banner at 120 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(120);
			const hasLogoBanner = lines.some((line) => line.includes("██████╗"));
			expect(hasLogoBanner).toBe(true);
		});

		it("uses the logo banner at 72 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(72);
			const hasLogoBanner = lines.some((line) => line.includes("██████╗"));
			expect(hasLogoBanner).toBe(true);
		});

		it("uses the logo banner at 60 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(60);
			const hasLogoBanner = lines.some((line) => line.includes("██████╗"));
			expect(hasLogoBanner).toBe(true);
		});

		// The full block logo is 52 columns wide, and WIDTH_LOGO is derived from it
		// (LOGO_BLOCK_WIDTH + 4), so 45 columns renders the compact "A I R I S"
		// banner. This expectation predates the banner widening in d3571e1da and
		// was never updated because the suite could not run.
		it("uses the compact banner at 45 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(45);
			const hasCompactBanner = lines.some((line) => line.includes("A I R I S"));
			expect(hasCompactBanner).toBe(true);
		});

		it("uses the minimal fallback at 36 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(36);
			const hasMinimalEmblem = lines.some((line) => line.includes("◆"));
			expect(hasMinimalEmblem).toBe(true);
		});

		// The component has no ASCII-art (slash) variant: selectVariant() returns
		// logo | compact | minimal | tiny, and none of them draws slashes.
		it("uses the compact banner at 35 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(35);
			expect(lines.some((line) => line.includes("A I R I S"))).toBe(true);
		});

		it("uses the minimal emblem at 20 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(20);
			expect(lines.some((line) => line.includes("✦"))).toBe(true);
		});
	});

	describe("branding display", () => {
		it("shows the AIRIS text logo at 40+ columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			const hasTextLogo = lines.some((line) => line.includes("██████╗"));
			expect(hasTextLogo).toBe(true);
		});

		it("shows the logo tagline in the logo banner", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			const hasTagline = lines.some((line) => line.includes("AI Coding · Automation · CLI"));
			expect(hasTagline).toBe(true);
		});

		it("does not show the logo tagline in the minimal layout", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(36);
			const hasTagline = lines.some((line) => line.includes("AI Coding · Automation · CLI"));
			expect(hasTagline).toBe(false);
		});

		it("shows the AIRIS name in the narrow layouts", () => {
			const header = new WelcomeHeader(baseInfo);
			// 36 columns renders the compact banner, 24 renders the minimal one.
			// Both spell the wordmark with spaces ("A I R I S"), so a bare "AIRIS"
			// substring never matches.
			for (const width of [36, 24]) {
				const lines = header.render(width);
				expect(lines.some((line) => line.includes("A I R I S"))).toBe(true);
			}
		});

		// "Multi-platform AI CLI" does not exist anywhere in the component; the
		// tagline that ships is "AI Coding · Automation · CLI", shown only in the
		// full logo banner.
		it("shows the AIRIS wordmark in the compact layout at 40 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(40);
			expect(lines.some((line) => line.includes("A I R I S"))).toBe(true);
		});
	});

	describe("metadata rendering", () => {
		it("shows model information", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			const hasModel = lines.some((line) => line.includes("mimo-v2.5-free"));
			expect(hasModel).toBe(true);
		});

		it("shows provider information", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			const hasProvider = lines.some((line) => line.includes("opencode"));
			expect(hasProvider).toBe(true);
		});

		it("shows mode information", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			const hasMode = lines.some((line) => line.includes("normal"));
			expect(hasMode).toBe(true);
		});

		it("shows workspace information", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			const hasCwd = lines.some((line) => line.includes("airis-cli"));
			expect(hasCwd).toBe(true);
		});

		it("truncates long workspace paths", () => {
			const longPath = "/home/user/very/long/path/to/some/deeply/nested/project/directory";
			const header = new WelcomeHeader({ ...baseInfo, cwd: longPath });
			const lines = header.render(50);
			const hasTruncatedPath = lines.some((line) => line.includes("..."));
			expect(hasTruncatedPath).toBe(true);
		});
	});

	describe("responsive behavior", () => {
		it("renders without errors at all widths", () => {
			const header = new WelcomeHeader(baseInfo);
			const widths = [20, 30, 36, 38, 40, 45, 50, 60, 72, 80, 100, 120];
			for (const width of widths) {
				const lines = header.render(width);
				expect(Array.isArray(lines)).toBe(true);
				expect(lines.length).toBeGreaterThan(0);
				for (const line of lines) {
					expect(visibleWidth(line)).toBeLessThanOrEqual(width);
				}
			}
		});

		it("maintains line count consistency within a variant", () => {
			const header = new WelcomeHeader(baseInfo);
			// 60 and 80 both render the full logo banner. 45 renders the compact
			// banner, which legitimately has a different height, so comparing it
			// against 80 was never a meaningful invariant.
			const lines60 = header.render(60);
			const lines80 = header.render(80);
			expect(Math.abs(lines60.length - lines80.length)).toBeLessThanOrEqual(2);
		});

		it("caches results for same width", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines1 = header.render(80);
			const lines2 = header.render(80);
			expect(lines1).toBe(lines2);
		});

		it("invalidates cache on width change", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines1 = header.render(80);
			const lines2 = header.render(60);
			expect(lines1).not.toBe(lines2);
		});
	});

	describe("setInfo", () => {
		it("updates info and invalidates cache", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines1 = header.render(80);
			header.setInfo({ model: "new-model" });
			const lines2 = header.render(80);
			expect(lines1).not.toBe(lines2);
		});
	});

	describe("edge cases", () => {
		it("handles empty info", () => {
			const header = new WelcomeHeader({});
			const lines = header.render(80);
			expect(Array.isArray(lines)).toBe(true);
			expect(lines.length).toBeGreaterThan(0);
		});

		it("handles very narrow terminals", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(15);
			expect(Array.isArray(lines)).toBe(true);
			expect(lines.length).toBeGreaterThan(0);
		});

		it("handles very wide terminals", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(200);
			expect(Array.isArray(lines)).toBe(true);
			expect(lines.length).toBeGreaterThan(0);
		});
	});

	describe("snapshot tests", () => {
		// The banner renders the current local time and a time-of-day greeting,
		// so snapshots taken against the real clock differ on every run (one CI
		// run recorded "2:34 PM" and the next "2:54 PM"). Pin the clock.
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-15T10:30:00"));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("matches snapshot at 120 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(120);
			expect(lines).toMatchSnapshot("welcome-header-120");
		});

		it("matches snapshot at 80 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			expect(lines).toMatchSnapshot("welcome-header-80");
		});

		it("matches snapshot at 60 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(60);
			expect(lines).toMatchSnapshot("welcome-header-60");
		});

		it("matches snapshot at 50 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(50);
			expect(lines).toMatchSnapshot("welcome-header-50");
		});

		it("matches snapshot at 45 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(45);
			expect(lines).toMatchSnapshot("welcome-header-45");
		});

		it("matches snapshot at 36 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(36);
			expect(lines).toMatchSnapshot("welcome-header-36");
		});
	});
});
