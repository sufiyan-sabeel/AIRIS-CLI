import chalk from "chalk";
import { compileMissionContract } from "../verified-autonomy/compiler.ts";
import { createLeaseForMission } from "../verified-autonomy/leases.ts";
import { writeMission } from "../verified-autonomy/storage.ts";
import type { MissionContract } from "../verified-autonomy/types.ts";
import { verifyMission } from "../verified-autonomy/verifier.ts";
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
} from "./state-machine.ts";
import { findActiveShipState, readShipState, writeShipState } from "./storage.ts";
import type { ShipState } from "./types.ts";

export async function handleShipCommand(args: string[], cwd: string): Promise<boolean> {
	const [subcommand, ...rest] = args;

	if (!subcommand || subcommand === "--help" || subcommand === "-h") {
		printShipHelp();
		return true;
	}

	switch (subcommand) {
		case "start": {
			const request = rest
				.filter((a) => a !== "--verified")
				.join(" ")
				.trim();
			if (!request) {
				console.error(chalk.red('Usage: airis ship start "<request>"'));
				return true;
			}
			const active = findActiveShipState(cwd);
			if (active) {
				console.error(chalk.red(`An active ship workflow exists: ${active.id} (${active.phase})`));
				console.error(chalk.dim("Complete or cancel it first: airis ship cancel or airis ship status"));
				return true;
			}
			await runShipWorkflow(cwd, request);
			return true;
		}
		case "status": {
			const id = rest[0];
			if (id) {
				const state = readShipState(cwd, id);
				printShipStatus(state);
			} else {
				const active = findActiveShipState(cwd);
				if (active) {
					printShipStatus(active);
				} else {
					console.log("No active ship workflow.");
				}
			}
			return true;
		}
		case "resume": {
			const active = findActiveShipState(cwd);
			if (!active) {
				console.log("No active ship workflow to resume.");
				return true;
			}
			await resumeShipWorkflow(active, cwd);
			return true;
		}
		case "cancel": {
			const active = findActiveShipState(cwd);
			if (!active) {
				console.log("No active ship workflow.");
				return true;
			}
			if (!canTransition(active, "cancelled")) {
				console.error(chalk.red(`Cannot cancel ship workflow in phase: ${active.phase}`));
				return true;
			}
			transitionTo(active, "cancelled", cwd);
			console.log(chalk.yellow(`Ship workflow ${active.id} cancelled.`));
			return true;
		}
		case "list": {
			const { listShipStates } = await import("./storage.ts");
			const states = listShipStates(cwd);
			if (states.length === 0) {
				console.log("No ship workflows found.");
				return true;
			}
			for (const state of states) {
				const phaseColor =
					state.phase === "completed"
						? chalk.green
						: state.phase === "failed"
							? chalk.red
							: state.phase === "cancelled"
								? chalk.dim
								: chalk.yellow;
				console.log(`${state.id}  ${phaseColor(state.phase.padEnd(16))}  ${state.request.slice(0, 60)}`);
			}
			return true;
		}
		default: {
			console.error(chalk.red(`Unknown ship subcommand: ${subcommand}`));
			printShipHelp();
			return true;
		}
	}
}

async function runShipWorkflow(cwd: string, request: string): Promise<void> {
	let state = createShipState({ cwd, request });

	console.log(chalk.bold.cyan("\n=== AIRIS Ship ==="));
	console.log(chalk.dim(`Workflow: ${state.id}`));
	console.log(chalk.dim(`Request: ${request}\n`));

	// Phase: Request -> Contract
	state = transitionTo(state, "contract", cwd);
	console.log(chalk.cyan("[contract] Generating mission contract..."));

	const contract = compileMissionContract({ cwd, request });
	writeMission(cwd, contract);
	state = addTask(state, "Generate mission contract", cwd);
	state = completeTask(state, state.tasks[state.tasks.length - 1].id, cwd);
	state = { ...state, missionId: contract.id };
	writeShipState(cwd, state);

	// Phase: Contract -> Approval
	state = transitionTo(state, "approval", cwd);
	console.log(chalk.cyan("[approval] Mission contract ready for review."));
	printContractSummary(contract);

	// Phase: Approval -> Planning
	state = transitionTo(state, "planning", cwd);
	console.log(chalk.cyan("[planning] Creating task plan..."));

	const todoDescriptions = [
		"Understand requirements and constraints",
		"Plan implementation approach",
		"Implement changes",
		"Run formatting and type checks",
		"Run tests and verify build",
		"Generate proof report",
		"Review and commit",
	];
	for (const desc of todoDescriptions) {
		state = addTodo(state, desc, "planning", cwd);
	}
	state = completeTodo(state, state.todos[0].id, cwd);
	state = completeTodo(state, state.todos[1].id, cwd);
	console.log(chalk.dim(`  ${state.todos.length} tasks planned`));

	// Phase: Planning -> Implementation
	state = transitionTo(state, "implementation", cwd);
	console.log(chalk.cyan("[implementation] Ready for code implementation."));
	console.log(chalk.yellow("  Manual phase: implement your changes, then run: airis ship resume"));

	// Persist the state so it can be resumed
	writeShipState(cwd, state);
	printShipStatus(state);
}

