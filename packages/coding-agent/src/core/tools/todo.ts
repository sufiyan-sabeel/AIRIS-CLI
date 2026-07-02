import { Text } from "@sufiyan-sabeel/airis-tui";
import { type Static, Type } from "typebox";
import type { Theme } from "../../modes/interactive/theme/theme.ts";
import type { ToolDefinition } from "../extensions/types.ts";
import type { TodoManager, TodoPriority } from "../todo-manager.ts";

const todoSchema = Type.Object({
	action: Type.Union(
		[
			Type.Literal("add"),
			Type.Literal("done"),
			Type.Literal("undo"),
			Type.Literal("list"),
			Type.Literal("remove"),
			Type.Literal("clear-done"),
		],
		{ description: "Action to perform" },
	),
	text: Type.Optional(Type.String({ description: "Task text (required for add)" })),
	id: Type.Optional(Type.String({ description: "Task ID or partial text match (for done/undo/remove)" })),
	priority: Type.Optional(
		Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")], {
			description: "Task priority (default: medium)",
		}),
	),
});

export type TodoToolInput = Static<typeof todoSchema>;

function formatTodoCall(args: TodoToolInput, theme: Theme): string {
	const action = theme.fg("toolTitle", theme.bold(`todo ${args.action}`));
	if (args.action === "add" && args.text) {
		const pri = args.priority ? ` [${args.priority}]` : "";
		return `${action} ${theme.fg("accent", args.text)}${pri}`;
	}
	if ((args.action === "done" || args.action === "undo" || args.action === "remove") && args.id) {
		return `${action} ${theme.fg("accent", args.id)}`;
	}
	return action;
}

function formatTodoResult(_args: TodoToolInput, result: string, theme: Theme): string {
	if (result.startsWith("No tasks")) {
		return theme.fg("muted", result);
	}
	return result;
}

export function createTodoToolDefinition(todoManager: TodoManager): ToolDefinition<typeof todoSchema, string> {
	return {
		name: "todo",
		label: "todo",
		description:
			"Manage your personal task list. Use this to track what needs to be done, mark tasks complete, and review progress. Actions: add, done, undo, list, remove, clear-done.",
		promptSnippet: "Manage personal task list",
		promptGuidelines: [
			"Use the todo tool to track multi-step tasks.",
			"Add tasks before starting work, mark them done as you complete them.",
			"Review the list periodically to stay on track.",
		],
		parameters: todoSchema,
		async execute(
			_toolCallId,
			{ action, text, id, priority }: TodoToolInput,
			_signal?: AbortSignal,
			_onUpdate?,
			_ctx?,
		) {
			let output: string;

			switch (action) {
				case "add": {
					if (!text) {
						output = "Error: 'text' is required for add action.";
						break;
					}
					const item = todoManager.add(text, (priority as TodoPriority) ?? "medium");
					output = `Added: ${todoManager.formatItem(item)}`;
					break;
				}
				case "done": {
					if (!id) {
						output = "Error: 'id' is required for done action.";
						break;
					}
					const doneItem = todoManager.done(id);
					if (!doneItem) {
						output = `No pending task found matching "${id}".`;
					} else {
						output = `Completed: ${todoManager.formatItem(doneItem)}`;
					}
					break;
				}
				case "undo": {
					if (!id) {
						output = "Error: 'id' is required for undo action.";
						break;
					}
					const undoneItem = todoManager.undo(id);
					if (!undoneItem) {
						output = `No completed task found matching "${id}".`;
					} else {
						output = `Reopened: ${todoManager.formatItem(undoneItem)}`;
					}
					break;
				}
				case "list": {
					output = todoManager.formatList();
					break;
				}
				case "remove": {
					if (!id) {
						output = "Error: 'id' is required for remove action.";
						break;
					}
					const removed = todoManager.remove(id);
					if (!removed) {
						output = `No task found matching "${id}".`;
					} else {
						output = `Removed: ${todoManager.formatItem(removed)}`;
					}
					break;
				}
				case "clear-done": {
					const count = todoManager.clearDone();
					output = count > 0 ? `Cleared ${count} completed task(s).` : "No completed tasks to clear.";
					break;
				}
				default:
					output = `Unknown action: ${action}`;
			}

			return { content: [{ type: "text", text: output }], details: output };
		},
		renderCall(args, theme) {
			const text = new Text("", 0, 0);
			text.setText(formatTodoCall(args, theme));
			return text;
		},
		renderResult(result, options, theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			if (options.expanded) {
				text.setText(formatTodoResult(context.args, result.details as string, theme));
			} else {
				text.setText(theme.fg("muted", "[todo]"));
			}
			return text;
		},
	};
}
