import { createHash } from "node:crypto";
import type { SessionEntry, SessionManager } from "../session-manager.ts";
import type {
	AdaptiveTodoItem,
	AdaptiveTodoPriority,
	AdaptiveTodoSnapshot,
	AdaptiveTodoStatus,
} from "./types.ts";

export const ADAPTIVE_TODO_CUSTOM_TYPE = "adaptive.todo.state";

function nowIso(): string {
	return new Date().toISOString();
}

function stableTodoId(description: string, index = 0): string {
	const digest = createHash("sha1").update(`${index}:${description.trim().toLowerCase()}`).digest("hex").slice(0, 10);
	return `todo_${digest}`;
}

function isTodoStatus(value: unknown): value is AdaptiveTodoStatus {
	return value === "pending" || value === "in_progress" || value === "completed" || value === "blocked" || value === "cancelled";
}

function isTodoPriority(value: unknown): value is AdaptiveTodoPriority {
	return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function normalizeItem(raw: unknown): AdaptiveTodoItem | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const item = raw as Record<string, unknown>;
	const description = typeof item.description === "string" ? item.description : typeof item.text === "string" ? item.text : "";
	if (!description.trim()) return undefined;
	const createdAt = typeof item.createdAt === "string" ? item.createdAt : nowIso();
	return {
		id: typeof item.id === "string" && item.id ? item.id : stableTodoId(description),
		description: description.trim(),
		status: isTodoStatus(item.status) ? item.status : item.done === true ? "completed" : "pending",
		dependencies: Array.isArray(item.dependencies) ? item.dependencies.filter((v): v is string => typeof v === "string") : [],
		priority: isTodoPriority(item.priority) ? item.priority : "medium",
		completionEvidence: Array.isArray(item.completionEvidence)
			? item.completionEvidence.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
			: [],
		failureReason: typeof item.failureReason === "string" ? item.failureReason : undefined,
		createdAt,
		updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : createdAt,
	};
}

function normalizeSnapshot(data: unknown): AdaptiveTodoSnapshot {
	if (!data || typeof data !== "object") {
		return { version: 1, items: [], updatedAt: nowIso() };
	}
	const raw = data as Record<string, unknown>;
	const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem).filter((i): i is AdaptiveTodoItem => !!i) : [];
	return {
		version: 1,
		goal: typeof raw.goal === "string" ? raw.goal : undefined,
		items,
		updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
	};
}

export class AdaptiveTodoStore {
	private readonly sessionManager: SessionManager;
	private snapshot: AdaptiveTodoSnapshot;

	constructor(sessionManager: SessionManager) {
		this.sessionManager = sessionManager;
		this.snapshot = this.restore();
	}

	reload(): AdaptiveTodoSnapshot {
		this.snapshot = this.restore();
		return this.getSnapshot();
	}

	getSnapshot(): AdaptiveTodoSnapshot {
		return {
			...this.snapshot,
			items: this.snapshot.items.map((item) => ({ ...item, dependencies: [...item.dependencies], completionEvidence: [...item.completionEvidence] })),
		};
	}

	getOpenItems(): AdaptiveTodoItem[] {
		return this.snapshot.items.filter((item) => item.status === "pending" || item.status === "in_progress" || item.status === "blocked");
	}

	getInProgress(): AdaptiveTodoItem | undefined {
		return this.snapshot.items.find((item) => item.status === "in_progress");
	}

	getBlockableInProgress(): AdaptiveTodoItem | undefined {
		return this.snapshot.items.find((item) => {
			if (item.status !== "in_progress") return false;
			const desc = item.description.toLowerCase();
			return desc.includes("test") || desc.includes("verif") || desc.includes("build") || desc.includes("check") || desc.includes("lint") || desc.includes("compile");
		});
	}

	replacePlan(goal: string, descriptions: string[]): AdaptiveTodoSnapshot {
		const timestamp = nowIso();
		const existing = new Map(this.snapshot.items.map((item) => [item.description.trim().toLowerCase(), item]));
		const items = descriptions
			.map((description, index) => description.trim())
			.filter(Boolean)
			.map((description, index): AdaptiveTodoItem => {
				const previous = existing.get(description.toLowerCase());
				return previous
					? { ...previous, updatedAt: timestamp }
					: {
							id: stableTodoId(description, index),
							description,
							status: index === 0 ? "in_progress" : "pending",
							dependencies: index === 0 ? [] : [stableTodoId(descriptions[index - 1] ?? "", index - 1)],
							priority: index === 0 ? "high" : "medium",
							completionEvidence: [],
							createdAt: timestamp,
							updatedAt: timestamp,
						};
			});
		this.snapshot = this.enforceSingleInProgress({ version: 1, goal: goal.trim(), items, updatedAt: timestamp });
		this.persist();
		return this.getSnapshot();
	}

