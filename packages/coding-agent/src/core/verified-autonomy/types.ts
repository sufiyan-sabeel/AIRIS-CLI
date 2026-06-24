import { type Static, Type } from "typebox";

export const VerificationKindSchema = Type.Union([
	Type.Literal("command"),
	Type.Literal("file_hash"),
	Type.Literal("git_diff"),
	Type.Literal("manual"),
]);

export const CriterionStatusSchema = Type.Union([
	Type.Literal("pass"),
	Type.Literal("fail"),
	Type.Literal("unverified"),
]);

export const MissionStatusSchema = Type.Union([
	Type.Literal("draft"),
	Type.Literal("approved"),
	Type.Literal("running"),
	Type.Literal("completed"),
	Type.Literal("partially_completed"),
	Type.Literal("failed"),
	Type.Literal("cancelled"),
]);

export const VerificationTargetSchema = Type.Object({
	type: VerificationKindSchema,
	command: Type.Optional(Type.String()),
	path: Type.Optional(Type.String()),
	description: Type.Optional(Type.String()),
});

export const AcceptanceCriterionSchema = Type.Object({
	id: Type.String(),
	description: Type.String(),
	mandatory: Type.Boolean(),
	verification: VerificationTargetSchema,
});

export const MissionContractSchema = Type.Object({
	schemaVersion: Type.Literal("airis.mission.v1"),
	id: Type.String(),
	request: Type.String(),
	goal: Type.String(),
	requirements: Type.Array(Type.String()),
	nonGoals: Type.Array(Type.String()),
	constraints: Type.Array(Type.String()),
	acceptanceCriteria: Type.Array(AcceptanceCriterionSchema),
	allowedDirectories: Type.Array(Type.String()),
	allowedTools: Type.Array(Type.String()),
	allowedCommands: Type.Array(Type.String()),
	allowedNetworkDomains: Type.Array(Type.String()),
	budgets: Type.Object({
		timeoutMs: Type.Number(),
		tokenBudget: Type.Number(),
	}),
	verificationStrategy: Type.Object({
		commands: Type.Array(Type.String()),
		notes: Type.Array(Type.String()),
	}),
	status: MissionStatusSchema,
	createdAt: Type.String(),
	updatedAt: Type.String(),
	approvedAt: Type.Optional(Type.String()),
	leaseId: Type.Optional(Type.String()),
});

export const EvidenceCriterionSchema = Type.Object({
	criterionId: Type.String(),
	verificationMethod: VerificationKindSchema,
	evidenceSource: Type.String(),
	timestamp: Type.String(),
	status: CriterionStatusSchema,
	confidence: Type.Number(),
	sha256: Type.Optional(Type.String()),
	exitCode: Type.Optional(Type.Number()),
	details: Type.Optional(Type.String()),
});

export const CommandEvidenceSchema = Type.Object({
	command: Type.String(),
	cwd: Type.String(),
	startedAt: Type.String(),
	finishedAt: Type.String(),
	exitCode: Type.Number(),
	stdoutSha256: Type.String(),
	stderrSha256: Type.String(),
	stdoutPreview: Type.String(),
	stderrPreview: Type.String(),
	timedOut: Type.Boolean(),
});

export const EvidenceReportSchema = Type.Object({
	schemaVersion: Type.Literal("airis.evidence.v1"),
	missionId: Type.String(),
	contractSha256: Type.String(),
	generatedAt: Type.String(),
	status: MissionStatusSchema,
	summary: Type.String(),
	criteria: Type.Array(EvidenceCriterionSchema),
	commands: Type.Array(CommandEvidenceSchema),
	artifacts: Type.Array(
		Type.Object({
			label: Type.String(),
			path: Type.Optional(Type.String()),
			sha256: Type.String(),
		}),
	),
	priorFailures: Type.Array(Type.String()),
});

export const CapabilityLeaseSchema = Type.Object({
	schemaVersion: Type.Literal("airis.lease.v1"),
	id: Type.String(),
	missionId: Type.Optional(Type.String()),
	directories: Type.Array(Type.String()),
	commands: Type.Array(Type.String()),
	networkDomains: Type.Array(Type.String()),
	createdAt: Type.String(),
	expiresAt: Type.String(),
	revokedAt: Type.Optional(Type.String()),
});

export const FailureRecordSchema = Type.Object({
	schemaVersion: Type.Literal("airis.failure.v1"),
	fingerprint: Type.String(),
	command: Type.String(),
	cwd: Type.String(),
	workspaceSha256: Type.String(),
	exitCode: Type.Number(),
	stderrSha256: Type.String(),
	stderrPreview: Type.String(),
	attempts: Type.Number(),
	firstSeenAt: Type.String(),
	lastSeenAt: Type.String(),
	resolvedAt: Type.Optional(Type.String()),
	resolutionEvidence: Type.Optional(Type.String()),
});

export type VerificationKind = Static<typeof VerificationKindSchema>;
export type CriterionStatus = Static<typeof CriterionStatusSchema>;
export type MissionStatus = Static<typeof MissionStatusSchema>;
export type VerificationTarget = Static<typeof VerificationTargetSchema>;
export type AcceptanceCriterion = Static<typeof AcceptanceCriterionSchema>;
export type MissionContract = Static<typeof MissionContractSchema>;
export type EvidenceCriterion = Static<typeof EvidenceCriterionSchema>;
export type CommandEvidence = Static<typeof CommandEvidenceSchema>;
export type EvidenceReport = Static<typeof EvidenceReportSchema>;
export type CapabilityLease = Static<typeof CapabilityLeaseSchema>;
export type FailureRecord = Static<typeof FailureRecordSchema>;
