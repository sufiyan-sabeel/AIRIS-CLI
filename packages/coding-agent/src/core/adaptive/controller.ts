import type { AgentMessage } from "@sufiyan-sabeel/airis-agent-core";
import type { Model } from "@sufiyan-sabeel/airis-ai";
import { Text } from "@sufiyan-sabeel/airis-tui";
import { type Static, Type } from "typebox";
import { estimateContextTokens, shouldCompact } from "../compaction/index.ts";
import type { ToolDefinition } from "../extensions/types.ts";
import type { SessionManager } from "../session-manager.ts";
import { ExploreTaskRunner, formatExploreResultForContext } from "./explore-task.ts";
import {
	type DebugSession,
	type ErrorAnalysis,
	type ErrorContext,
	SelfDebugBrain,
	type SelfDebugInput,
	selfDebugSchema,
} from "./self-debug.ts";
import { AdaptiveTodoStore } from "./todo-store.ts";
import type {
	AdaptiveAssessment,
	AdaptiveProgress,
	AdaptiveTodoSnapshot,
	AdaptiveTodoStatus,
	AdaptiveToolObservation,
	CompactionMetrics,
	ExploreTaskResult,
} from "./types.ts";

const adaptiveTodoSchema = Type.Object({
	action: Type.Union([
		Type.Literal("list"),
		Type.Literal("plan"),
		Type.Literal("status"),
		Type.Literal("evidence"),
		Type.Literal("block"),
	]),
	goal: Type.Optional(Type.String({ description: "Goal for a new or revised plan" })),
	items: Type.Optional(
		Type.Array(Type.String({ minLength: 1 }), { description: "Task descriptions for action=plan" }),
	),
	id: Type.Optional(Type.String({ description: "Task ID for status/evidence/block" })),
	status: Type.Optional(
		Type.Union([
			Type.Literal("pending"),
			Type.Literal("in_progress"),
			Type.Literal("completed"),
			Type.Literal("blocked"),
			Type.Literal("cancelled"),
		]),
	),
	evidence: Type.Optional(Type.String({ description: "Evidence required when completing a task" })),
	failureReason: Type.Optional(Type.String({ description: "Reason for block/failure" })),
	priority: Type.Optional(
		Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high"), Type.Literal("critical")]),
	),
});

type AdaptiveTodoToolInput = Static<typeof adaptiveTodoSchema>;

export interface AdaptiveBrainOptions {
	contextWindow?: number;
	compactionThresholdRatio?: number;
	exploreLimits?: ConstructorParameters<typeof ExploreTaskRunner>[1];
}

export interface AdaptiveTurnPreparation {
	assessment: AdaptiveAssessment;
	customMessages: AgentMessage[];
	activeToolNames: string[];
	exploreResult?: ExploreTaskResult;
	progress: AdaptiveProgress;
}

const CODE_TASK_RE =
	/\b(implement|fix|refactor|modify|update|add|remove|debug|test|build|compile|failing|failure|bug|feature|code|file|repo|repository|package|function|class|component|api|cli|tui)\b/i;
const MULTI_STEP_RE =
	/\b(plan|steps|first|then|after|before|multiple|several|across|end-to-end|architecture|integration|workflow)\b/i;
const RISK_RE =
	/\b(delete|remove|drop|reset|overwrite|migration|credential|secret|token|permission|production|payment|security|destructive|force|chmod|chown|sudo|rm\s+-rf)\b/i;
const VERIFY_RE = /\b(test|tests|verify|verification|build|compile|typecheck|lint|acceptance|ci|failing)\b/i;

function extractAffectedFileHints(text: string): number {
	const matches = text.match(
		/[\w./-]+\.(?:ts|tsx|js|jsx|json|md|py|rs|go|java|kt|kts|swift|rb|php|cs|cpp|c|h|hpp|yaml|yml|toml)/g,
	);
	return new Set(matches ?? []).size;
}

function splitGoalIntoTasks(text: string, assessment: AdaptiveAssessment): string[] {
	const tasks = ["Inspect relevant code and current repository state"];
	if (assessment.shouldExplore) tasks.push("Map architecture and identify implementation locations");
	if (assessment.shouldUseGeneralExecutor)
		tasks.push("Make focused implementation changes following existing patterns");
	if (assessment.verificationRequired) tasks.push("Run appropriate verification and record evidence");
	if (!assessment.verificationRequired && assessment.shouldUseGeneralExecutor)
		tasks.push("Review changes and summarize evidence");
	return tasks.length >= 2 ? tasks : [`Complete request: ${text.slice(0, 120)}`];
}