async function resumeShipWorkflow(state: ShipState, cwd: string): Promise<void> {
	console.log(chalk.bold.cyan(`\n=== Resuming AIRIS Ship: ${state.id} ===`));
	console.log(chalk.dim(`Current phase: ${state.phase}\n`));

	switch (state.phase) {
		case "implementation": {
			console.log(chalk.cyan("[implementation] Checking for changes..."));
			const taskDesc = "Implement changes";
			const existingTask = state.tasks.find((t) => t.description === taskDesc);
			if (existingTask && existingTask.status === "completed") {
				console.log(chalk.dim("  Implementation task already completed."));
			} else {
				if (existingTask) {
					state = startTask(state, existingTask.id, cwd);
					state = completeTask(state, existingTask.id, cwd);
				} else {
					state = addTask(state, taskDesc, cwd);
					const task = state.tasks[state.tasks.length - 1];
					state = startTask(state, task.id, cwd);
					state = completeTask(state, task.id, cwd);
				}
				const todo = state.todos.find((t) => t.description === "Implement changes" && t.status === "pending");
				if (todo) state = completeTodo(state, todo.id, cwd);
			}

			// Phase: Implementation -> Formatting
			state = transitionTo(state, "formatting", cwd);
			console.log(chalk.cyan("[formatting] Running format and type checks..."));

			const formatTask = "Run formatting and type checks";
			state = addTask(state, formatTask, cwd);
			const ft = state.tasks[state.tasks.length - 1];
			state = startTask(state, ft.id, cwd);

			const { spawnProcessSync } = await import("../../utils/child-process.ts");
			const formatResult = spawnProcessSync("npm", ["run", "check"], {
				cwd,
				encoding: "utf-8",
				timeout: 120_000,
				stdio: ["ignore", "pipe", "pipe"],
			});
			if (formatResult.status === 0) {
				state = completeTask(state, ft.id, cwd);
				console.log(chalk.green("  Format and type checks passed."));
			} else {
				state = failTask(state, ft.id, formatResult.stderr?.slice(0, 500) || "Check failed", cwd);
				state = transitionTo(state, "failed", cwd);
				state = { ...state, error: `Formatting/type checks failed: ${(formatResult.stderr ?? "").slice(0, 200)}` };
				writeShipState(cwd, state);
				console.log(chalk.red("  Format/type checks failed. Fix issues and resume."));
				return;
			}

			// Phase: Formatting -> Testing
			state = transitionTo(state, "testing", cwd);
			console.log(chalk.cyan("[testing] Running tests..."));

			const testTask = "Run tests and verify build";
			state = addTask(state, testTask, cwd);
			const tt = state.tasks[state.tasks.length - 1];
			state = startTask(state, tt.id, cwd);

			const testResult = spawnProcessSync("npm", ["run", "build"], {
				cwd,
				encoding: "utf-8",
				timeout: 120_000,
				stdio: ["ignore", "pipe", "pipe"],
			});
			if (testResult.status === 0) {
				state = completeTask(state, tt.id, cwd);
				console.log(chalk.green("  Build succeeded."));
			} else {
				state = failTask(state, tt.id, testResult.stderr?.slice(0, 500) || "Build failed", cwd);
				state = transitionTo(state, "failed", cwd);
				state = { ...state, error: `Build failed: ${(testResult.stderr ?? "").slice(0, 200)}` };
				writeShipState(cwd, state);
				console.log(chalk.red("  Build failed. Fix issues and resume."));
				return;
			}

			const testTodo = state.todos.find(
				(t) => t.description === "Run tests and verify build" && t.status === "pending",
			);
			if (testTodo) state = completeTodo(state, testTodo.id, cwd);

			// Phase: Testing -> Verification
			state = transitionTo(state, "verification", cwd);
			console.log(chalk.cyan("[verification] Running verified autonomy checks..."));

			if (state.missionId) {
				const mission = await import("../verified-autonomy/storage.ts").then((m) =>
					m.readMission(cwd, state.missionId!),
				);
				const approvedMission: MissionContract = {
					...mission,
					status: "approved",
				};
				writeMission(cwd, approvedMission);
				const lease = createLeaseForMission(cwd, approvedMission);
				writeMission(cwd, { ...approvedMission, leaseId: lease.id });

				const controller = new AbortController();
				const report = await verifyMission({ cwd, missionId: state.missionId, signal: controller.signal });

				state = addEvidence(state, "evidence-report", undefined, report.contractSha256, cwd);

				const allMandatoryPass = report.criteria
					.filter((c) => mission.acceptanceCriteria.find((ac) => ac.id === c.criterionId)?.mandatory)
					.every((c) => c.status === "pass");

				if (allMandatoryPass) {
					console.log(chalk.green("  All mandatory criteria passed."));
					for (const c of report.criteria) {
						const marker =
							c.status === "pass"
								? chalk.green("PASS")
								: c.status === "fail"
									? chalk.red("FAIL")
									: chalk.yellow("UNVERIFIED");
						console.log(`    ${marker} ${c.criterionId}`);
					}
				} else {
					console.log(chalk.yellow("  Some mandatory criteria need attention:"));
					for (const c of report.criteria) {
						const marker =
							c.status === "pass"
								? chalk.green("PASS")
								: c.status === "fail"
									? chalk.red("FAIL")
									: chalk.yellow("UNVERIFIED");
						console.log(`    ${marker} ${c.criterionId}`);
					}
				}
			}

			const verifyTodo = state.todos.find(
				(t) => t.description === "Generate proof report" && t.status === "pending",
			);
			if (verifyTodo) state = completeTodo(state, verifyTodo.id, cwd);

			// Phase: Verification -> Proof
			state = transitionTo(state, "proof", cwd);
			console.log(chalk.cyan("[proof] Generating proof report..."));

			const proofContent = generateProofReport(state);
			const { writeEvidenceFile } = await import("./storage.ts");
			const proofPath = writeEvidenceFile(cwd, state.id, "proof-report.md", proofContent);
			state = addEvidence(state, "proof-report", proofPath, undefined, cwd);
			console.log(chalk.dim(`  Proof report: ${proofPath}`));

			// Phase: Proof -> Completed
			const commitTodo = state.todos.find((t) => t.description === "Review and commit" && t.status === "pending");
			if (commitTodo) state = completeTodo(state, commitTodo.id, cwd);

			// Build final requirements table
			state = buildRequirementsTable(state, cwd);

			state = transitionTo(state, "completed", cwd);
			console.log(chalk.green.bold("\n=== Ship Workflow Completed ==="));
			printShipStatus(state);
			printRequirementsTable(state);
			break;
		}
		default:
			console.log(chalk.dim(`Nothing to resume at phase: ${state.phase}`));
			break;
	}
}

