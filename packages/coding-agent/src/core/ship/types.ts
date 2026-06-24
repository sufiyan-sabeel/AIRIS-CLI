import { type Static, Type } from "typebox";

export const ShipPhaseSchema = Type.Union([
	Type.Literal("request"),
	Type.Literal("contract"),
	Type.Literal("approval"),
	Type.Literal("planning"),
	Type.Literal("implementation"),
	Type.Literal("formatting"),
	Type.Literal("testing"),
	Type.Literal("launch"),
	Type.Literal("verification"),
	Type.Literal("proof"),
	Type.Literal("commit"),
	Type.Literal("completed"),
	Type.Literal("failed"),
	Type.Literal("cancelled"),
]);

export const ShipTaskStatusSchema = Type.Union([
	Type.Literal("pending"),
	Type.Literal("in_progress"),
	Type.Literal("completed"),
	Type.Literal("failed"),
	Type.Literal("skipped"),
]);

export const ShipTaskSchema = Type.Object({
	id: Type.String(),
	description: Type.String(),
	status: ShipTaskStatusSchema,
	startedAt: Type.Optional(Type.String()),
	finishedAt: Type.Optional(Type.String()),
	error: Type.Optional(Type.String()),
});

export const ShipTodoSchema = Type.Object({
	id: Type.String(),
	description: Type.String(),
	status: ShipTaskStatusSchema,
	phase: ShipPhaseSchema,
});

export const ShipEvidenceSchema = Type.Object({
	label: Type.String(),
	path: Type.Optional(Type.String()),
	sha256: Type.Optional(Type.String()),
	timestamp: Type.String(),
});

export const ShipRequirementCheckSchema = Type.Object({
	id: Type.String(),
	description: Type.String(),
	status: Type.Union([Type.Literal("pass"), Type.Literal("fail"), Type.Literal("unverified")]),
	details: Type.Optional(Type.String()),
});

export const ShipStateSchema = Type.Object({
	schemaVersion: Type.Literal("airis.ship.v1"),
	id: Type.String(),
	request: Type.String(),
	goal: Type.String(),
	phase: ShipPhaseSchema,
	tasks: Type.Array(ShipTaskSchema),
	todos: Type.Array(ShipTodoSchema),
	evidence: Type.Array(ShipEvidenceSchema),
	requirements: Type.Array(ShipRequirementCheckSchema),
	missionId: Type.Optional(Type.String()),
	createdAt: Type.String(),
	updatedAt: Type.String(),
	completedAt: Type.Optional(Type.String()),
	error: Type.Optional(Type.String()),
});

export type ShipPhase = Static<typeof ShipPhaseSchema>;
export type ShipTaskStatus = Static<typeof ShipTaskStatusSchema>;
export type ShipTask = Static<typeof ShipTaskSchema>;
export type ShipTodo = Static<typeof ShipTodoSchema>;
export type ShipEvidence = Static<typeof ShipEvidenceSchema>;
export type ShipRequirementCheck = Static<typeof ShipRequirementCheckSchema>;
export type ShipState = Static<typeof ShipStateSchema>;

export const SHIP_TRANSITIONS: Record<ShipPhase, ShipPhase[]> = {
	request: ["contract", "cancelled"],
	contract: ["approval", "cancelled"],
	approval: ["planning", "cancelled"],
	planning: ["implementation", "cancelled"],
	implementation: ["formatting", "failed", "cancelled"],
	formatting: ["testing", "failed", "cancelled"],
	testing: ["launch", "verification", "failed", "cancelled"],
	launch: ["verification", "failed", "cancelled"],
	verification: ["proof", "failed", "cancelled"],
	proof: ["commit", "completed", "failed", "cancelled"],
	commit: ["completed", "failed", "cancelled"],
	completed: [],
	failed: ["approval", "cancelled"],
	cancelled: [],
};