function makeCustomMessage(content: string): AgentMessage {
	return {
		role: "custom",
		customType: "adaptive-brain-context",
		content,
		display: false,
		timestamp: Date.now(),
	};
}

export class AdaptiveBrainController {
	readonly todos: AdaptiveTodoStore;
	readonly selfDebug: SelfDebugBrain;
	private readonly sessionManager: SessionManager;
	private readonly cwd: string;
	private readonly options: AdaptiveBrainOptions;
	private lastExploreAt = 0;
	private lastCompactionAt = 0;
	private lastProgress: AdaptiveProgress = { phase: "idle", summary: "Adaptive brain idle" };

	constructor(sessionManager: SessionManager, cwd: string, options: AdaptiveBrainOptions = {}) {
		this.sessionManager = sessionManager;
		this.cwd = cwd;
		this.options = options;
		this.todos = new AdaptiveTodoStore(sessionManager);
		this.selfDebug = new SelfDebugBrain();
	}

	assessRequest(text: string, messages: AgentMessage[], model?: Model<any>): AdaptiveAssessment {
		const affectedFiles = extractAffectedFileHints(text);
		const words = text.trim().split(/\s+/).filter(Boolean).length;
		const isCodeTask = CODE_TASK_RE.test(text);
		const isMultiStep = MULTI_STEP_RE.test(text) || words > 40;
		const risk = RISK_RE.test(text)
			? "high"
			: affectedFiles > 2 || /migration|auth|security/i.test(text)
				? "medium"
				: "low";
		const uncertainty =
			isCodeTask && !/\b(specific|exact|only|just)\b/i.test(text)
				? affectedFiles === 0
					? "high"
					: "medium"
				: "low";
		const verificationRequired = VERIFY_RE.test(text) || isCodeTask;
		const existingOpenTasks = this.todos.getOpenItems().length;
		const contextEstimate = estimateContextTokens(messages).tokens;
		const contextWindow = this.options.contextWindow ?? model?.contextWindow ?? 0;
		const threshold = this.options.compactionThresholdRatio ?? 0.72;
		const shouldCompactContext =
			contextWindow > 0 &&
			shouldCompact(contextEstimate, contextWindow, {
				enabled: true,
				reserveTokens: Math.floor(contextWindow * (1 - threshold)),
				keepRecentTokens: Math.min(20_000, Math.floor(contextWindow * 0.25)),
			});
		const complexity: AdaptiveAssessment["complexity"] =
			!isCodeTask && words <= 18 && affectedFiles === 0
				? "trivial"
				: isMultiStep || affectedFiles > 1 || existingOpenTasks > 0
					? affectedFiles > 3 || risk === "high" || words > 90
						? "complex"
						: "moderate"
					: "simple";
		const requiredTools = isCodeTask ? ["read", "bash", "edit", "write", "adaptive_todo"] : [];
		const shouldCreateTodoPlan = complexity === "moderate" || complexity === "complex" || existingOpenTasks > 0;
		const shouldExplore =
			isCodeTask && (uncertainty !== "low" || complexity === "complex") && Date.now() - this.lastExploreAt > 2_000;
		const shouldRequestClarification =
			risk === "high" &&
			/\b(delete|payment|credential|secret|production)\b/i.test(text) &&
			!/\b(confirm|approved|permission|yes)\b/i.test(text);
		const assessment: AdaptiveAssessment = {
			complexity,
			affectedFiles,
			uncertainty,
			risk,
			requiredTools,
			availableContextTokens: contextWindow > 0 ? Math.max(0, contextWindow - contextEstimate) : 0,
			existingOpenTasks,
			verificationRequired,
			shouldAnswerDirectly: complexity === "trivial" && existingOpenTasks === 0,
			shouldCreateTodoPlan,
			shouldExplore,
			shouldUseGeneralExecutor: isCodeTask && !shouldRequestClarification,
			shouldCompact: shouldCompactContext && Date.now() - this.lastCompactionAt > 10_000,
			shouldRequestClarification,
			reasons: [],
		};
		if (isCodeTask) assessment.reasons.push("coding task detected");
		if (isMultiStep) assessment.reasons.push("multi-step wording detected");
		if (affectedFiles > 0) assessment.reasons.push(`${affectedFiles} file hint(s) detected`);
		if (risk !== "low") assessment.reasons.push(`${risk} risk`);
		if (shouldCompactContext) assessment.reasons.push("context compaction threshold reached");
		return assessment;
	}

