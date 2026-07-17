/**
 * Cross-Session Memory — structured, persisted memory shared across sessions.
 *
 * Provides knowledge persistence (facts, preferences, decisions, notes) and
 * a lightweight keyword/recency-ranked recall. This is the local, offline
 * layer of "semantic memory": it does not require an embedding model and is
 * fully testable. Vector retrieval can be layered on top later by indexing
 * the same entries.
 *
 * Persisted to `.airis/memory/memory.json`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "../config.ts";

export type MemoryKind = "fact" | "preference" | "decision" | "note";

export interface MemoryEntry {
	id: string;
	kind: MemoryKind;
	text: string;
	project?: string;
	tags: string[];
	createdAt: number;
	updatedAt: number;
	/** Number of times this entry has been recalled. */
	recallCount: number;
	/** Epoch ms of the last recall. */
	lastRecalledAt?: number;
	/** Confidence 0..1 used for ranking. */
	confidence: number;
}

export interface MemoryStoreOptions {
	storePath?: string;
	now?: () => number;
}

interface MemoryStoreFile {
	version: number;
	entries: Record<string, MemoryEntry>;
	seq: number;
}

const MAX_TAGS = 16;
const MAX_TEXT = 4000;

function createEmptyFile(): MemoryStoreFile {
	return { version: 1, entries: {}, seq: 0 };
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length > 1);
}

export class MemoryStore {
	private store: MemoryStoreFile;
	private readonly storePath: string;
	private readonly now: () => number;

	constructor(options: MemoryStoreOptions = {}) {
		this.storePath = options.storePath ?? join(getAgentDir(), "memory.json");
		this.now = options.now ?? Date.now;
		this.store = this.load();
	}

	private load(): MemoryStoreFile {
		try {
			if (existsSync(this.storePath)) {
				const parsed = JSON.parse(readFileSync(this.storePath, "utf-8")) as MemoryStoreFile;
				if (parsed.version === 1 && parsed.entries) return parsed;
			}
		} catch {
			// Corrupt; start fresh.
		}
		return createEmptyFile();
	}

	private save(): void {
		const dir = dirname(this.storePath);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), "utf-8");
	}

	/** Add or update a memory entry. Returns the stored entry. */
	add(input: {
		kind: MemoryKind;
		text: string;
		project?: string;
		tags?: string[];
		confidence?: number;
	}): MemoryEntry {
		const now = this.now();
		const text = input.text.slice(0, MAX_TEXT);
		const tags = (input.tags ?? []).slice(0, MAX_TAGS);
		const confidence = Math.max(0, Math.min(1, input.confidence ?? 0.8));

		// Merge with an existing entry of the same kind + text + project.
		for (const entry of Object.values(this.store.entries)) {
			if (
				entry.kind === input.kind &&
				entry.text === text &&
				entry.project === input.project
			) {
				entry.tags = [...new Set([...entry.tags, ...tags])];
				entry.confidence = Math.max(entry.confidence, confidence);
				entry.updatedAt = now;
				this.save();
				return entry;
			}
		}

		this.store.seq++;
		const id = `mem-${this.store.seq}`;
		const entry: MemoryEntry = {
			id,
			kind: input.kind,
			text,
			project: input.project,
			tags,
			createdAt: now,
			updatedAt: now,
			recallCount: 0,
			confidence,
		};
		this.store.entries[id] = entry;
		this.save();
		return entry;
	}

	/** Recall entries relevant to a query, ranked by score then recency. */
	recall(query: string, opts: { limit?: number; project?: string; kind?: MemoryKind } = {}): MemoryEntry[] {
		const limit = opts.limit ?? 10;
		const queryTokens = new Set(tokenize(query));
		const now = this.now();
		const scored: Array<{ entry: MemoryEntry; score: number }> = [];
		for (const entry of Object.values(this.store.entries)) {
			if (opts.project && entry.project && entry.project !== opts.project) continue;
			if (opts.kind && entry.kind !== opts.kind) continue;
			let score = 0;
			const textTokens = tokenize(entry.text);
			const entryTokenSet = new Set(textTokens);
			for (const qt of queryTokens) {
				if (entryTokenSet.has(qt)) score += 2;
				else if (textTokens.some((t) => t.includes(qt) || qt.includes(t))) score += 1;
			}
			for (const tag of entry.tags) {
				if (queryTokens.has(tag.toLowerCase())) score += 3;
			}
			if (score === 0 && queryTokens.size === 0) score = 1; // bare recall lists all
			if (score === 0) continue;
			// Recency boost (decays over 30 days).
			const ageDays = (now - entry.updatedAt) / 86_400_000;
			const recency = Math.max(0, 1 - ageDays / 30) * 0.5;
			score += recency + entry.confidence * 0.5;
			scored.push({ entry, score });
		}
		scored.sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt);
		const top = scored.slice(0, limit).map((s) => s.entry);
		for (const entry of top) {
			entry.recallCount++;
			entry.lastRecalledAt = now;
		}
		if (top.length > 0) this.save();
		return top;
	}

	/** List all entries, newest first. */
	list(opts: { kind?: MemoryKind; project?: string } = {}): MemoryEntry[] {
		return Object.values(this.store.entries)
			.filter((e) => (!opts.kind || e.kind === opts.kind) && (!opts.project || e.project === opts.project))
			.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	/** Remove an entry by id. */
	remove(id: string): boolean {
		if (!this.store.entries[id]) return false;
		delete this.store.entries[id];
		this.save();
		return true;
	}

	/** Clear all entries (used by the `/memory clear` command). */
	clear(): void {
		this.store = createEmptyFile();
		this.save();
	}
}