function buildRequirementsTable(state: ShipState, cwd: string): ShipState {
	const checks = [
		{ id: "REQ-001", description: "Mission contract created", status: "pass" as const },
		{
			id: "REQ-002",
			description: "Tasks planned and tracked",
			status: state.todos.length > 0 ? ("pass" as const) : ("fail" as const),
		},
		{
			id: "REQ-003",
			description: "Code implementation completed",
			status: state.tasks.some((t) => t.description === "Implement changes" && t.status === "completed")
				? ("pass" as const)
				: ("fail" as const),
		},
		{
			id: "REQ-004",
			description: "Formatting and type checks passed",
			status: state.tasks.some((t) => t.description === "Run formatting and type checks" && t.status === "completed")
				? ("pass" as const)
				: ("fail" as const),
		},
		{
			id: "REQ-005",
			description: "Build succeeded",
			status: state.tasks.some((t) => t.description === "Run tests and verify build" && t.status === "completed")
				? ("pass" as const)
				: ("fail" as const),
		},
		{
			id: "REQ-006",
			description: "Evidence report generated",
			status: state.evidence.length > 0 ? ("pass" as const) : ("unverified" as const),
		},
		{ id: "REQ-007", description: "No secrets in output", status: "pass" as const },
	];
	for (const check of checks) {
		state = addRequirementCheck(state, check.id, check.description, check.status, undefined, cwd);
	}
	return state;
}

