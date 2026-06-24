import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
	createShipId,
	findActiveShipState,
	getShipDir,
	listShipStates,
	readShipState,
	shipStatePath,
	writeShipState,
	writeEvidenceFile,
} from "../../src/core/ship/storage.ts";
import type { ShipState } from "../../src/core/ship/types.ts";

let tempDir: string | undefined;

afterEach(() => {
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

function makeTempDir(): string {
	tempDir = mkdtempSync(join(tmpdir(), "airis-ship-storage-test-"));
	return tempDir;
}

function makeTestState(id: string): ShipState {
	return {
		schemaVersion: "airis.ship.v1",
		id,
		request: "Test request",
		goal: "Test request",
		phase: "request",
		tasks: [],
		todos: [],
		evidence: [],
		requirements: [],
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

describe("AIRIS ship storage", () => {
	test("creates unique ship IDs", () => {
		const id1 = createShipId();
		const id2 = createShipId();
		expect(id1).toMatch(/^ship_/);
		expect(id2).toMatch(/^ship_/);
		expect(id1).not.toBe(id2);
	});

	test("computes correct paths", () => {
		const cwd = "/tmp/test";
		expect(getShipDir(cwd)).toBe("/tmp/test/.airis/ship");
		expect(shipStatePath(cwd, "ship_abc")).toBe("/tmp/test/.airis/ship/ship_abc.json");
	});

	test("rejects unsafe IDs", () => {
		expect(() => shipStatePath("/tmp", "../etc/passwd")).toThrow("Invalid");
		expect(() => shipStatePath("/tmp", "a/b")).toThrow("Invalid");
	});

	test("writes and reads ship state", () => {
		const cwd = makeTempDir();
		const state = makeTestState("ship_test1");
		writeShipState(cwd, state);
		const loaded = readShipState(cwd, "ship_test1");
		expect(loaded.id).toBe("ship_test1");
		expect(loaded.phase).toBe("request");
	});

	test("throws on missing state", () => {
		const cwd = makeTempDir();
		expect(() => readShipState(cwd, "nonexistent")).toThrow("not found");
	});

	test("lists ship states", () => {
		const cwd = makeTempDir();
		writeShipState(cwd, makeTestState("ship_a"));
		writeShipState(cwd, makeTestState("ship_b"));
		const states = listShipStates(cwd);
		expect(states.length).toBe(2);
		const ids = states.map((s) => s.id).sort();
		expect(ids).toEqual(["ship_a", "ship_b"]);
	});

	test("lists empty directory", () => {
		const cwd = makeTempDir();
		const states = listShipStates(cwd);
		expect(states.length).toBe(0);
	});

	test("finds active ship state", () => {
		const cwd = makeTempDir();
		const completed = makeTestState("ship_done");
		completed.phase = "completed";
		writeShipState(cwd, completed);

		const active = makeTestState("ship_active");
		active.phase = "implementation";
		writeShipState(cwd, active);

		const found = findActiveShipState(cwd);
		expect(found?.id).toBe("ship_active");
	});

	test("returns undefined when no active state", () => {
		const cwd = makeTempDir();
		const done = makeTestState("ship_done");
		done.phase = "completed";
		writeShipState(cwd, done);
		expect(findActiveShipState(cwd)).toBeUndefined();
	});

	test("writes evidence file", () => {
		const cwd = makeTempDir();
		const path = writeEvidenceFile(cwd, "ship_abc", "report.md", "# Report\n");
		expect(path).toContain("ship_abc-report.md");
		const { readFileSync } = require("node:fs");
		const content = readFileSync(path, "utf-8");
		expect(content).toBe("# Report\n");
	});
});
