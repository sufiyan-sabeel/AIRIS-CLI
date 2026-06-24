import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AcceptanceCriterion, MissionContract } from "./types.ts";
import { createMissionId, nowIso } from "./storage.ts";

const DEFAULT_CONSTRAINTS = [
	"Preserve AIRIS branding, providers, sessions, extensions, skills and Termux support.",
	"Do not expose API keys, tokens or secrets in logs or evidence files.",
	"Do not silently expand scope after approval; create a new mission or require explicit approval for scope changes.",
	"Block destructive commands unless explicitly approved by a capability lease.",
];

const DEFAULT_NON_GOALS = [
	"Do not replace the existing AIRIS-CLI project.",
	"Do not refactor unrelated modules.",
	"Do not claim completion without evidence for every mandatory acceptance criterion.",
];

export interface CompileMissionOptions {
	cwd: string;
	request: string;
	timeoutMs?: number;
	tokenBudget?: number;
}

export function compileMissionContract(options: CompileMissionOptions): MissionContract {
	const cwd = resolve(options.cwd);
	const now = nowIso();
	const verificationCommands = discoverVerificationCommands(cwd);
	const acceptanceCriteria = buildAcceptanceCriteria(verificationCommands);
	const request = options.request.trim();

	return {
		schemaVersion: "airis.mission.v1",
		id: createMissionId(),
		request,
		goal: request,
		requirements: extractRequirements(request),
		nonGoals: DEFAULT_NON_GOALS,
		constraints: DEFAULT_CONSTRAINTS,
		acceptanceCriteria,
		allowedDirectories: [cwd],
		allowedTools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
		allowedCommands: verificationCommands,
		allowedNetworkDomains: ["github.com", "registry.npmjs.org"],
		budgets: {
			timeoutMs: options.timeoutMs ?? 10 * 60 * 1000,
			tokenBudget: options.tokenBudget ?? 120_000,
		},
		verificationStrategy: {
			commands: verificationCommands,
			notes: [
				"Each command must run under an active capability lease.",
				"Mandatory criteria that fail or remain unverified force a partially_completed or failed mission status.",
				"Manual semantic review is intentionally unverified until a human confirms the requested behavior.",
			],
		},
		status: "draft",
		createdAt: now,
		updatedAt: now,
	};
}

function extractRequirements(request: string): string[] {
	const parts = request
		.split(/[\n.;]+/)
		.map((part) => part.trim())
		.filter(Boolean);
	return parts.length > 0 ? parts : [request];
}

function discoverVerificationCommands(cwd: string): string[] {
	const packageJsonPath = join(cwd, "package.json");
	const commands: string[] = [];
	if (existsSync(packageJsonPath)) {
		try {
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { scripts?: Record<string, string> };
			const scripts = packageJson.scripts ?? {};
			for (const scriptName of ["check:ts-imports", "check:shrinkwrap", "build", "test"]) {
				if (scripts[scriptName]) {
					commands.push(`npm run ${scriptName}`);
				}
			}
		} catch {
			// Ignore malformed package.json here. Verification will report command failures if needed.
		}
	}
	commands.push("git status --short");
	commands.push("git diff --stat");
	return Array.from(new Set(commands));
}

function buildAcceptanceCriteria(commands: string[]): AcceptanceCriterion[] {
	const criteria: AcceptanceCriterion[] = [
		{
			id: "AC-001",
			description: "A mission contract exists and remains immutable in scope after approval.",
			mandatory: true,
			verification: { type: "file_hash", path: "mission-contract" },
		},
	];

	let index = 2;
	for (const command of commands) {
		criteria.push({
			id: `AC-${String(index).padStart(3, "0")}`,
			description: `Verification command succeeds: ${command}`,
			mandatory: command !== "git status --short" && command !== "git diff --stat",
			verification: { type: "command", command },
		});
		index++;
	}

	criteria.push({
		id: `AC-${String(index).padStart(3, "0")}`,
		description: "Human review confirms the implemented behavior satisfies the requested goal.",
		mandatory: true,
		verification: { type: "manual", description: "Manual semantic acceptance by the user." },
	});
	return criteria;
}
