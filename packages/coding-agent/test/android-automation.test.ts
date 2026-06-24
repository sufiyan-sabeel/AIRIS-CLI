import { describe, expect, it } from "vitest";
import { formatResponse } from "../src/automation/androidBridge.ts";
import { parseAndroidIntent } from "../src/automation/androidIntentRouter.ts";

describe("Android automation intent routing", () => {
	it("maps safe natural language requests to Android actions", () => {
		const intent = parseAndroidIntent("open settings");
		expect(intent?.action).toBe("open_settings");
		expect(intent?.confidencePercent).toBe(95);

		expect(parseAndroidIntent("automation open settings")?.action).toBe("open_settings");
		expect(parseAndroidIntent("airis automation read screen")?.action).toBe("read_screen");
		expect(parseAndroidIntent("go back")?.action).toBe("back");
		expect(parseAndroidIntent("tap center")?.action).toBe("tap_center");
		expect(parseAndroidIntent("scroll down")?.action).toBe("scroll_down");
		expect(parseAndroidIntent("read screen and click allow")?.params).toMatchObject({ text: "allow" });
		expect(parseAndroidIntent("open WhatsApp and search Sufiyan")?.params).toMatchObject({ search: "Sufiyan" });
	});

	it("supports click_word for single-word click commands", () => {
		const intent = parseAndroidIntent("click allow");
		expect(intent?.action).toBe("click_word");
		expect(intent?.params).toMatchObject({ text: "allow" });
		expect(intent?.confidencePercent).toBe(95);
	});

	it("blocks sensitive Android automation requests", () => {
		const intent = parseAndroidIntent("type my password 1234");
		expect(intent?.safety).toBe("blocked");
	});

	it("marks confirm-safety actions correctly", () => {
		const intent = parseAndroidIntent("send message to John");
		expect(intent?.safety).toBe("confirm");
	});

	it("marks blocked-safety actions correctly", () => {
		expect(parseAndroidIntent("enter password 1234")?.safety).toBe("blocked");
		expect(parseAndroidIntent("make payment")?.safety).toBe("blocked");
		expect(parseAndroidIntent("factory reset")?.safety).toBe("blocked");
	});

	it("formats readable screen text from bridge data", () => {
		expect(
			formatResponse({
				ok: true,
				action: "read_screen",
				message: "Found 2 text elements.",
				data: { text: "Allow\nDeny" },
			}),
		).toBe("Found 2 text elements.\nAllow\nDeny");
	});
});
