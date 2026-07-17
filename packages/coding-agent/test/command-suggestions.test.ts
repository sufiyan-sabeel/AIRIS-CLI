import { describe, expect, it } from "vitest";
import { suggestCommands } from "../src/core/command-suggestions.ts";

const ALL = [
	"providers",
	"provider-health",
	"trust",
	"sandbox",
	"security",
	"deps-audit",
	"compact",
	"plan",
	"recap",
	"stats",
	"help",
	"status",
];

describe("suggestCommands", () => {
	it("suggests providers on provider errors", () => {
		const suggestions = suggestCommands(
			{
				recentErrors: ["Provider returned 503"],
				changedFiles: [],
				sessionMessages: 0,
				providerErrors: 1,
			},
			ALL,
		);
		expect(suggestions[0].command).toBe("providers");
	});

	it("suggests trust on permission errors", () => {
		const suggestions = suggestCommands(
			{
				recentErrors: ["EACCES: permission denied"],
				changedFiles: [],
				sessionMessages: 0,
				providerErrors: 0,
			},
			ALL,
		);
		expect(suggestions.some((s) => s.command === "trust")).toBe(true);
	});

	it("suggests compact for long sessions", () => {
		const suggestions = suggestCommands(
			{
				recentErrors: [],
				changedFiles: [],
				sessionMessages: 40,
				providerErrors: 0,
			},
			ALL,
		);
		expect(suggestions.some((s) => s.command === "compact")).toBe(true);
	});

	it("suggests plan when many files changed", () => {
		const suggestions = suggestCommands(
			{
				recentErrors: [],
				changedFiles: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"],
				sessionMessages: 5,
				providerErrors: 0,
			},
			ALL,
		);
		expect(suggestions.some((s) => s.command === "plan")).toBe(true);
	});

	it("only returns reachable commands", () => {
		const suggestions = suggestCommands(
			{
				recentErrors: ["Provider timeout"],
				changedFiles: [],
				sessionMessages: 0,
				providerErrors: 1,
			},
			["help", "status"], // providers not available
		);
		expect(suggestions.every((s) => s.command === "help" || s.command === "status")).toBe(true);
	});

	it("falls back to help/status when nothing matches", () => {
		const suggestions = suggestCommands(
			{
				recentErrors: [],
				changedFiles: [],
				sessionMessages: 1,
				providerErrors: 0,
			},
			ALL,
		);
		expect(suggestions.map((s) => s.command)).toEqual(expect.arrayContaining(["help", "status"]));
	});
});
