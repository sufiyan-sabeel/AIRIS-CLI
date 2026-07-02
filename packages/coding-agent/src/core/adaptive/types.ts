import type { AgentToolResult } from "@sufiyan-sabeel/airis-agent-core";

export type AdaptiveTodoStatus = "pending" | "in_progress" | "completed" | "blocked" | "cancelled";
export type AdaptiveTodoPriority = "low" | "medium" | "high" | "critical";

export interface AdaptiveTodoItem {
	id: string;
	description: string;
	status: AdaptiveTodoStatus;
	dependencies: string[];
	priority: AdaptiveTodoPriority;
	completionEvidence: string[];
	failureReason?: string;
	createdAt: string;
	updatedAt: string;
	startedAt?: string;
	completedAt?: string;
}

export interface AdaptiveTodoSnapshot {
	version: 1;
	goal?: string;
	items: AdaptiveTodoItem[];
	updatedAt: string;
}

export interface AdaptiveAssessment {
	complexity: "trivial" | "simple" | "moderate" | "complex";
	affectedFiles: number;
	uncertainty: "low" | "medium" | "high";
	risk: "low" | "medium" | "high";
	requiredTools: string[];
	availableContextTokens: number;
	existingOpenTasks: number;
	verificationRequired: boolean;
	shouldAnswerDirectly: boolean;
	shouldCreateTodoPlan: boolean;
	shouldExplore: boolean;
	shouldUseGeneralExecutor: boolean;
	shouldCompact: boolean;
	shouldRequestClarification: boolean;
	reasons: string[];
}

export interface ExploreFinding {
	path: string;
	symbols?: string[];
	reason: string;
}

export interface ExploreTaskResult {
	summary: string;
	relevantFilesAndSymbols: ExploreFinding[];
	architectureFindings: string[];
	risks: string[];
	recommendedImplementationLocation: string[];
	unknownsRequiringClarification: string[];
	metrics: {
		runtimeMs: number;
		toolCalls: number;
		filesRead: number;
		truncated: boolean;
	};
}

export interface ExploreLimits {
	maxRuntimeMs: number;
	maxToolCalls: number;
	maxFiles: number;
	maxDepth: number;
	maxParallel: number;
}

export interface AdaptiveProgress {
	phase: "assessing" | "planning" | "exploring" | "executing" | "compacting" | "verifying" | "blocked" | "idle";
	summary: string;
	todos?: AdaptiveTodoItem[];
}

export interface AdaptiveTodoStats {
	totalTasks: number;
	completedTasks: number;
	inProgressTasks: number;
	pendingTasks: number;
	blockedTasks: number;
	cancelledTasks: number;
	completionRate: number;
	avgCompletionTimeMs: number;
	totalElapsedMs: number;
	byPriority: Record<AdaptiveTodoPriority, number>;
	byCategory: Record<string, number>;
}

export interface AdaptiveToolObservation {
	toolName: string;
	args: unknown;
	result: AgentToolResult<unknown>;
	isError: boolean;
}

export interface CompactionMetrics {
	reason: "manual" | "threshold" | "overflow" | "adaptive";
	tokensBefore: number;
	summaryLength: number;
	openTodos: number;
	createdAt: string;
}
