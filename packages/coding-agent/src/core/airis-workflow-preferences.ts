import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "../config.ts";

export type AirisApprovalMode = "manual" | "on-request" | "trusted-workspace" | "never";
export type AirisTaskMode = "plan" | "act" | "plan-then-act";
export type AirisThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type AirisUnknownToolPolicy = "ask" | "deny";

const AIRIS_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export interface AirisToolExecutionPreferences {
	approvalMode: AirisApprovalMode;
	unknownToolPolicy: AirisUnknownToolPolicy;
	allowReadOnlyWithoutApproval: boolean;
	allowNetworkWithoutApproval: boolean;
	allowPackageInstallWithoutApproval: boolean;
	allowedCommands: string[];
	blockedCommands: string[];
	protectedPaths: string[];
}

export interface AirisFileEditingPreferences {
	requireReadBeforeEdit: boolean;
	preferPatchEdits: boolean;
	allowOverwrite: boolean;
	createBackupsForLargeEdits: boolean;
	maxFilesPerEditBatch: number;
}

export interface AirisTaskPlanningPreferences {
	defaultMode: AirisTaskMode;
	requirePlanForMultiFileChanges: boolean;
	requirePlanForDestructiveCommands: boolean;
	keepTodoListForComplexTasks: boolean;
	taskSizeThresholdFiles: number;
}

export interface AirisModelProfile {
	provider?: string;
	model?: string;
	thinkingLevel?: AirisThinkingLevel;
}

export interface AirisModelPreferences {
	default?: AirisModelProfile;
	planning?: AirisModelProfile;
	acting?: AirisModelProfile;
	useSeparatePlanAndActModels: boolean;
}

export interface AirisWorkspacePreferences {
	rulesFiles: string[];
	respectAgentsMd: boolean;
	preferProjectRulesOverGlobalRules: boolean;
	loadRulesOnlyWhenProjectTrusted: boolean;
}

export interface AirisMemoryPreferences {
	enabled: boolean;
	directory: string;
	readAtTaskStart: boolean;
	updateAfterMilestones: boolean;
	files: string[];
}

export interface AirisWorkflowPreferences {
	projectTrust: {
		defaultProjectTrust: "ask" | "always" | "never";
		requireTrustForProjectResources: boolean;
	};
	tools: AirisToolExecutionPreferences;
	editing: AirisFileEditingPreferences;
	planning: AirisTaskPlanningPreferences;
	models: AirisModelPreferences;
	workspace: AirisWorkspacePreferences;
	memory: AirisMemoryPreferences;
}

const DEFAULT_AIRIS_WORKFLOW_PREFERENCES: AirisWorkflowPreferences = {
	projectTrust: {
		defaultProjectTrust: "ask",
		requireTrustForProjectResources: true,
	},
	tools: {
		approvalMode: "on-request",
		unknownToolPolicy: "ask",
		allowReadOnlyWithoutApproval: true,
		allowNetworkWithoutApproval: false,
		allowPackageInstallWithoutApproval: false,
		allowedCommands: [],
		blockedCommands: ["rm -rf /", "git reset --hard", "git clean -fd", "chmod -R 777", "curl * | sh", "wget * | sh"],
		protectedPaths: [".git/", "node_modules/", "package-lock.json", "npm-shrinkwrap.json"],
	},
	editing: {
		requireReadBeforeEdit: true,
		preferPatchEdits: true,
		allowOverwrite: false,
		createBackupsForLargeEdits: false,
		maxFilesPerEditBatch: 8,
	},
	planning: {
		defaultMode: "plan-then-act",
		requirePlanForMultiFileChanges: true,
		requirePlanForDestructiveCommands: true,
		keepTodoListForComplexTasks: true,
		taskSizeThresholdFiles: 3,
	},
	models: {
		useSeparatePlanAndActModels: false,
	},
	workspace: {
		rulesFiles: ["AGENTS.md", ".airis/rules"],
		respectAgentsMd: true,
		preferProjectRulesOverGlobalRules: true,
		loadRulesOnlyWhenProjectTrusted: true,
	},
	memory: {
		enabled: false,
		directory: ".airis/memory",
		readAtTaskStart: true,
		updateAfterMilestones: true,
		files: [
			"project-brief.md",
			"product-context.md",
			"active-context.md",
			"system-patterns.md",
			"tech-context.md",
			"progress.md",
		],
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, fallback: string[]): string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : fallback;
}

