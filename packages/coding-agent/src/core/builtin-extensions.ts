/**
 * Built-in extensions for plan mode and todo management.
 *
 * These extensions provide core functionality that is always available:
 * - Plan mode: Read-only exploration with plan extraction and execution tracking
 * - Todo tool: Task list management for the agent
 */

import type { ExtensionFactory } from "./extensions/types.ts";
import planModeExtension from "./builtin-plan-mode.ts";
import todoExtension from "./builtin-todo.ts";

/**
 * Get built-in extension factories.
 * These are loaded as inline extensions and don't require user installation.
 */
export function getBuiltinExtensionFactories(): ExtensionFactory[] {
	return [planModeExtension, todoExtension];
}
