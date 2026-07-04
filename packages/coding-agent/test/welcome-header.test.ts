import { visibleWidth } from "@sufiyan-sabeel/airis-tui";
import { describe, expect, it, vi } from "vitest";
import { WelcomeHeader, type WelcomeHeaderInfo } from "../src/modes/interactive/components/welcome-header.ts";

vi.mock("../src/modes/interactive/theme/theme.ts", () => ({
	theme: {
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
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

		it("uses the logo banner at 45 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(45);
			const hasLogoBanner = lines.some((line) => line.includes("██████╗"));
			expect(hasLogoBanner).toBe(true);
		});

		it("uses the minimal fallback at 36 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(36);
			const hasMinimalEmblem = lines.some((line) => line.includes("◆"));
			expect(hasMinimalEmblem).toBe(true);
		});

		it("uses the ASCII variant at 35 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(35);
			const hasAsciiEmblem = lines.some((line) => line.includes("\\") && line.includes("/"));
			expect(hasAsciiEmblem).toBe(true);
		});

		it("uses the ASCII variant at 20 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(20);
			const hasAsciiEmblem = lines.some((line) => line.includes("\\"));
			expect(hasAsciiEmblem).toBe(true);
		});
	});

	describe("branding display", () => {
		it("shows the AIRIS text logo at 40+ columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			const hasTextLogo = lines.some((line) => line.includes("██████╗"));
			expect(hasTextLogo).toBe(true);
		});

		it("shows the updated subtitle in the logo banner", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(80);
			const hasSubtitle = lines.some((line) => line.includes("Multi-platform AI CLI"));
			expect(hasSubtitle).toBe(true);
		});

		it("does not show the updated subtitle in the minimal layout", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(36);
			const hasSubtitle = lines.some((line) => line.includes("Multi-platform AI CLI"));
			expect(hasSubtitle).toBe(false);
		});

		it("shows the compact AIRIS fallback name in the minimal layout", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(36);
			const hasMinimalName = lines.some((line) => line.includes("AIRIS"));
			expect(hasMinimalName).toBe(true);
		});

		it("shows the updated tagline in the compact layout at 40 columns", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines = header.render(40);
			const hasUpdatedTagline = lines.some((line) => line.includes("Multi-platform AI CLI"));
			expect(hasUpdatedTagline).toBe(true);
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

		it("maintains line count consistency across widths", () => {
			const header = new WelcomeHeader(baseInfo);
			const lines45 = header.render(45);
			const lines80 = header.render(80);
			expect(Math.abs(lines45.length - lines80.length)).toBeLessThanOrEqual(4);
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
