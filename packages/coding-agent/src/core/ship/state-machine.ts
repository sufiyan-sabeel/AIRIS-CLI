import { createShipId, nowIso, writeShipState } from "./storage.ts";
import type { ShipPhase, ShipState, ShipTask, ShipTodo } from "./types.ts";
import { SHIP_TRANSITIONS } from "./types.ts";

export interface CreateShipOptions {
	cwd: string;
	request: string;
}

export function createShipState(options: CreateShipOptions): ShipState {
	const now = nowIso();
	const id = createShipId();
	const request = options.request.trim();
	const state: ShipState = {
		schemaVersion: "airis.ship.v1",
		id,
		request,
		goal: request,
		phase: "request",
		tasks: [],
		todos: [],
		evidence: [],
		requirements: [],
		createdAt: now,
		updatedAt: now,
	};
	writeShipState(options.cwd, state);
	return state;
}

export function canTransition(state: ShipState, to: ShipPhase): boolean {
	const allowed = SHIP_TRANSITIONS[state.phase];
	return allowed.includes(to);
}

export function transitionTo(state: ShipState, to: ShipPhase, cwd: string): ShipState {
	if (!canTransition(state, to)) {
		throw new Error(`Cannot transition from ${state.phase} to ${to}`);
	}
	const updated: ShipState = {
		...state,
		phase: to,
		updatedAt: nowIso(),
	};
	if (to === "completed" || to === "failed" || to === "cancelled") {
		updated.completedAt = nowIso();
	}
	writeShipState(cwd, updated);
	return updated;
}

export function addTask(state: ShipState, description: string, cwd: string): ShipState {
	const task: ShipTask = {
		id: `task_${state.tasks.length + 1}`,
		description,
		status: "pending",
	};
	const updated: ShipState = {
		...state,
		tasks: [...state.tasks, task],
		updatedAt: nowIso(),
	};
	writeShipState(cwd, updated);
	return updated;
}

export function startTask(state: ShipState, taskId: string, cwd: string): ShipState {
	const updated: ShipState = {
		...state,
		tasks: state.tasks.map((t) =>
			t.id === taskId ? { ...t, status: "in_progress" as const, startedAt: nowIso() } : t,
		),
		updatedAt: nowIso(),
	};
	writeShipState(cwd, updated);
	return updated;
}

export function completeTask(state: ShipState, taskId: string, cwd: string): ShipState {
	const updated: ShipState = {
		...state,
		tasks: state.tasks.map((t) =>
			t.id === taskId ? { ...t, status: "completed" as const, finishedAt: nowIso() } : t,
		),
		updatedAt: nowIso(),
	};
	writeShipState(cwd, updated);
	return updated;
}

export function failTask(state: ShipState, taskId: string, error: string, cwd: string): ShipState {
	const updated: ShipState = {
		...state,
		tasks: state.tasks.map((t) =>
			t.id === taskId ? { ...t, status: "failed" as const, finishedAt: nowIso(), error } : t,
		),
		updatedAt: nowIso(),
	};
	writeShipState(cwd, updated);
	return updated;
}

export function addTodo(state: ShipState, description: string, phase: ShipPhase, cwd: string): ShipState {
	const todo: ShipTodo = {
		id: `todo_${state.todos.length + 1}`,
		description,
		status: "pending",
		phase,
	};
	const updated: ShipState = {
		...state,
		todos: [...state.todos, todo],
		updatedAt: nowIso(),
	};
	writeShipState(cwd, updated);
	return updated;
}

export function completeTodo(state: ShipState, todoId: string, cwd: string): ShipState {
	const updated: ShipState = {
		...state,
		todos: state.todos.map((t) => (t.id === todoId ? { ...t, status: "completed" as const } : t)),
		updatedAt: nowIso(),
	};
	writeShipState(cwd, updated);
	return updated;
}

export function addRequirementCheck(
	state: ShipState,
	id: string,
	description: string,
	status: "pass" | "fail" | "unverified",
	details: string | undefined,
	cwd: string,
): ShipState {
	const check = { id, description, status, details };
	const updated: ShipState = {
		...state,
		requirements: [...state.requirements, check],
		updatedAt: nowIso(),
	};
	writeShipState(cwd, updated);
	return updated;
}

export function addEvidence(
	state: ShipState,
	label: string,
	path: string | undefined,
	sha256: string | undefined,
	cwd: string,
): ShipState {
	const evidence = { label, path, sha256, timestamp: nowIso() };
	const updated: ShipState = {
		...state,
		evidence: [...state.evidence, evidence],
		updatedAt: nowIso(),
	};
	writeShipState(cwd, updated);
	return updated;
}
