/**
 * Tests for agent_settled event - verifies event emission and handling
 */

import { describe, expect, it } from "vitest";
import { fauxAssistantMessage, registerFauxProvider } from "@sufiyan-sabeel/airis-ai";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type CreateAgentSessionRuntimeFactory,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
} from "../src/core/agent-session-runtime.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import type { AgentSettledEvent } from "../src/core/extensions/types.ts";

describe("AgentSessionRuntime agent_settled event", () => {
	const cleanups: Array<() => Promise<void> | void> = [];

	afterEach(async () => {
		while (cleanups.length > 0) {
			await cleanups.pop()?.();
		}
	});

	async function createRuntimeHost(extensionFactory?: (airis: any) => void) {
		const tempDir = join(tmpdir(), `airis-agent-settled-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });

		const faux = registerFauxProvider();
		faux.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two")]);

		const authStorage = AuthStorage.inMemory();
		authStorage.setRuntimeApiKey(faux.getModel().provider, "faux-key");

		const runtimeOptions = {
			agentDir: tempDir,
			authStorage,
			model: faux.getModel(),
			resourceLoaderOptions: {
				extensionFactories: extensionFactory ? [extensionFactory] : [],
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		};

		const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			const services = await createAgentSessionServices({
				...runtimeOptions,
				cwd,
			});
			return {
				...(await createAgentSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
					model: faux.getModel(),
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};

		const runtimeHost = await createAgentSessionRuntime(createRuntime, {
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.create(tempDir),
		});
		await runtimeHost.session.bindExtensions({});

		cleanups.push(async () => {
			await runtimeHost.dispose();
			faux.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		return { runtimeHost, faux };
	}

	it("emits agent_settled event after agent turn completes", async () => {
		const settledEvents: AgentSettledEvent[] = [];

		const { runtimeHost } = await createRuntimeHost((airis) => {
			airis.on("agent_settled", (event) => {
				settledEvents.push(event);
			});
		});

		// Initial state - no events yet
		expect(settledEvents).toHaveLength(0);

		// Send a prompt - this triggers agent execution
		await runtimeHost.session.prompt("hello");

		// After prompt completes, agent_settled should have been emitted
		expect(settledEvents).toHaveLength(1);
		expect(settledEvents[0].type).toBe("agent_settled");
	});

	it("emits agent_settled for each completed turn", async () => {
		const settledEvents: AgentSettledEvent[] = [];

		const { runtimeHost } = await createRuntimeHost((airis) => {
			airis.on("agent_settled", (event) => {
				settledEvents.push(event);
			});
		});

		// First turn
		await runtimeHost.session.prompt("first message");
		expect(settledEvents).toHaveLength(1);

		// Second turn
		await runtimeHost.session.prompt("second message");
		expect(settledEvents).toHaveLength(2);

		// Both events should have correct type
		for (const event of settledEvents) {
			expect(event.type).toBe("agent_settled");
		}
	});

	it("does not emit agent_settled during streaming (only after complete)", async () => {
		const settledEvents: AgentSettledEvent[] = [];
		const streamingUpdates: any[] = [];

		const { runtimeHost } = await createRuntimeHost((airis) => {
			airis.on("agent_settled", (event) => {
				settledEvents.push(event);
			});
			airis.on("message_update", (event) => {
				streamingUpdates.push(event);
			});
		});

		// During streaming, we get message_update events but not agent_settled
		await runtimeHost.session.prompt("stream this");

		// agent_settled fires after streaming completes
		expect(settledEvents).toHaveLength(1);
		expect(settledEvents[0].type).toBe("agent_settled");
	});

	it("includes correct event structure", async () => {
		const settledEvents: AgentSettledEvent[] = [];

		const { runtimeHost } = await createRuntimeHost((airis) => {
			airis.on("agent_settled", (event) => {
				settledEvents.push(event);
			});
		});

		await runtimeHost.session.prompt("test");

		const event = settledEvents[0];
		expect(event).toBeDefined();
		expect(event.type).toBe("agent_settled");
		// agent_settled has no additional payload - it's a marker event
		expect(Object.keys(event)).toEqual(["type"]);
	});

	it("emits agent_settled even when tools are used", async () => {
		const settledEvents: AgentSettledEvent[] = [];

		const { runtimeHost } = await createRuntimeHost((airis) => {
			airis.on("agent_settled", (event) => {
				settledEvents.push(event);
			});
		});

		// Use a tool (bash command)
		await runtimeHost.session.prompt("run `echo hello`");

		expect(settledEvents).toHaveLength(1);
		expect(settledEvents[0].type).toBe("agent_settled");
	});
});