function boolValue(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function mergeModelProfile(base: AirisModelProfile | undefined, override: unknown): AirisModelProfile | undefined {
	if (!isRecord(override)) return base ? { ...base } : undefined;
	return {
		provider: typeof override.provider === "string" ? override.provider : base?.provider,
		model: typeof override.model === "string" ? override.model : base?.model,
		thinkingLevel: enumValue(override.thinkingLevel, AIRIS_THINKING_LEVELS, base?.thinkingLevel ?? "off"),
	};
}

export function mergeAirisWorkflowPreferences(
	base: AirisWorkflowPreferences,
	override: unknown,
): AirisWorkflowPreferences {
	if (!isRecord(override)) return structuredClone(base);

	const projectTrust = isRecord(override.projectTrust) ? override.projectTrust : {};
	const tools = isRecord(override.tools) ? override.tools : {};
	const editing = isRecord(override.editing) ? override.editing : {};
	const planning = isRecord(override.planning) ? override.planning : {};
	const models = isRecord(override.models) ? override.models : {};
	const workspace = isRecord(override.workspace) ? override.workspace : {};
	const memory = isRecord(override.memory) ? override.memory : {};

	return {
		projectTrust: {
			defaultProjectTrust: enumValue(
				projectTrust.defaultProjectTrust,
				["ask", "always", "never"],
				base.projectTrust.defaultProjectTrust,
			),
			requireTrustForProjectResources: boolValue(
				projectTrust.requireTrustForProjectResources,
				base.projectTrust.requireTrustForProjectResources,
			),
		},
		tools: {
			approvalMode: enumValue(
				tools.approvalMode,
				["manual", "on-request", "trusted-workspace", "never"],
				base.tools.approvalMode,
			),
			unknownToolPolicy: enumValue(tools.unknownToolPolicy, ["ask", "deny"], base.tools.unknownToolPolicy),
			allowReadOnlyWithoutApproval: boolValue(
				tools.allowReadOnlyWithoutApproval,
				base.tools.allowReadOnlyWithoutApproval,
			),
			allowNetworkWithoutApproval: boolValue(
				tools.allowNetworkWithoutApproval,
				base.tools.allowNetworkWithoutApproval,
			),
			allowPackageInstallWithoutApproval: boolValue(
				tools.allowPackageInstallWithoutApproval,
				base.tools.allowPackageInstallWithoutApproval,
			),
			allowedCommands: stringArray(tools.allowedCommands, base.tools.allowedCommands),
			blockedCommands: stringArray(tools.blockedCommands, base.tools.blockedCommands),
			protectedPaths: stringArray(tools.protectedPaths, base.tools.protectedPaths),
		},
		editing: {
			requireReadBeforeEdit: boolValue(editing.requireReadBeforeEdit, base.editing.requireReadBeforeEdit),
			preferPatchEdits: boolValue(editing.preferPatchEdits, base.editing.preferPatchEdits),
			allowOverwrite: boolValue(editing.allowOverwrite, base.editing.allowOverwrite),
			createBackupsForLargeEdits: boolValue(
				editing.createBackupsForLargeEdits,
				base.editing.createBackupsForLargeEdits,
			),
			maxFilesPerEditBatch: Math.max(
				1,
				Math.floor(numberValue(editing.maxFilesPerEditBatch, base.editing.maxFilesPerEditBatch)),
			),
		},
		planning: {
			defaultMode: enumValue(planning.defaultMode, ["plan", "act", "plan-then-act"], base.planning.defaultMode),
			requirePlanForMultiFileChanges: boolValue(
				planning.requirePlanForMultiFileChanges,
				base.planning.requirePlanForMultiFileChanges,
			),
			requirePlanForDestructiveCommands: boolValue(
				planning.requirePlanForDestructiveCommands,
				base.planning.requirePlanForDestructiveCommands,
			),
			keepTodoListForComplexTasks: boolValue(
				planning.keepTodoListForComplexTasks,
				base.planning.keepTodoListForComplexTasks,
			),
			taskSizeThresholdFiles: Math.max(
				1,
				Math.floor(numberValue(planning.taskSizeThresholdFiles, base.planning.taskSizeThresholdFiles)),
			),
		},
		models: {
			default: mergeModelProfile(base.models.default, models.default),
			planning: mergeModelProfile(base.models.planning, models.planning),
			acting: mergeModelProfile(base.models.acting, models.acting),
			useSeparatePlanAndActModels: boolValue(
				models.useSeparatePlanAndActModels,
				base.models.useSeparatePlanAndActModels,
			),
		},
		workspace: {
			rulesFiles: stringArray(workspace.rulesFiles, base.workspace.rulesFiles),
			respectAgentsMd: boolValue(workspace.respectAgentsMd, base.workspace.respectAgentsMd),
			preferProjectRulesOverGlobalRules: boolValue(
				workspace.preferProjectRulesOverGlobalRules,
				base.workspace.preferProjectRulesOverGlobalRules,
			),
			loadRulesOnlyWhenProjectTrusted: boolValue(
				workspace.loadRulesOnlyWhenProjectTrusted,
				base.workspace.loadRulesOnlyWhenProjectTrusted,
			),
		},
		memory: {
			enabled: boolValue(memory.enabled, base.memory.enabled),
			directory: typeof memory.directory === "string" ? memory.directory : base.memory.directory,
			readAtTaskStart: boolValue(memory.readAtTaskStart, base.memory.readAtTaskStart),
			updateAfterMilestones: boolValue(memory.updateAfterMilestones, base.memory.updateAfterMilestones),
			files: stringArray(memory.files, base.memory.files),
		},
	};
}

function loadJsonFile(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf-8"));
}

export function getDefaultAirisWorkflowPreferences(): AirisWorkflowPreferences {
	return structuredClone(DEFAULT_AIRIS_WORKFLOW_PREFERENCES);
}

export function getAirisWorkflowPreferencePaths(cwd: string): { global: string; project: string } {
	return {
		global: join(getAgentDir(), "workflow-preferences.json"),
		project: join(cwd, CONFIG_DIR_NAME, "workflow-preferences.json"),
	};
}

export function loadAirisWorkflowPreferences(
	cwd: string,
	options: { projectTrusted?: boolean } = {},
): AirisWorkflowPreferences {
	const paths = getAirisWorkflowPreferencePaths(cwd);
	let preferences = getDefaultAirisWorkflowPreferences();
	if (existsSync(paths.global)) {
		preferences = mergeAirisWorkflowPreferences(preferences, loadJsonFile(paths.global));
	}
	if (options.projectTrusted !== false && existsSync(paths.project)) {
		preferences = mergeAirisWorkflowPreferences(preferences, loadJsonFile(paths.project));
	}
	return preferences;
}
