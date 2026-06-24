import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

export type PlanModeState = "off" | "planning" | "executing";

export interface PlanStep {
	id: number;
	description: string;
	status: "pending" | "in-progress" | "completed" | "skipped";
	files?: string[];
	notes?: string;
}

export interface Plan {
	id: string;
	goal: string;
	steps: PlanStep[];
	createdAt: string;
	updatedAt: string;
	state: PlanModeState;
}

export interface PlanManagerOptions {
	plansDir: string;
}

const PLAN_FILE = "plans.json";

function ensureDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

function getPlansPath(opts: PlanManagerOptions): string {
	return join(opts.plansDir, PLAN_FILE);
}

function loadPlans(opts: PlanManagerOptions): Plan[] {
	const path = getPlansPath(opts);
	if (!existsSync(path)) return [];
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return [];
	}
}

function savePlans(opts: PlanManagerOptions, plans: Plan[]): void {
	ensureDir(opts.plansDir);
	writeFileSync(getPlansPath(opts), JSON.stringify(plans, null, 2), "utf-8");
}

function generateId(): string {
	return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPlanManager(opts: PlanManagerOptions) {
	let plans = loadPlans(opts);

	return {
		getCurrentPlan(): Plan | undefined {
			return plans.find((p) => p.state !== "off");
		},

		getAllPlans(): Plan[] {
			return [...plans];
		},

		getPlan(id: string): Plan | undefined {
			return plans.find((p) => p.id === id);
		},

		createPlan(goal: string, stepDescriptions: string[]): Plan {
			const plan: Plan = {
				id: generateId(),
				goal,
				steps: stepDescriptions.map((desc, i) => ({
					id: i + 1,
					description: desc,
					status: "pending" as const,
				})),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				state: "planning",
			};
			plans.push(plan);
			savePlans(opts, plans);
			return plan;
		},

		updatePlanState(planId: string, state: PlanModeState): Plan | undefined {
			const plan = plans.find((p) => p.id === planId);
			if (!plan) return undefined;
			plan.state = state;
			plan.updatedAt = new Date().toISOString();
			savePlans(opts, plans);
			return plan;
		},

		updateStepStatus(
			planId: string,
			stepId: number,
			status: PlanStep["status"],
			notes?: string,
		): Plan | undefined {
			const plan = plans.find((p) => p.id === planId);
			if (!plan) return undefined;
			const step = plan.steps.find((s) => s.id === stepId);
			if (!step) return undefined;
			step.status = status;
			if (notes) step.notes = notes;
			plan.updatedAt = new Date().toISOString();
			savePlans(opts, plans);
			return plan;
		},

		addStep(planId: string, description: string, afterStepId?: number): Plan | undefined {
			const plan = plans.find((p) => p.id === planId);
			if (!plan) return undefined;
			const newStepId = plan.steps.length + 1;
			const newStep: PlanStep = {
				id: newStepId,
				description,
				status: "pending",
			};
			if (afterStepId !== undefined) {
				const idx = plan.steps.findIndex((s) => s.id === afterStepId);
				if (idx !== -1) {
					plan.steps.splice(idx + 1, 0, newStep);
					plan.steps.forEach((s, i) => (s.id = i + 1));
				} else {
					plan.steps.push(newStep);
				}
			} else {
				plan.steps.push(newStep);
			}
			plan.updatedAt = new Date().toISOString();
			savePlans(opts, plans);
			return plan;
		},

		removeStep(planId: string, stepId: number): Plan | undefined {
			const plan = plans.find((p) => p.id === planId);
			if (!plan) return undefined;
			plan.steps = plan.steps.filter((s) => s.id !== stepId);
			plan.steps.forEach((s, i) => (s.id = i + 1));
			plan.updatedAt = new Date().toISOString();
			savePlans(opts, plans);
			return plan;
		},

		deletePlan(planId: string): boolean {
			const len = plans.length;
			plans = plans.filter((p) => p.id !== planId);
			if (plans.length < len) {
				savePlans(opts, plans);
				return true;
			}
			return false;
		},

		formatPlan(plan: Plan): string {
			const lines: string[] = [];
			lines.push(`Plan: ${plan.goal}`);
			lines.push(`ID: ${plan.id}`);
			lines.push(`State: ${plan.state}`);
			lines.push(`Created: ${plan.createdAt}`);
			lines.push("");
			for (const step of plan.steps) {
				const icon =
					step.status === "completed" ? "[x]" : step.status === "in-progress" ? "[>]" : step.status === "skipped" ? "[-]" : "[ ]";
				lines.push(`  ${icon} ${step.id}. ${step.description}`);
				if (step.notes) lines.push(`       ${step.notes}`);
			}
			return lines.join("\n");
		},
	};
}

export type PlanManager = ReturnType<typeof createPlanManager>;
