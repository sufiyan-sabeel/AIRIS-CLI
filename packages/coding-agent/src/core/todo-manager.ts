import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type TodoPriority = "low" | "medium" | "high";

export interface TodoItem {
	id: string;
	text: string;
	done: boolean;
	priority: TodoPriority;
	createdAt: string;
	doneAt?: string;
}

export interface TodoManagerOptions {
	todosDir: string;
}

const TODOS_FILE = "todos.json";

function ensureDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

function getTodosPath(opts: TodoManagerOptions): string {
	return join(opts.todosDir, TODOS_FILE);
}

function loadTodos(opts: TodoManagerOptions): TodoItem[] {
	const path = getTodosPath(opts);
	if (!existsSync(path)) return [];
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return [];
	}
}

function saveTodos(opts: TodoManagerOptions, todos: TodoItem[]): void {
	ensureDir(opts.todosDir);
	writeFileSync(getTodosPath(opts), JSON.stringify(todos, null, 2), "utf-8");
}

function generateId(): string {
	return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTodoManager(opts: TodoManagerOptions) {
	let todos = loadTodos(opts);

	return {
		getAll(): TodoItem[] {
			return [...todos];
		},

		getPending(): TodoItem[] {
			return todos.filter((t) => !t.done);
		},

		getDone(): TodoItem[] {
			return todos.filter((t) => t.done);
		},

		add(text: string, priority: TodoPriority = "medium"): TodoItem {
			const item: TodoItem = {
				id: generateId(),
				text,
				done: false,
				priority,
				createdAt: new Date().toISOString(),
			};
			todos.push(item);
			saveTodos(opts, todos);
			return item;
		},

		done(idOrText: string): TodoItem | undefined {
			const item = todos.find(
				(t) => !t.done && (t.id === idOrText || t.text.toLowerCase().includes(idOrText.toLowerCase())),
			);
			if (!item) return undefined;
			item.done = true;
			item.doneAt = new Date().toISOString();
			saveTodos(opts, todos);
			return item;
		},

		undo(idOrText: string): TodoItem | undefined {
			const item = todos.find(
				(t) => t.done && (t.id === idOrText || t.text.toLowerCase().includes(idOrText.toLowerCase())),
			);
			if (!item) return undefined;
			item.done = false;
			item.doneAt = undefined;
			saveTodos(opts, todos);
			return item;
		},

		remove(idOrText: string): TodoItem | undefined {
			const idx = todos.findIndex((t) => t.id === idOrText || t.text.toLowerCase().includes(idOrText.toLowerCase()));
			if (idx === -1) return undefined;
			const [removed] = todos.splice(idx, 1);
			saveTodos(opts, todos);
			return removed;
		},

		clearDone(): number {
			const before = todos.length;
			todos = todos.filter((t) => !t.done);
			saveTodos(opts, todos);
			return before - todos.length;
		},

		reorder(orderedIds: string[]): void {
			const reordered: TodoItem[] = [];
			for (const id of orderedIds) {
				const item = todos.find((t) => t.id === id);
				if (item) reordered.push(item);
			}
			for (const item of todos) {
				if (!reordered.includes(item)) reordered.push(item);
			}
			todos = reordered;
			saveTodos(opts, todos);
		},

		formatList(showDone: boolean = true): string {
			const pending = todos.filter((t) => !t.done);
			const done = showDone ? todos.filter((t) => t.done) : [];

			if (pending.length === 0 && done.length === 0) {
				return "No tasks.";
			}

			const lines: string[] = [];
			if (pending.length > 0) {
				lines.push("Pending:");
				for (const item of pending) {
					const pri = item.priority === "high" ? "!" : item.priority === "low" ? "-" : " ";
					lines.push(`  [ ] ${pri} ${item.text} (${item.id})`);
				}
			}
			if (done.length > 0) {
				if (pending.length > 0) lines.push("");
				lines.push("Done:");
				for (const item of done) {
					lines.push(`  [x]   ${item.text} (${item.id})`);
				}
			}
			return lines.join("\n");
		},

		formatItem(item: TodoItem): string {
			const status = item.done ? "[x]" : "[ ]";
			const pri = item.priority === "high" ? "!" : item.priority === "low" ? "-" : " ";
			return `${status} ${pri} ${item.text} (${item.id})`;
		},
	};
}

export type TodoManager = ReturnType<typeof createTodoManager>;
