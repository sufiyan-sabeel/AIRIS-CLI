import assert from "node:assert";
import { after, describe, it } from "node:test";

// Mock process.env and process.stdout before importing modules under test
const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_STDOUT_ISTTY = process.stdout.isTTY;

function setupNoColor() {
	process.env.NO_COLOR = "1";
	process.stdout.isTTY = true;
}

function setupCI() {
	delete process.env.NO_COLOR;
	process.env.CI = "true";
	process.stdout.isTTY = true;
}

function setupTTY() {
	delete process.env.NO_COLOR;
	delete process.env.CI;
	process.stdout.isTTY = true;
}

function setupNonTTY() {
	delete process.env.NO_COLOR;
	delete process.env.CI;
	process.stdout.isTTY = false;
}

describe("utils - NO_COLOR and animation detection", () => {
	it("should detect NO_COLOR environment variable", async () => {
		setupNoColor();
		const { isNoColor } = await import("../src/utils.ts");
		assert.strictEqual(isNoColor(), true);
	});

	it("should return false when NO_COLOR is not set", async () => {
		setupTTY();
		const { isNoColor } = await import("../src/utils.ts");
		assert.strictEqual(isNoColor(), false);
	});

	it("should disable animations in CI environment", async () => {
		setupCI();
		const { areAnimationsDisabled } = await import("../src/utils.ts");
		assert.strictEqual(areAnimationsDisabled(), true);
	});

	it("should disable animations in non-TTY output", async () => {
		setupNonTTY();
		const { areAnimationsDisabled } = await import("../src/utils.ts");
		assert.strictEqual(areAnimationsDisabled(), true);
	});

	it("should enable animations in TTY with no NO_COLOR or CI", async () => {
		setupTTY();
		const { areAnimationsDisabled } = await import("../src/utils.ts");
		assert.strictEqual(areAnimationsDisabled(), false);
	});

	after(() => {
		// Restore state
		process.env = ORIGINAL_ENV;
		process.stdout.isTTY = ORIGINAL_STDOUT_ISTTY;
	});
});

describe("AirisWordmark", () => {
	it("should render differently based on width", async () => {
		setupNoColor(); // Avoid ANSI in tests
		const { AirisWordmark } = await import("../src/components/airis-wordmark.ts");

		const narrow = new AirisWordmark(false, false, "");
		const narrowLines = narrow.render(20);
		assert.ok(narrowLines.length >= 1);
		assert.ok(narrowLines[0].includes("AIRIS"));

		const wide = new AirisWordmark(true, false, "");
		const wideLines = wide.render(80);
		assert.ok(wideLines.length >= 2);
	});

	after(() => {
		process.env = ORIGINAL_ENV;
		process.stdout.isTTY = ORIGINAL_STDOUT_ISTTY;
	});
});

describe("ShortcutBar", () => {
	it("should render shortcuts based on width", async () => {
		setupNoColor();
		const { ShortcutBar } = await import("../src/components/shortcut-bar.ts");

		const bar = new ShortcutBar();
		const narrow = bar.render(30);
		assert.ok(narrow.length >= 1);

		const wide = bar.render(80);
		assert.ok(wide.length >= 1);

		const empty = bar.render(3);
		assert.ok(Array.isArray(empty));
	});

	it("should handle empty items", async () => {
		setupNoColor();
		const { ShortcutBar } = await import("../src/components/shortcut-bar.ts");

		const bar = new ShortcutBar([]);
		const lines = bar.render(80);
		assert.strictEqual(lines.length, 1);
		assert.strictEqual(lines[0], "");
	});

	after(() => {
		process.env = ORIGINAL_ENV;
		process.stdout.isTTY = ORIGINAL_STDOUT_ISTTY;
	});
});

describe("StatusLine", () => {
	it("should render with full data", async () => {
		setupNoColor();
		const { StatusLine } = await import("../src/components/status-line.ts");

		const line = new StatusLine({
			repoPath: "/home/user/project",
			branch: "main",
			version: "1.0.0",
			mode: "chat",
		});

		const rendered = line.render(80);
		assert.ok(rendered.length >= 1);
		assert.ok(rendered[0].includes("main"));
	});

	it("should handle narrow widths with truncation", async () => {
		setupNoColor();
		const { visibleWidth } = await import("../src/utils.ts");
		const { StatusLine } = await import("../src/components/status-line.ts");

		const line = new StatusLine({
			repoPath: "/very/long/repository/path/that/overflows",
			branch: "feature-branch-name",
			version: "1.0.0",
		});

		const rendered = line.render(30);
		assert.ok(rendered.length >= 1);
		// Use visibleWidth to properly measure display width (strips ANSI)
		const displayWidth = visibleWidth(rendered[0]);
		assert.ok(displayWidth <= 35, `Display width ${displayWidth} exceeds 35 cols`);
	});

	it("should handle empty data", async () => {
		setupNoColor();
		const { StatusLine } = await import("../src/components/status-line.ts");

		const line = new StatusLine({});
		const rendered = line.render(80);
		assert.strictEqual(rendered.length, 1);
		assert.strictEqual(rendered[0], "");
	});

	after(() => {
		process.env = ORIGINAL_ENV;
		process.stdout.isTTY = ORIGINAL_STDOUT_ISTTY;
	});
});

describe("PromptArea", () => {
	it("should render prompt with provider info", async () => {
		setupNoColor();
		const { PromptArea } = await import("../src/components/prompt-area.ts");

		const prompt = new PromptArea(
			{
				provider: "Gemini",
				model: "gemini-2.0-flash",
				mode: "code",
			},
			"Use /btw for side questions",
		);

		const rendered = prompt.render(80);
		assert.ok(rendered.length >= 3);
		assert.ok(rendered.some((l) => l.includes("Gemini")));
	});

	it("should render compact on narrow terminals", async () => {
		setupNoColor();
		const { PromptArea } = await import("../src/components/prompt-area.ts");

		const prompt = new PromptArea({
			provider: "Gemini",
			mode: "code",
		});

		const rendered = prompt.render(30);
		assert.ok(rendered.length <= 3);
	});

	it("should render minimal on very narrow terminals", async () => {
		setupNoColor();
		const { PromptArea } = await import("../src/components/prompt-area.ts");

		const prompt = new PromptArea();
		const rendered = prompt.render(3);
		assert.ok(rendered.length >= 1);
		assert.ok(rendered[0].includes("❯"));
	});

	after(() => {
		process.env = ORIGINAL_ENV;
		process.stdout.isTTY = ORIGINAL_STDOUT_ISTTY;
	});
});