	async prepareTurn(text: string, messages: AgentMessage[], model?: Model<any>): Promise<AdaptiveTurnPreparation> {
		const assessment = this.assessRequest(text, messages, model);
		const customMessages: AgentMessage[] = [];
		const activeToolNames = assessment.requiredTools;
		let exploreResult: ExploreTaskResult | undefined;

		if (assessment.shouldAnswerDirectly) {
			this.lastProgress = { phase: "idle", summary: "Direct answer; no adaptive plan needed" };
			return { assessment, customMessages, activeToolNames, progress: this.lastProgress };
		}

		if (assessment.shouldCreateTodoPlan) {
			const snapshot = this.todos.ensurePlan(text, splitGoalIntoTasks(text, assessment));
			this.lastProgress = {
				phase: "planning",
				summary: `Adaptive plan: ${snapshot.items.filter((item) => item.status !== "completed").length} open task(s)`,
				todos: snapshot.items,
			};
		}

		if (assessment.shouldExplore) {
			this.lastProgress = {
				phase: "exploring",
				summary: "Running read-only Explore Task",
				todos: this.todos.getSnapshot().items,
			};
			const runner = new ExploreTaskRunner(this.cwd, this.options.exploreLimits);
			exploreResult = await runner.run(text);
			this.lastExploreAt = Date.now();
			customMessages.push(makeCustomMessage(formatExploreResultForContext(exploreResult)));
		}

		const instructions = [
			"Adaptive Agent Brain runtime context:",
			`Assessment: complexity=${assessment.complexity}, risk=${assessment.risk}, uncertainty=${assessment.uncertainty}, verificationRequired=${assessment.verificationRequired}`,
			this.todos.formatForContext(),
			assessment.shouldUseGeneralExecutor
				? "General executor: read before editing, make focused changes only, respect permissions/leases, do not silently expand scope, run verification when appropriate, and return control if blocked or uncertain."
				: "No coding executor required unless the user request truly needs it.",
			"Use adaptive_todo for substantial plan changes and never complete a TODO without concrete evidence.",
			"Use ask_question only when missing information, ambiguity, or risky decisions materially affect the task; include a recommended option unless the decision is destructive/security-sensitive, which must not be auto-chosen.",
		];
		if (assessment.shouldRequestClarification) {
			instructions.push("Risk gate: request clarification or permission before risky/destructive work.");
		}
		customMessages.push(makeCustomMessage(instructions.join("\n")));
		if (this.lastProgress.phase !== "exploring") {
			this.lastProgress = {
				phase: assessment.shouldUseGeneralExecutor ? "executing" : "assessing",
				summary: assessment.shouldUseGeneralExecutor ? "General executor prepared" : "Adaptive assessment prepared",
				todos: this.todos.getSnapshot().items,
			};
		}
		return { assessment, customMessages, activeToolNames, exploreResult, progress: this.lastProgress };
	}

	observeToolExecution(observation: AdaptiveToolObservation): AdaptiveTodoSnapshot {
		if (observation.toolName === "adaptive_todo" || observation.toolName === "self_debug")
			return this.todos.getSnapshot();
		if (observation.isError) {
			// Trigger self-debug analysis for errors
			const errorContext: ErrorContext = {
				toolName: observation.toolName,
				toolCallId: "",
				args: observation.args,
				errorMessage: observation.result.content.map((c) => (c.type === "text" ? c.text : "")).join(" "),
				timestamp: Date.now(),
				cwd: this.cwd,
			};
			this.selfDebug.analyzeError(errorContext);

			const command =
				typeof observation.args === "object" && observation.args && "command" in observation.args
					? String((observation.args as { command?: unknown }).command ?? "")
					: "";
			if (/\b(test|vitest|jest|build|compile|typecheck|lint|check)\b/i.test(command)) {
				const target = this.todos.getBlockableInProgress() ?? this.todos.getInProgress();
				if (target) {
					return this.todos.updateStatus(target.id, "blocked", {
						failureReason: `Verification failed: ${command}`,
					})
						? this.todos.getSnapshot()
						: this.todos.blockCurrent(`Verification failed: ${command}`);
				}
				return this.todos.blockCurrent(`Verification failed: ${command}`);
			}
			return this.todos.getSnapshot();
		}
		if (observation.toolName === "bash") {
			const command =
				typeof observation.args === "object" && observation.args && "command" in observation.args
					? String((observation.args as { command?: unknown }).command ?? "")
					: "";
			if (/\b(test|vitest|jest|build|compile|typecheck|lint|check)\b/i.test(command)) {
				return this.todos.advanceAfterEvidence(`Verification succeeded: ${command}`);
			}
		}
		if (observation.toolName === "edit" || observation.toolName === "write") {
			const current = this.todos.getInProgress();
			if (current) this.todos.recordEvidence(current.id, `${observation.toolName} completed`);
		}
		return this.todos.getSnapshot();
	}

