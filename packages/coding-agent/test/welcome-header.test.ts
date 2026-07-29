import { visibleWidth } from "@sufiyan-sabeel/airis-tui";
import { describe, expect, it, vi } from "vitest";
import { WelcomeHeader, type WelcomeHeaderInfo } from "../src/modes/interactive/components/welcome-header.ts";

vi.mock("../src/modes/interactive/theme/theme.ts", () => ({
	theme: {
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
		italic: (text: string) => text,
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

	beforeEach(() => {
		vi.useFakeTimers();
		// Set system time to a fixed date to prevent dynamic/flaky time differences in snapshots
		// 15:12:00 corresponds to 3:12 PM
		const date = new Date(2026, 0, 1, 15, 12, 0);
		vi.setSystemTime(date);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

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
			const borderRadius = lines.some((line) => line.includes("██████╗"));
			expect(borderRadius).toBe(true);
		});

		it("uses the compact banner at 45 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(45);
			const hasCompactBanner = lines.some((line) => line.includes("A I R I S"));
			expect(hasCompactBanner).toBe(true);
		});

		it("uses the compact banner at 36 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(36);
			const hasCompactBanner = lines.some((line) => line.includes("A I R I S"));
			expect(hasCompactBanner).toBe(true);
		});

		it("uses the minimal variant at 20 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(20);
			const hasMinimalBanner = lines.some((line) => line.includes("✦ A I R I S ✦"));
			expect(hasMinimalBanner).toBe(true);
		});

		it("uses the tiny variant at 15 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(15);
			const hasTinyBanner = lines.some((line) => line.includes("AIRIS CLI"));
			expect(hasTinyBanner).toBe(true);
		});
	});

	describe("branding display", () => {
		it("shows the AIRIS text logo at 60+ columns", () => {
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
			const lines = header.render(20);
			const hasTagline = lines.some((line) => line.includes("AI Coding · Automation · CLI"));
			expect(hasTagline).toBe(false);
		});

		it("shows the compact AIRIS fallback name in the minimal layout", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(20);
			const hasMinimalName = lines.some((line) => line.includes("✦ A I R I S ✦"));
			expect(hasMinimalName).toBe(true);
		});

		it("shows the tiny layout tagline in the tiny layout", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(15);
			const hasTinyTagline = lines.some((line) => line.includes("AI Coding"));
			expect(hasTinyTagline).toBe(true);
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
			const widths = [15, 20, 30, 36, 38, 40, 45, 50, 60, 72, 80, 100, 120];
			for (const width of widths) {
				const lines = header.render(width);
				expect(Array.isArray(lines)).toBe(true);
				expect(lines.length).toBeGreaterThan(0);
				for (const line of lines) {
					expect(visibleWidth(line)).toBeLessThanOrEqual(width);
				}
			}
		});

		it("maintains line count consistency across widths", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines45 = header.render(45);
			const lines80 = header.render(80);
			expect(Math.abs(lines45.length - lines80.length)).toBeLessThanOrEqual(8);
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
