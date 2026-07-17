import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "../src/core/memory-store.ts";

let tmpDir: string;
let storePath: string;

beforeEach(() => {
	tmpDir = join(tmpdir(), `airis-memory-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tmpDir, { recursive: true });
	storePath = join(tmpDir, "memory.json");
});

afterEach(() => {
	if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

describe("MemoryStore", () => {
	it("adds and lists entries", () => {
		const store = new MemoryStore({ storePath, now: () => 1000 });
		const entry = store.add({ kind: "fact", text: "AIRIS uses Bun for binaries", tags: ["build"] });
		expect(entry.id).toMatch(/^mem-/);
		expect(store.list()).toHaveLength(1);
	});

	it("merges duplicate entries by kind/text/project", () => {
		const store = new MemoryStore({ storePath, now: () => 1000 });
		store.add({ kind: "fact", text: "dup", tags: ["a"] });
		store.add({ kind: "fact", text: "dup", tags: ["b"] });
		const entries = store.list();
		expect(entries).toHaveLength(1);
		expect(entries[0].tags).toEqual(expect.arrayContaining(["a", "b"]));
	});

	it("recalls relevant entries ranked by token overlap", () => {
		const store = new MemoryStore({ storePath, now: () => 1000 });
		store.add({ kind: "fact", text: "The database layer uses Postgres", tags: ["db"] });
		store.add({ kind: "fact", text: "The UI uses a terminal renderer", tags: ["ui"] });
		const results = store.recall("postgres database");
		expect(results[0].text).toContain("Postgres");
	});

	it("filters recall by kind and project", () => {
		const store = new MemoryStore({ storePath, now: () => 1000 });
		store.add({ kind: "preference", text: "prefer tabs", project: "proj-x" });
		store.add({ kind: "fact", text: "proj-y uses spaces", project: "proj-y" });
		const byProject = store.recall("indentation", { project: "proj-x" });
		expect(byProject).toHaveLength(1);
		expect(byProject[0].project).toBe("proj-x");
		const byKind = store.recall("", { kind: "preference" });
		expect(byKind).toHaveLength(1);
	});

	it("tracks recall count and recency", () => {
		const store = new MemoryStore({ storePath, now: () => 1000 });
		const e = store.add({ kind: "note", text: "remember this" });
		store.recall("remember");
		const reloaded = new MemoryStore({ storePath, now: () => 2000 });
		const entry = reloaded.get(e.id);
		expect(entry?.recallCount).toBe(1);
		expect(entry?.lastRecalledAt).toBe(1000);
	});

	it("removes and clears entries", () => {
		const store = new MemoryStore({ storePath, now: () => 1000 });
		const e = store.add({ kind: "note", text: "x" });
		expect(store.remove(e.id)).toBe(true);
		expect(store.list()).toHaveLength(0);
		store.add({ kind: "note", text: "y" });
		store.clear();
		expect(store.list()).toHaveLength(0);
	});
});
