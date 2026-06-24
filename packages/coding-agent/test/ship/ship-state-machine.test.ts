import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
	addEvidence,
	addRequirementCheck,
	addTask,
	addTodo,
	canTransition,
	completeTask,
	completeTodo,
	createShipState,
	failTask,
	startTask,
	transitionTo,
} from "../../src/core/ship/state-machine.ts";
import { findActiveShipState, listShipStates, readShipState } from "../../src/core/ship/storage.ts";
import type { ShipPhase } from "../../src/core/ship/types.ts";

let tempDir: string | undefined;

afterEach(() => {
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

function makeTempDir(): string {
	tempDir = mkdtempSync(join(tmpdir(), "airis-ship-test-"));
	return tempDir;
}

describe("AIRIS ship state machine", () => {
	test("creates a ship state with request phase", () => {
		const cwd = makeTempDir();
		const state = createShipState({ cwd, request: "Build a notes app" });
		expect(state.schemaVersion).toBe("airis.ship.v1");
		expect(state.phase).toBe("request");
		expect(state.request).toBe("Build a notes app");
		expect(state.tasks).toEqual([]);
		expect(state.todos).toEqual([]);
	});

	test("persists and reads ship state", () => {
		const cwd = makeTempDir();
		const state = createShipState({ cwd, request: "Persist test" });
		const loaded = readShipState(cwd, state.id);
		expect(loaded.id).toBe(state.id);
		expect(loaded.request).toBe("Persist test");
	});

	test("lists ship states", () => {
		const cwd = makeTempDir();
		createShipState({ cwd, request: "First" });
		createShipState({ cwd, request: "Second" });
		const states = listShipStates(cwd);
		expect(states.length).toBe(2);
	});

	test("finds active ship state", () => {
		const cwd = makeTempDir();
		const state = createShipState({ cwd, request: "Active test" });
		const active = findActiveShipState(cwd);
		expect(active?.id).toBe(state.id);
	});

	test("valid transitions succeed", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Transition test" });

		expect(canTransition(state, "contract")).toBe(true);
		state = transitionTo(state, "contract", cwd);
		expect(state.phase).toBe("contract");

		expect(canTransition(state, "approval")).toBe(true);
		state = transitionTo(state, "approval", cwd);
		expect(state.phase).toBe("approval");

		expect(canTransition(state, "planning")).toBe(true);
		state = transitionTo(state, "planning", cwd);
		expect(state.phase).toBe("planning");

		expect(canTransition(state, "implementation")).toBe(true);
		state = transitionTo(state, "implementation", cwd);
		expect(state.phase).toBe("implementation");
	});

	test("invalid transitions throw", () => {
		const cwd = makeTempDir();
		const state = createShipState({ cwd, request: "Invalid transition test" });
		expect(() => transitionTo(state, "completed", cwd)).toThrow("Cannot transition");
		expect(() => transitionTo(state, "implementation", cwd)).toThrow("Cannot transition");
	});

	test("cancellation from any active phase", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Cancel test" });
		state = transitionTo(state, "contract", cwd);
		expect(canTransition(state, "cancelled")).toBe(true);
		state = transitionTo(state, "cancelled", cwd);
		expect(state.phase).toBe("cancelled");
		expect(state.completedAt).toBeDefined();
	});

	test("failed phase can transition back to approval", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Retry test" });
		state = transitionTo(state, "contract", cwd);
		state = transitionTo(state, "approval", cwd);
		state = transitionTo(state, "planning", cwd);
		state = transitionTo(state, "implementation", cwd);
		state = transitionTo(state, "failed", cwd);
		expect(state.phase).toBe("failed");
		expect(canTransition(state, "approval")).toBe(true);
	});

	test("completed and cancelled phases have no transitions", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Terminal test" });
		state = transitionTo(state, "contract", cwd);
		state = transitionTo(state, "cancelled", cwd);
		expect(canTransition(state, "request")).toBe(false);

		let state2 = createShipState({ cwd, request: "Terminal test 2" });
		state2 = transitionTo(state2, "contract", cwd);
		state2 = transitionTo(state2, "approval", cwd);
		state2 = transitionTo(state2, "planning", cwd);
		state2 = transitionTo(state2, "implementation", cwd);
		state2 = transitionTo(state2, "formatting", cwd);
		state2 = transitionTo(state2, "testing", cwd);
		state2 = transitionTo(state2, "verification", cwd);
		state2 = transitionTo(state2, "proof", cwd);
		state2 = transitionTo(state2, "completed", cwd);
		expect(canTransition(state2, "request")).toBe(false);
	});

	test("tasks can be added, started, and completed", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Task test" });

		state = addTask(state, "Do something", cwd);
		expect(state.tasks.length).toBe(1);
		expect(state.tasks[0].status).toBe("pending");

		state = startTask(state, state.tasks[0].id, cwd);
		expect(state.tasks[0].status).toBe("in_progress");
		expect(state.tasks[0].startedAt).toBeDefined();

		state = completeTask(state, state.tasks[0].id, cwd);
		expect(state.tasks[0].status).toBe("completed");
		expect(state.tasks[0].finishedAt).toBeDefined();
	});

	test("tasks can fail with error", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Fail task test" });
		state = addTask(state, "Failing task", cwd);
		state = startTask(state, state.tasks[0].id, cwd);
		state = failTask(state, state.tasks[0].id, "Something broke", cwd);
		expect(state.tasks[0].status).toBe("failed");
		expect(state.tasks[0].error).toBe("Something broke");
	});

	test("todos can be added and completed", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Todo test" });

		state = addTodo(state, "Step one", "planning", cwd);
		state = addTodo(state, "Step two", "planning", cwd);
		expect(state.todos.length).toBe(2);

		state = completeTodo(state, state.todos[0].id, cwd);
		expect(state.todos[0].status).toBe("completed");
		expect(state.todos[1].status).toBe("pending");
	});

	test("requirement checks and evidence can be added", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Requirements test" });

		state = addRequirementCheck(state, "REQ-001", "Works", "pass", undefined, cwd);
		state = addRequirementCheck(state, "REQ-002", "Fails", "fail", "reason", cwd);
		expect(state.requirements.length).toBe(2);

		state = addEvidence(state, "proof", "/path/to/proof", "abc123", cwd);
		expect(state.evidence.length).toBe(1);
	});

	test("full lifecycle: request through completed", () => {
		const cwd = makeTempDir();
		let state = createShipState({ cwd, request: "Full lifecycle" });

		state = transitionTo(state, "contract", cwd);
		state = transitionTo(state, "approval", cwd);
		state = transitionTo(state, "planning", cwd);
		state = addTodo(state, "Plan", "planning", cwd);
		state = completeTodo(state, state.todos[0].id, cwd);
		state = transitionTo(state, "implementation", cwd);
		state = addTask(state, "Implement", cwd);
		state = startTask(state, state.tasks[0].id, cwd);
		state = completeTask(state, state.tasks[0].id, cwd);
		state = transitionTo(state, "formatting", cwd);
		state = transitionTo(state, "testing", cwd);
		state = transitionTo(state, "verification", cwd);
		state = addEvidence(state, "evidence", undefined, "hash", cwd);
		state = transitionTo(state, "proof", cwd);
		state = transitionTo(state, "completed", cwd);

		expect(state.phase).toBe("completed");
		expect(state.completedAt).toBeDefined();
		expect(state.todos.length).toBe(1);
		expect(state.tasks.length).toBe(1);
		expect(state.evidence.length).toBe(1);

		const loaded = readShipState(cwd, state.id);
		expect(loaded.phase).toBe("completed");
	});
});
