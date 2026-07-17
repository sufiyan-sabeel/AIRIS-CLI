/**
 * Dynamic Tool Registry
 *
 * Provides runtime tool registration and cache-friendly loading.
 * Extends the existing tool system with extension-driven tools.
 *
 * Part of AIRIS enhancement suite - fully backward compatible.
 */

import type { TSchema } from "typebox";
import type { ToolDefinition, ToolExecutionMode } from "../extensions/types.ts";
import type { ToolName, ToolsOptions } from "./index.ts";

/**
 * Extended tool definition with dynamic registration metadata
 */
export interface DynamicToolDefinition<TArgs extends TSchema = TSchema, TResult = any>
	extends ToolDefinition<TArgs, TResult> {
	/** Unique identifier for the dynamic tool */
	dynamicId: string;
	/** Source of the tool (extension name, plugin name, etc.) */
	source: string;
	/** Whether this tool was loaded from cache */
	fromCache?: boolean;
	/** Version of the tool definition */
	version?: string;
	/** Tags for categorization */
	tags?: string[];
	/** JSON Schema for tool input */
	inputSchema?: TArgs;
	/** Whether user confirmation is required before execution */
	requiresConfirmation?: boolean;
	/** Execution timeout in milliseconds */
	timeoutMs?: number;
}

/**
 * Dynamic tool factory function
 */
export type DynamicToolFactory<TArgs = any, TResult = any> = (
	args: TArgs,
	context: DynamicToolContext,
) => Promise<TResult>;

/**
 * Context provided to dynamic tools during execution
 */
export interface DynamicToolContext {
	/** Current working directory */
	cwd: string;
	/** Session ID */
	sessionId: string;
	/** Extension that registered this tool */
	extensionName: string;
	/** Abort signal for cancellation */
	abortSignal: AbortSignal;
	/** Custom metadata */
	metadata: Record<string, unknown>;
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
	/** Tool name (must be unique) */
	name: string;
	/** Human-readable description */
	description: string;
	/** JSON Schema for input validation */
	inputSchema: Record<string, unknown>;
	/** Tool factory function */
	factory: DynamicToolFactory;
	/** Execution mode */
	executionMode?: ToolExecutionMode;
	/** Source identifier */
	source: string;
	/** Version */
	version?: string;
	/** Tags */
	tags?: string[];
	/** Requires user confirmation */
	requiresConfirmation?: boolean;
	/** Timeout in milliseconds */
	timeoutMs?: number;
}

/**
 * Cache entry for tool performance tracking
 */
export interface ToolCacheEntry {
	definition: DynamicToolDefinition;
	factory: DynamicToolFactory;
	registeredAt: number;
	hitCount: number;
}

/**
 * Dynamic Tool Registry
 *
 * Allows extensions and plugins to register tools at runtime.
 * Maintains cache for performance and provides tool discovery.
 */
export class DynamicToolRegistry {
	private static instance: DynamicToolRegistry;
	private tools = new Map<string, DynamicToolDefinition>();
	private factories = new Map<string, DynamicToolFactory>();
	private cache = new Map<string, ToolCacheEntry>();
	private loadOrder: string[] = [];

	private constructor() {}

	/** Get singleton instance */
	static getInstance(): DynamicToolRegistry {
		if (!DynamicToolRegistry.instance) {
			DynamicToolRegistry.instance = new DynamicToolRegistry();
		}
		return DynamicToolRegistry.instance;
	}

	/**
	 * Register a dynamic tool at runtime
	 */
	register(options: ToolRegistrationOptions): DynamicToolDefinition {
		const {
			name,
			description,
			inputSchema,
			factory,
			executionMode,
			source,
			version,
			tags,
			requiresConfirmation,
			timeoutMs,
		} = options;

		if (this.tools.has(name)) {
			throw new Error(`Tool "${name}" already registered`);
		}

		const dynamicId = `dynamic:${source}:${name}`;
		const definition: DynamicToolDefinition = {
			name,
			description,
			inputSchema,
			executionMode: executionMode ?? "parallel",
			requiresConfirmation: requiresConfirmation ?? false,
			timeoutMs: timeoutMs ?? 30000,
			dynamicId,
			source,
			version,
			tags,
		};

		this.tools.set(name, definition);
		this.factories.set(name, factory);
		this.loadOrder.push(name);

		this.cache.set(name, {
			definition,
			factory,
			registeredAt: Date.now(),
			hitCount: 0,
		});

		return definition;
	}

