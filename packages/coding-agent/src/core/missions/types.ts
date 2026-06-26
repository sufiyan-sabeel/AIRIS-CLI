import { type Static, Type } from "typebox";

export const VerificationMethod = Type.Union([
	Type.Literal("test"),
	Type.Literal("typecheck"),
	Type.Literal("lint"),
	Type.Literal("build"),
	Type.Literal("command"),
	Type.Literal("file_hash"),
	Type.Literal("git_diff"),
	Type.Literal("http_response"),
	Type.Literal("screenshot"),
	Type.Literal("custom"),
]);

export type VerificationMethod = Static<typeof VerificationMethod>;

export const CriterionStatus = Type.Union([Type.Literal("pass"), Type.Literal("fail"), Type.Literal("unverified")]);

export type CriterionStatus = Static<typeof CriterionStatus>;

export const MissionStatus = Type.Union([
	Type.Literal("draft"),
	Type.Literal("approved"),
	Type.Literal("running"),
	Type.Literal("completed"),
	Type.Literal("partially_completed"),
	Type.Literal("failed"),
	Type.Literal("cancelled"),
]);

export type MissionStatus = Static<typeof MissionStatus>;

export const LeaseType = Type.Union([Type.Literal("directory"), Type.Literal("command"), Type.Literal("network")]);

export type LeaseType = Static<typeof LeaseType>;

export const LeaseStatus = Type.Union([Type.Literal("active"), Type.Literal("expired"), Type.Literal("revoked")]);

export type LeaseStatus = Static<typeof LeaseStatus>;

export const VerificationStrategy = Type.Object({
	method: VerificationMethod,
	command: Type.Optional(Type.String()),
	expectedExitCode: Type.Optional(Type.Number()),
	expectedOutput: Type.Optional(Type.String()),
	filePath: Type.Optional(Type.String()),
	expectedHash: Type.Optional(Type.String()),
	url: Type.Optional(Type.String()),
	expectedStatusCode: Type.Optional(Type.Number()),
	customScript: Type.Optional(Type.String()),
});

export type VerificationStrategy = Static<typeof VerificationStrategy>;

export const AcceptanceCriterion = Type.Object({
	id: Type.String(),
	description: Type.String(),
	verification: VerificationStrategy,
	mandatory: Type.Optional(Type.Boolean({ default: true })),
});

export type AcceptanceCriterion = Static<typeof AcceptanceCriterion>;

export const CapabilityLease = Type.Object({
	id: Type.String(),
	type: LeaseType,
	scope: Type.String(),
	allowedValues: Type.Array(Type.String()),
	expiresAt: Type.String(),
	status: LeaseStatus,
	createdAt: Type.String(),
});

export type CapabilityLease = Static<typeof CapabilityLease>;

export const MissionContract = Type.Object({
	id: Type.String(),
	goal: Type.String(),
	requirements: Type.Array(Type.String()),
	nonGoals: Type.Optional(Type.Array(Type.String())),
	constraints: Type.Optional(Type.Array(Type.String())),
	acceptanceCriteria: Type.Array(AcceptanceCriterion),
	allowedDirectories: Type.Array(Type.String()),
	allowedTools: Type.Array(Type.String()),
	allowedCommands: Type.Array(Type.String()),
	allowedNetworkDomains: Type.Optional(Type.Array(Type.String())),
	timeBudgetMs: Type.Optional(Type.Number()),
	tokenBudget: Type.Optional(Type.Number()),
	verificationStrategy: Type.Array(VerificationStrategy),
	createdAt: Type.String(),
	updatedAt: Type.String(),
	approvedAt: Type.Optional(Type.String()),
	approvedBy: Type.Optional(Type.String()),
	status: MissionStatus,
});

export type MissionContract = Static<typeof MissionContract>;

export const EvidenceRecord = Type.Object({
	criterionId: Type.String(),
	verificationMethod: VerificationMethod,
	evidenceSource: Type.String(),
	timestamp: Type.String(),
	status: CriterionStatus,
	confidenceScore: Type.Number({ minimum: 0, maximum: 1 }),
	details: Type.Optional(Type.String()),
	artifactHash: Type.Optional(Type.String()),
});

export type EvidenceRecord = Static<typeof EvidenceRecord>;

export const EvidenceReport = Type.Object({
	missionId: Type.String(),
	records: Type.Array(EvidenceRecord),
	overallStatus: CriterionStatus,
	generatedAt: Type.String(),
});

export type EvidenceReport = Static<typeof EvidenceReport>;

export const FailureRecord = Type.Object({
	id: Type.String(),
	errorFingerprint: Type.String(),
	errorMessage: Type.String(),
	context: Type.Optional(Type.String()),
	attemptedFixes: Type.Array(
		Type.Object({
			description: Type.String(),
			success: Type.Boolean(),
			timestamp: Type.String(),
		}),
	),
	verifiedResolution: Type.Optional(Type.String()),
	createdAt: Type.String(),
	updatedAt: Type.String(),
});

export type FailureRecord = Static<typeof FailureRecord>;

export const MissionState = Type.Object({
	contract: MissionContract,
	evidenceReport: Type.Optional(EvidenceReport),
	leases: Type.Array(CapabilityLease),
	currentCriterionIndex: Type.Optional(Type.Number()),
	startedAt: Type.Optional(Type.String()),
	completedAt: Type.Optional(Type.String()),
});

export type MissionState = Static<typeof MissionState>;
