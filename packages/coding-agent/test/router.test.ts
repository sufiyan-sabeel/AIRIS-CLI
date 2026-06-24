import { describe, expect, it } from "vitest";
import { getRouteLogPrefix, parseRoute } from "../src/core/router.ts";

describe("parseRoute", () => {
	it("parses @automation prefix", () => {
		const result = parseRoute("@automation open settings");
		expect(result.mode).toBe("AUTOMATION");
		expect(result.taskText).toBe("open settings");
	});

	it("parses @coding prefix", () => {
		const result = parseRoute("@coding fix npm ci lockfile issue");
		expect(result.mode).toBe("CODING");
		expect(result.taskText).toBe("fix npm ci lockfile issue");
	});

	it("parses @multiauto prefix", () => {
		const result = parseRoute("@multiauto open WhatsApp, search Sufiyan");
		expect(result.mode).toBe("MULTI_AUTO");
		expect(result.taskText).toBe("open WhatsApp, search Sufiyan");
	});

	it("defaults to CHAT when no prefix", () => {
		const result = parseRoute("explain a topic");
		expect(result.mode).toBe("CHAT");
		expect(result.taskText).toBe("explain a topic");
	});

	it("defaults to CHAT for normal questions", () => {
		expect(parseRoute("write Instagram script").mode).toBe("CHAT");
		expect(parseRoute("give coding advice").mode).toBe("CHAT");
		expect(parseRoute("help create a bot").mode).toBe("CHAT");
	});

	it("is case insensitive for prefixes", () => {
		expect(parseRoute("@AUTOMATION open settings").mode).toBe("AUTOMATION");
		expect(parseRoute("@Coding fix bug").mode).toBe("CODING");
		expect(parseRoute("@MULTIAUTO scroll down").mode).toBe("MULTI_AUTO");
	});

	it("handles extra whitespace after prefix", () => {
		const result = parseRoute("@automation   open settings  ");
		expect(result.mode).toBe("AUTOMATION");
		expect(result.taskText).toBe("open settings");
	});

	it("handles empty task after prefix", () => {
		expect(parseRoute("@automation ").mode).toBe("AUTOMATION");
		expect(parseRoute("@automation").mode).toBe("AUTOMATION");
	});

	it("returns CHAT for empty input", () => {
		expect(parseRoute("").mode).toBe("CHAT");
	});

	it("does not match partial prefixes", () => {
		expect(parseRoute("@auto open settings").mode).toBe("CHAT");
		expect(parseRoute("@code fix bug").mode).toBe("CHAT");
		expect(parseRoute("@multi scroll down").mode).toBe("CHAT");
	});
});

describe("getRouteLogPrefix", () => {
	it("returns correct log prefixes", () => {
		expect(getRouteLogPrefix("CHAT")).toBe("ROUTE: CHAT");
		expect(getRouteLogPrefix("AUTOMATION")).toBe("ROUTE: AUTOMATION");
		expect(getRouteLogPrefix("CODING")).toBe("ROUTE: CODING");
		expect(getRouteLogPrefix("MULTI_AUTO")).toBe("ROUTE: MULTI_AUTO");
	});
});