	/**
	 * Unregister a dynamic tool
	 */
	unregister(name: string): boolean {
		const deleted = this.tools.delete(name) && this.factories.delete(name);
		if (deleted) {
			const index = this.loadOrder.indexOf(name);
			if (index >= 0) this.loadOrder.splice(index, 1);
			this.cache.delete(name);
		}
		return deleted;
	}

	/**
	 * Get a tool definition by name
	 */
	getTool(name: string): DynamicToolDefinition | undefined {
		// Update cache hit count
		const cache = this.cache.get(name);
		if (cache) cache.hitCount++;
		return this.tools.get(name);
	}

	/**
	 * Get the factory for a tool
	 */
	getFactory(name: string): DynamicToolFactory | undefined {
		return this.factories.get(name);
	}

	/**
	 * Check if a tool is registered
	 */
	hasTool(name: string): boolean {
		return this.tools.has(name);
	}

	/**
	 * Get all registered dynamic tools
	 */
	getAllTools(): DynamicToolDefinition[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Get tools by source (extension)
	 */
	getToolsBySource(source: string): DynamicToolDefinition[] {
		return Array.from(this.tools.values()).filter((t) => t.source === source);
	}

	/**
	 * Get tools by tag
	 */
	getToolsByTag(tag: string): DynamicToolDefinition[] {
		return Array.from(this.tools.values()).filter((t) => t.tags?.includes(tag));
	}

	/**
	 * Get load order for deterministic initialization
	 */
	getLoadOrder(): string[] {
		return [...this.loadOrder];
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { totalTools: number; cachedTools: number; totalHits: number; bySource: Record<string, number> } {
		const bySource: Record<string, number> = {};
		let totalHits = 0;
		for (const [, entry] of this.cache) {
			totalHits += entry.hitCount;
			bySource[entry.definition.source] = (bySource[entry.definition.source] || 0) + 1;
		}

		return {
			totalTools: this.tools.size,
			cachedTools: this.cache.size,
			totalHits,
			bySource,
		};
	}

	/**
	 * Clear all dynamic tools (for testing or reload)
	 */
	clear(): void {
		this.tools.clear();
		this.factories.clear();
		this.cache.clear();
		this.loadOrder = [];
	}

	/**
	 * Create a ToolDefinition compatible with the core tool system
	 * from a dynamic tool registration
	 */
	toCoreToolDefinition(name: string): ToolDefinition | undefined {
		const tool = this.tools.get(name);
		if (!tool) return undefined;

		return {
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
			executionMode: tool.executionMode,
			requiresConfirmation: tool.requiresConfirmation,
			timeoutMs: tool.timeoutMs,
		};
	}
}

/**
 * Global registry instance
 */
export const dynamicToolRegistry: DynamicToolRegistry = DynamicToolRegistry.getInstance();

/**
 * Register a tool from an extension
 * Convenience function for extension authors
 */
export function registerDynamicTool(options: ToolRegistrationOptions): DynamicToolDefinition {
	return dynamicToolRegistry.register(options);
}

/**
 * Create a tool executor for a dynamic tool
 */
export async function executeDynamicTool(name: string, args: unknown, context: DynamicToolContext): Promise<unknown> {
	const factory = dynamicToolRegistry.getFactory(name);
	if (!factory) {
		throw new Error(`Dynamic tool "${name}" not found`);
	}
	return factory(args, context);
}

/**
 * Get all available tool names (built-in + dynamic)
 */
export function getAllToolNames(builtInNames: Set<ToolName>): Set<string> {
	const allNames = new Set<string>(builtInNames);
	for (const tool of dynamicToolRegistry.getAllTools()) {
		allNames.add(tool.name);
	}
	return allNames;
}

/**
 * Create tool definitions including dynamic tools
 */
export async function createAllToolDefinitions(
	cwd: string,
	options: ToolsOptions,
): Promise<Record<string, ToolDefinition>> {
	const definitions: Record<string, ToolDefinition> = {};

	// Built-in tools
	const builtInTools = ["read", "bash", "edit", "write", "grep", "find", "ls", "toast"] as const;
	for (const toolName of builtInTools) {
		// Import dynamically to avoid circular dependency
		const { createToolDefinition } = await import("./index.ts");
		definitions[toolName] = createToolDefinition(toolName, cwd, options);
	}

	// Dynamic tools
	for (const tool of dynamicToolRegistry.getAllTools()) {
		const coreDef = dynamicToolRegistry.toCoreToolDefinition(tool.name);
		if (coreDef) {
			definitions[tool.name] = coreDef;
		}
	}

	return definitions;
}