	buildCompactionInstructions(originalGoal?: string): string {
		const snapshot = this.todos.getSnapshot();
		const messages = [
			"Preserve Adaptive Agent Brain state in the compaction summary.",
			originalGoal ? `Original user goal: ${originalGoal}` : undefined,
			"Keep mandatory constraints, approved mission/permission/lease state, decisions, rejected alternatives, files changed, commands and important results, failures, verification evidence, and remaining work.",
			this.todos.formatForContext(),
			`Open tasks: ${
				snapshot.items
					.filter((item) => item.status !== "completed" && item.status !== "cancelled")
					.map((item) => `${item.id}:${item.status}:${item.description}`)
					.join(" | ") || "none"
			}`,
		].filter(Boolean);
		return messages.join("\n");
	}

	validateCompactionSummary(summary: string): boolean {
		if (summary.trim().length < 40) return false;
		const open = this.todos.getOpenItems();
		if (open.length === 0) return true;
		const lower = summary.toLowerCase();
		return open.some(
			(item) => lower.includes(item.description.slice(0, 24).toLowerCase()) || lower.includes(item.id.toLowerCase()),
		);
	}

	recordCompactionMetrics(metrics: CompactionMetrics): void {
		this.lastCompactionAt = Date.now();
		this.sessionManager.appendCustomEntry("adaptive.compaction.metrics", metrics);
	}

	getLastProgress(): AdaptiveProgress {
		return {
			...this.lastProgress,
			todos: this.lastProgress.todos?.map((item) => ({
				...item,
				dependencies: [...item.dependencies],
				completionEvidence: [...item.completionEvidence],
			})),
		};
	}

	/**
	 * Create a debug session for an error and return analysis context.
	 */
	startDebugSession(context: ErrorContext): { analysis: ErrorAnalysis; debugContext: string; session: DebugSession } {
		const analysis = this.selfDebug.analyzeError(context);
		const session = this.selfDebug.createDebugSession(context, analysis);
		const debugContext = this.selfDebug.formatDebugContext(analysis, session);
		return { analysis, debugContext, session };
	}

	/**
	 * Get self-debug instructions for injection into agent context when errors occur.
	 */
	getSelfDebugInstructions(analysis: ErrorAnalysis): string {
		return this.selfDebug.getDebugInstructions(analysis);
	}

	createTodoToolDefinition(): ToolDefinition<typeof adaptiveTodoSchema, AdaptiveTodoSnapshot> {
		const todos = this.todos;
		return {
			name: "adaptive_todo",
			label: "adaptive TODO",
			description:
				"Internal adaptive planning tool. Maintain session TODOs for substantial multi-step work; do not use for trivial answers.",
			promptSnippet: "Maintain adaptive TODO state for non-trivial work",
			promptGuidelines: [
				"Use adaptive_todo for substantial multi-step work and keep at most one task in_progress.",
				"Never mark adaptive TODOs completed without concrete evidence.",
				"If verification fails, block the relevant TODO instead of reporting completion.",
			],
			parameters: adaptiveTodoSchema,
			async execute(_toolCallId, params: AdaptiveTodoToolInput) {
				let snapshot: AdaptiveTodoSnapshot;
				switch (params.action) {
					case "plan":
						snapshot = todos.replacePlan(
							params.goal ?? todos.getSnapshot().goal ?? "Current task",
							params.items ?? [],
						);
						break;
					case "status": {
						if (!params.id || !params.status)
							throw new Error("id and status are required for adaptive_todo status");
						todos.updateStatus(params.id, params.status as AdaptiveTodoStatus, {
							evidence: params.evidence,
							failureReason: params.failureReason,
						});
						snapshot = todos.getSnapshot();
						break;
					}
					case "evidence":
						if (!params.id || !params.evidence)
							throw new Error("id and evidence are required for adaptive_todo evidence");
						todos.recordEvidence(params.id, params.evidence);
						snapshot = todos.getSnapshot();
						break;
					case "block":
						if (params.id) {
							todos.updateStatus(params.id, "blocked", { failureReason: params.failureReason ?? "Blocked" });
							snapshot = todos.getSnapshot();
						} else {
							snapshot = todos.blockCurrent(params.failureReason ?? "Blocked");
						}
						break;
					default:
						snapshot = todos.getSnapshot();
				}
				return { content: [{ type: "text", text: todos.formatForContext() }], details: snapshot };
			},
			renderCall(args, theme) {
				const text = new Text("", 0, 0);
				const action = theme.fg("toolTitle", theme.bold(`adaptive_todo ${args.action}`));
				text.setText(args.id ? `${action} ${theme.fg("accent", args.id)}` : action);
				return text;
			},
			renderResult(result, _options, theme) {
				const text = new Text("", 0, 0);
				const snapshot = result.details;
				const open = snapshot.items.filter(
					(item) => item.status !== "completed" && item.status !== "cancelled",
				).length;
				text.setText(theme.fg("muted", `adaptive TODO: ${open} open`));
				return text;
			},
		};
	}