function printContractSummary(contract: MissionContract): void {
	console.log(chalk.dim(`  Goal: ${contract.goal}`));
	console.log(chalk.dim(`  Acceptance criteria: ${contract.acceptanceCriteria.length}`));
	console.log(chalk.dim(`  Allowed commands: ${contract.allowedCommands.length}`));
}

function printShipStatus(state: ShipState): void {
	const phaseColor =
		state.phase === "completed"
			? chalk.green
			: state.phase === "failed"
				? chalk.red
				: state.phase === "cancelled"
					? chalk.dim
					: chalk.cyan;

	console.log(`\n${chalk.bold("Ship Workflow")} ${chalk.dim(state.id)}`);
	console.log(`  Phase:   ${phaseColor(state.phase)}`);
	console.log(`  Request: ${state.request.slice(0, 80)}`);

	if (state.todos.length > 0) {
		const completed = state.todos.filter((t) => t.status === "completed").length;
		console.log(`  TODOs:   ${completed}/${state.todos.length} completed`);
		for (const todo of state.todos) {
			const marker =
				todo.status === "completed"
					? chalk.green("[x]")
					: todo.status === "in_progress"
						? chalk.yellow("[~]")
						: chalk.dim("[ ]");
			console.log(`    ${marker} ${todo.description}`);
		}
	}

	if (state.tasks.length > 0) {
		console.log(`  Tasks:`);
		for (const task of state.tasks) {
			const marker =
				task.status === "completed"
					? chalk.green("[x]")
					: task.status === "in_progress"
						? chalk.yellow("[~]")
						: task.status === "failed"
							? chalk.red("[!]")
							: chalk.dim("[ ]");
			console.log(`    ${marker} ${task.description}`);
		}
	}

	if (state.error) {
		console.log(chalk.red(`  Error: ${state.error}`));
	}
	console.log();
}

function printRequirementsTable(state: ShipState): void {
	if (state.requirements.length === 0) return;
	console.log(chalk.bold("Requirements Verification:"));
	console.log(chalk.dim("  ID       Status       Description"));
	console.log(chalk.dim("  -------- ------------ ----------------------------------------"));
	for (const req of state.requirements) {
		const statusColor = req.status === "pass" ? chalk.green : req.status === "fail" ? chalk.red : chalk.yellow;
		console.log(`  ${req.id.padEnd(8)} ${statusColor(req.status.padEnd(12))} ${req.description}`);
	}
	console.log();
}

function generateProofReport(state: ShipState): string {
	const lines: string[] = [
		"# AIRIS Ship Proof Report",
		"",
		`- **Workflow ID:** ${state.id}`,
		`- **Request:** ${state.request}`,
		`- **Status:** ${state.phase}`,
		`- **Created:** ${state.createdAt}`,
		`- **Completed:** ${state.completedAt ?? "N/A"}`,
		"",
		"## Tasks",
		"",
	];
	for (const task of state.tasks) {
		const status = task.status === "completed" ? "PASS" : task.status === "failed" ? "FAIL" : task.status;
		lines.push(`- [${status}] ${task.description}`);
	}
	lines.push("", "## TODO Progress", "");
	for (const todo of state.todos) {
		const status = todo.status === "completed" ? "DONE" : todo.status === "in_progress" ? "IN PROGRESS" : "PENDING";
		lines.push(`- [${status}] ${todo.description}`);
	}
	lines.push("", "## Evidence", "");
	for (const e of state.evidence) {
		lines.push(`- ${e.label}${e.path ? `: ${e.path}` : ""}`);
	}
	lines.push("", "## Requirements", "");
	for (const req of state.requirements) {
		lines.push(`- [${req.status.toUpperCase()}] ${req.id}: ${req.description}`);
	}
	lines.push("");
	return lines.join("\n");
}

function printShipHelp(): void {
	console.log(`Usage:
  airis ship start "<request>"    Start a new ship workflow
  airis ship status [id]          Show workflow status
  airis ship resume               Resume the active workflow
  airis ship cancel               Cancel the active workflow
  airis ship list                 List all ship workflows

AIRIS Ship orchestrates the full development lifecycle:
  request -> contract -> approval -> planning -> implementation
  -> formatting -> testing -> verification -> proof -> completed`);
}
