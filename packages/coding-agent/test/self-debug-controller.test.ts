import { describe, expect, it } from "vitest";
import { AdaptiveBrainController } from "../src/core/adaptive/controller.ts";
import type { ExtensionContext } from "../src/core/extensions/types.ts";
import type { SessionManager } from "../src/core/session-manager.ts";

function createSessionManager(): SessionManager {
	return {
		getBranch: () => [],
		appendCustomEntry: () => {},
	} as unknown as SessionManager;
}

describe("AdaptiveBrainController self_debug tool", () => {
	it("records fix attempts as skipped until verification is applied", async () => {
		const controller = new AdaptiveBrainController(createSessionManager(), "/test");
		const tool = controller.createSelfDebugToolDefinition();
		const signal = new AbortController().signal;
		const noop = () => {};
		const extensionContext = {} as ExtensionContext;

		const analyze = await tool.execute(
			"call-1",
			{
				action: "analyze",
				errorMessage: "Command timed out after 120 seconds",
				toolName: "bash",
				toolArgs: { command: "npm run check" },
			},
			signal,
			noop,
			extensionContext,
		);

		const sessionId = (analyze.details as { sessionId: string }).sessionId;
		expect(sessionId).toContain("debug-");

		const fix = await tool.execute(
			"call-2",
			{
				action: "fix",
				sessionId,
				fixAction: { type: "bash", command: "npm run check" },
			},
			signal,
			noop,
			extensionContext,
		);

		const fixText = fix.content.find((item) => item.type === "text") as { text: string } | undefined;
		expect(fixText?.text).toContain("Fix recorded");

		const status = await tool.execute(
			"call-3",
			{
				action: "status",
				sessionId,
			},
			signal,
			noop,
			extensionContext,
		);

		const details = status.details as { session: { status: string; attempts: Array<{ result: string }> } };
		expect(details.session.status).toBe("in_progress");
		expect(details.session.attempts[0]?.result).toBe("skipped");
		const statusText = status.content.find((item) => item.type === "text") as { text: string } | undefined;
		expect(statusText?.text).toContain("**Session:**");
	});
});