	createSelfDebugToolDefinition(): ToolDefinition<typeof selfDebugSchema, unknown> {
		const selfDebugBrain = this.selfDebug;
		const controller = this;
		return {
			name: "self_debug",
			label: "self-debug",
			description:
				"Self-debugging tool for error analysis and recovery. Use when errors occur to analyze root causes and apply fixes.",
			promptSnippet: "Analyze and fix errors using self-debugging capabilities",
			promptGuidelines: [
				"Use self_debug when you encounter errors to get analysis and suggested fixes.",
				"For action=analyze, provide the error message and tool name to get root cause analysis.",
				"For action=fix, provide the session ID and fix action to apply a suggested fix.",
				"For action=status, check the status of an ongoing debug session.",
				"For action=stats, get statistics about errors in this session.",
			],
			parameters: selfDebugSchema,
			async execute(_toolCallId, params: SelfDebugInput, _signal, _onUpdate, _ctx) {
				switch (params.action) {
					case "analyze": {
						if (!params.errorMessage) {
							throw new Error("errorMessage is required for action=analyze");
						}
						const context: ErrorContext = {
							toolName: params.toolName ?? "unknown",
							toolCallId: _toolCallId,
							args: params.toolArgs ?? {},
							errorMessage: params.errorMessage,
							timestamp: Date.now(),
							cwd: controller.cwd,
						};
						const { analysis, debugContext, session } = controller.startDebugSession(context);
						return {
							content: [{ type: "text", text: debugContext }],
							details: { analysis, sessionId: session.id },
						};
					}
					case "fix": {
						if (!params.sessionId || !params.fixAction) {
							throw new Error("sessionId and fixAction are required for action=fix");
						}
						const session = selfDebugBrain.getSession(params.sessionId);
						if (!session) {
							throw new Error(`Debug session ${params.sessionId} not found`);
						}
						// Record the attempt (actual execution happens outside this tool)
						selfDebugBrain.recordAttempt(params.sessionId, params.fixAction, "success", "Fix applied");
						return {
							content: [
								{
									type: "text",
									text: `Fix recorded for session ${params.sessionId}. Apply the fix using appropriate tools.`,
								},
							],
							details: { sessionId: params.sessionId, status: "recorded" },
						};
					}
					case "status": {
						if (!params.sessionId) {
							throw new Error("sessionId is required for action=status");
						}
						const session = selfDebugBrain.getSession(params.sessionId);
						if (!session) {
							throw new Error(`Debug session ${params.sessionId} not found`);
						}
						const statusContext = selfDebugBrain.formatDebugContext(session.analysis, session);
						return {
							content: [{ type: "text", text: statusContext }],
							details: { session },
						};
					}
					case "stats": {
						const stats = selfDebugBrain.getStats();
						return {
							content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
							details: stats,
						};
					}
				}
			},
			renderCall(args, theme) {
				const text = new Text("", 0, 0);
				const action = theme.fg("toolTitle", theme.bold(`self_debug ${args.action}`));
				text.setText(args.sessionId ? `${action} ${theme.fg("accent", args.sessionId)}` : action);
				return text;
			},
			renderResult(result, _options, theme) {
				const text = new Text("", 0, 0);
				const details = result.details as { status?: string } | undefined;
				text.setText(theme.fg("muted", `self-debug: ${details?.status ?? "done"}`));
				return text;
			},
		};
	}
}
