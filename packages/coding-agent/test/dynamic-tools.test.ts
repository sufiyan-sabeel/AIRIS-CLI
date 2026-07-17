/**
 * Tests for dynamic-tools.ts - Dynamic tool registry
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
	DynamicToolRegistry,
	dynamicToolRegistry,
	registerDynamicTool,
	executeDynamicTool,
	getAllToolNames,
	createAllToolDefinitions,
	type DynamicToolContext,
	type ToolRegistrationOptions,
} from "../src/core/tools/dynamic-tools.ts";
import type { ToolName, ToolsOptions } from "../src/core/tools/index.ts";

describe("dynamic-tools", () => {
	// Reset the singleton before each test
	beforeEach(() => {
		dynamicToolRegistry.clear();
	});

	afterEach(() => {
		dynamicToolRegistry.clear();
	});

	describe("DynamicToolRegistry", () => {
		it("returns singleton instance", () => {
			const instance1 = DynamicToolRegistry.getInstance();
			const instance2 = DynamicToolRegistry.getInstance();
			expect(instance1).toBe(instance2);
		});

		it("registers a dynamic tool", () => {
			const options: ToolRegistrationOptions = {
				name: "custom_tool",
				description: "A custom tool",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			};

			const definition = dynamicToolRegistry.register(options);

			expect(definition.name).toBe("custom_tool");
			expect(definition.description).toBe("A custom tool");
			expect(definition.dynamicId).toBe("dynamic:test:custom_tool");
			expect(definition.source).toBe("test");
			expect(dynamicToolRegistry.hasTool("custom_tool")).toBe(true);
		});

		it("throws when registering duplicate tool name", () => {
			const options: ToolRegistrationOptions = {
				name: "duplicate",
				description: "First",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test1",
			};

			dynamicToolRegistry.register(options);

			const options2: ToolRegistrationOptions = {
				...options,
				description: "Second",
				source: "test2",
			};

			expect(() => dynamicToolRegistry.register(options2)).toThrow("already registered");
		});

		it("unregisters a tool", () => {
			const options: ToolRegistrationOptions = {
				name: "to_remove",
				description: "Will be removed",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			};

			dynamicToolRegistry.register(options);
			expect(dynamicToolRegistry.hasTool("to_remove")).toBe(true);

			const removed = dynamicToolRegistry.unregister("to_remove");
			expect(removed).toBe(true);
			expect(dynamicToolRegistry.hasTool("to_remove")).toBe(false);
		});

		it("returns false when unregistering non-existent tool", () => {
			const removed = dynamicToolRegistry.unregister("nonexistent");
			expect(removed).toBe(false);
		});

		it("gets tool definition by name", () => {
			const options: ToolRegistrationOptions = {
				name: "get_tool",
				description: "Get me",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			};

			dynamicToolRegistry.register(options);
			const tool = dynamicToolRegistry.getTool("get_tool");

			expect(tool).toBeDefined();
			expect(tool!.name).toBe("get_tool");
		});

		it("returns undefined for non-existent tool", () => {
			const tool = dynamicToolRegistry.getTool("nonexistent");
			expect(tool).toBeUndefined();
		});

		it("gets factory for a tool", () => {
			let callCount = 0;
			const options: ToolRegistrationOptions = {
				name: "factory_tool",
				description: "Has factory",
				inputSchema: { type: "object", properties: {} },
				factory: async () => {
					callCount++;
					return { content: [{ type: "text", text: "ok" }] };
				},
				source: "test",
			};

			dynamicToolRegistry.register(options);
			const factory = dynamicToolRegistry.getFactory("factory_tool");

			expect(factory).toBeDefined();
			expect(typeof factory).toBe("function");
		});

		it("gets all registered tools", () => {
			dynamicToolRegistry.register({
				name: "tool1",
				description: "Tool 1",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			});

			dynamicToolRegistry.register({
				name: "tool2",
				description: "Tool 2",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			});

			const allTools = dynamicToolRegistry.getAllTools();
			expect(allTools.length).toBe(2);
			expect(allTools.map((t) => t.name).sort()).toEqual(["tool1", "tool2"]);
		});

		it("gets tools by source", () => {
			dynamicToolRegistry.register({
				name: "tool_a",
				description: "A",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "extension_a",
			});

			dynamicToolRegistry.register({
				name: "tool_b",
				description: "B",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "extension_b",
			});

			const sourceATools = dynamicToolRegistry.getToolsBySource("extension_a");
			expect(sourceATools.length).toBe(1);
			expect(sourceATools[0].name).toBe("tool_a");
		});

		it("gets tools by tag", () => {
			dynamicToolRegistry.register({
				name: "tagged_tool",
				description: "Tagged",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
				tags: ["custom", "experimental"],
			});

			dynamicToolRegistry.register({
				name: "untagged_tool",
				description: "No tags",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			});

			const tagged = dynamicToolRegistry.getToolsByTag("custom");
			expect(tagged.length).toBe(1);
			expect(tagged[0].name).toBe("tagged_tool");
		});

		it("maintains load order", () => {
			dynamicToolRegistry.register({
				name: "first",
				description: "First",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			});

			dynamicToolRegistry.register({
				name: "second",
				description: "Second",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			});

			const loadOrder = dynamicToolRegistry.getLoadOrder();
			expect(loadOrder).toEqual(["first", "second"]);
		});

		it("tracks cache statistics", () => {
			dynamicToolRegistry.register({
				name: "stats_tool",
				description: "For stats",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test_source",
			});

			// Access the tool to increment hit count
			dynamicToolRegistry.getTool("stats_tool");
			dynamicToolRegistry.getTool("stats_tool");

			const stats = dynamicToolRegistry.getCacheStats();
			expect(stats.totalTools).toBe(1);
			expect(stats.cachedTools).toBe(1);
			expect(stats.totalHits).toBe(2);
			expect(stats.bySource["test_source"]).toBe(1);
		});

		it("clears all tools", () => {
			dynamicToolRegistry.register({
				name: "clear_tool",
				description: "Will be cleared",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			});

			expect(dynamicToolRegistry.getAllTools().length).toBe(1);

			dynamicToolRegistry.clear();

			expect(dynamicToolRegistry.getAllTools().length).toBe(0);
			expect(dynamicToolRegistry.getLoadOrder().length).toBe(0);
		});

		it("converts to core tool definition", () => {
			dynamicToolRegistry.register({
				name: "core_compat",
				description: "Compatible",
				inputSchema: { type: "object", properties: { param: { type: "string" } } },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
				executionMode: "serial",
				requiresConfirmation: true,
				timeoutMs: 60000,
			});

			const coreDef = dynamicToolRegistry.toCoreToolDefinition("core_compat");

			expect(coreDef).toBeDefined();
			expect(coreDef!.name).toBe("core_compat");
			expect(coreDef!.description).toBe("Compatible");
			expect(coreDef!.executionMode).toBe("serial");
			expect(coreDef!.requiresConfirmation).toBe(true);
			expect(coreDef!.timeoutMs).toBe(60000);
		});
	});

	describe("registerDynamicTool convenience function", () => {
		it("registers tool via global registry", () => {
			const def = registerDynamicTool({
				name: "convenience_tool",
				description: "Via convenience function",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "convenience",
			});

			expect(def.name).toBe("convenience_tool");
			expect(dynamicToolRegistry.hasTool("convenience_tool")).toBe(true);
		});
	});

	describe("executeDynamicTool", () => {
		it("executes registered tool factory", async () => {
			let executed = false;
			const context: DynamicToolContext = {
				cwd: "/tmp",
				sessionId: "test-session",
				extensionName: "test-ext",
				abortSignal: AbortSignal.timeout(1000),
				metadata: {},
			};

			dynamicToolRegistry.register({
				name: "executable_tool",
				description: "Can execute",
				inputSchema: { type: "object", properties: {} },
				factory: async (_args, ctx) => {
					expect(ctx).toBe(context);
					executed = true;
					return { content: [{ type: "text", text: "executed" }] };
				},
				source: "test",
			});

			const result = await executeDynamicTool("executable_tool", {}, context);

			expect(executed).toBe(true);
			expect(result).toEqual({ content: [{ type: "text", text: "executed" }] });
		});

		it("throws for non-existent tool", async () => {
			const context: DynamicToolContext = {
				cwd: "/tmp",
				sessionId: "test-session",
				extensionName: "test-ext",
				abortSignal: AbortSignal.timeout(1000),
				metadata: {},
			};

			await expect(executeDynamicTool("nonexistent", {}, context)).rejects.toThrow(
				'Dynamic tool "nonexistent" not found',
			);
		});
	});

	describe("getAllToolNames", () => {
		it("returns built-in tools plus dynamic tools", () => {
			const builtInNames = new Set<ToolName>(["read", "bash", "edit", "write"]);
			dynamicToolRegistry.register({
				name: "dynamic_one",
				description: "Dynamic 1",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			});

			const allNames = getAllToolNames(builtInNames);
			expect(allNames.has("read")).toBe(true);
			expect(allNames.has("bash")).toBe(true);
			expect(allNames.has("dynamic_one")).toBe(true);
		});
	});

	describe("createAllToolDefinitions", () => {
		it("creates definitions for built-in and dynamic tools", async () => {
			dynamicToolRegistry.register({
				name: "dynamic_def",
				description: "Has definition",
				inputSchema: { type: "object", properties: {} },
				factory: async () => ({ content: [{ type: "text", text: "ok" }] }),
				source: "test",
			});

			const options: ToolsOptions = {};
			const definitions = await createAllToolDefinitions("/tmp", options);

			expect(definitions).toHaveProperty("read");
			expect(definitions).toHaveProperty("bash");
			expect(definitions).toHaveProperty("dynamic_def");
		});
	});
});