	ensurePlan(goal: string, descriptions: string[]): AdaptiveTodoSnapshot {
		if (this.getOpenItems().length > 0) {
			return this.getSnapshot();
		}
		return this.replacePlan(goal, descriptions);
	}

	updateStatus(
		id: string,
		status: AdaptiveTodoStatus,
		options?: { evidence?: string; failureReason?: string },
	): AdaptiveTodoItem | undefined {
		const item = this.snapshot.items.find((candidate) => candidate.id === id);
		if (!item) return undefined;
		if (status === "completed" && (!options?.evidence || options.evidence.trim().length === 0)) {
			throw new Error("Completion evidence is required before marking an adaptive TODO completed.");
		}
		item.status = status;
		item.updatedAt = nowIso();
		if (options?.evidence) item.completionEvidence.push(options.evidence.trim());
		item.failureReason = options?.failureReason;
		this.snapshot.updatedAt = item.updatedAt;
		this.snapshot = this.enforceSingleInProgress(this.snapshot, item.id);
		this.persist();
		return { ...item, dependencies: [...item.dependencies], completionEvidence: [...item.completionEvidence] };
	}

	recordEvidence(id: string, evidence: string): AdaptiveTodoItem | undefined {
		const item = this.snapshot.items.find((candidate) => candidate.id === id);
		if (!item || !evidence.trim()) return undefined;
		item.completionEvidence.push(evidence.trim());
		item.updatedAt = nowIso();
		this.snapshot.updatedAt = item.updatedAt;
		this.persist();
		return { ...item, dependencies: [...item.dependencies], completionEvidence: [...item.completionEvidence] };
	}

	advanceAfterEvidence(evidence: string): AdaptiveTodoSnapshot {
		const current = this.getInProgress();
		if (current) {
			this.updateStatus(current.id, "completed", { evidence });
		}
		const next = this.snapshot.items.find((item) => item.status === "pending" && item.dependencies.every((dep) => {
			const dependency = this.snapshot.items.find((candidate) => candidate.id === dep);
			return !dependency || dependency.status === "completed";
		}));
		if (next) {
			this.updateStatus(next.id, "in_progress");
		}
		return this.getSnapshot();
	}

	blockCurrent(reason: string): AdaptiveTodoSnapshot {
		const current = this.getInProgress();
		if (current) {
			this.updateStatus(current.id, "blocked", { failureReason: reason });
		}
		return this.getSnapshot();
	}

	formatForContext(): string {
		const snapshot = this.getSnapshot();
		if (snapshot.items.length === 0) return "No active adaptive TODO plan.";
		const lines = [`Goal: ${snapshot.goal ?? "(unspecified)"}`, "TODO state:"];
		for (const item of snapshot.items) {
			const evidence = item.completionEvidence.length > 0 ? ` evidence=${item.completionEvidence.join("; ")}` : "";
			const failure = item.failureReason ? ` failure=${item.failureReason}` : "";
			lines.push(`- ${item.id} [${item.status}] (${item.priority}) ${item.description}${evidence}${failure}`);
		}
		return lines.join("\n");
	}

	private restore(): AdaptiveTodoSnapshot {
		const entries = this.sessionManager.getBranch();
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (entry.type === "custom" && entry.customType === ADAPTIVE_TODO_CUSTOM_TYPE) {
				return normalizeSnapshot(entry.data);
			}
		}
		return { version: 1, items: [], updatedAt: nowIso() };
	}

	private persist(): void {
		this.sessionManager.appendCustomEntry(ADAPTIVE_TODO_CUSTOM_TYPE, this.getSnapshot());
	}

	private enforceSingleInProgress(snapshot: AdaptiveTodoSnapshot, preferredId?: string): AdaptiveTodoSnapshot {
		let primarySeen = false;
		const items = snapshot.items.map((item) => {
			if (item.status !== "in_progress") return item;
			if (!primarySeen && (!preferredId || item.id === preferredId)) {
				primarySeen = true;
				return item;
			}
			return { ...item, status: "pending" as const, updatedAt: nowIso() };
		});
		if (!primarySeen) {
			const first = items.find((item) => item.status === "in_progress");
			if (first) primarySeen = true;
		}
		return { ...snapshot, items };
	}
}

export function getLatestAdaptiveTodoSnapshot(entries: SessionEntry[]): AdaptiveTodoSnapshot {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "custom" && entry.customType === ADAPTIVE_TODO_CUSTOM_TYPE) {
			return normalizeSnapshot(entry.data);
		}
	}
	return { version: 1, items: [], updatedAt: nowIso() };
}
