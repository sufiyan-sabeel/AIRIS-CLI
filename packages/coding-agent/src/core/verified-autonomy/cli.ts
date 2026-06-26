import { existsSync } from "node:fs";
import chalk from "chalk";
import { compileMissionContract } from "./compiler.ts";
import { searchFailures } from "./failures.ts";
import { createLeaseForMission, listLeases, revokeLease } from "./leases.ts";
import { evidencePath, missionPath, nowIso, readEvidence, readMission, stableJson, writeMission } from "./storage.ts";
import type { EvidenceReport, MissionContract } from "./types.ts";
import { verifyMission } from "./verifier.ts";

const MISSION_SUBCOMMANDS = new Set(["create", "show", "approve", "run", "verify", "status"]);

export async function handleVerifiedAutonomyCommand(args: string[], cwd = process.cwd()): Promise<boolean> {
	const [command, ...rest] = args;
	if (command === "mission") {
		await handleMissionCommand(rest, cwd);
		return true;
	}
	if (command === "evidence") {
		await handleEvidenceCommand(rest, cwd);
		return true;
	}
	if (command === "lease") {
		handleLeaseCommand(rest, cwd);
		return true;
	}
	if (command === "failures") {
		handleFailuresCommand(rest, cwd);
		return true;
	}
	return false;
}

async function handleMissionCommand(args: string[], cwd: string): Promise<void> {
	const [subcommand, ...rest] = args;
	if (!subcommand || subcommand === "--help" || subcommand === "-h") {
		printMissionHelp();
		return;
	}

	if (!MISSION_SUBCOMMANDS.has(subcommand)) {
		const request = args
			.filter((arg) => arg !== "--verified")
			.join(" ")
			.trim();
		if (!request) throw new Error("Mission request is required.");
		const contract = createMission(cwd, request);
		printContract(contract, cwd);
		console.log(
			chalk.yellow(
				`Mission is not approved yet. Review the contract, then run: airis mission approve ${contract.id}`,
			),
		);
		if (args.includes("--verified")) {
			console.log(chalk.dim(`After approval, run: airis mission run ${contract.id}`));
		}
		return;
	}

	switch (subcommand) {
		case "create": {
			const request = rest.join(" ").trim();
			if (!request) throw new Error('Usage: airis mission create "<request>"');
			const contract = createMission(cwd, request);
			printContract(contract, cwd);
			console.log(chalk.yellow(`Approve with: airis mission approve ${contract.id}`));
			return;
		}
		case "show": {
			const id = requireId(rest, "airis mission show <id>");
			printContract(readMission(cwd, id), cwd);
			return;
		}
		case "approve": {
			const id = requireId(rest, "airis mission approve <id>");
			const contract = approveMission(cwd, id);
			console.log(chalk.green(`Approved mission ${contract.id}. Lease: ${contract.leaseId}`));
			console.log(chalk.dim(`Run with: airis mission run ${contract.id}`));
			return;
		}
		case "run":
		case "verify": {
			const id = requireId(rest, `airis mission ${subcommand} <id>`);
			const controller = new AbortController();
			const onSigint = () => controller.abort();
			process.once("SIGINT", onSigint);
			try {
				const report = await verifyMission({ cwd, missionId: id, signal: controller.signal });
				printEvidenceSummary(report);
			} finally {
				process.removeListener("SIGINT", onSigint);
			}
			return;
		}
		case "status": {
			const id = requireId(rest, "airis mission status <id>");
			const contract = readMission(cwd, id);
			console.log(`${contract.id}: ${formatStatus(contract.status)}`);
			const path = evidencePath(cwd, id);
			if (existsSync(path)) {
				const evidence = readEvidence(cwd, id);
				console.log(`Evidence: ${evidence.status} (${evidence.generatedAt})`);
				console.log(evidence.summary);
			} else {
				console.log("Evidence: none yet");
			}
			return;
		}
	}
}

async function handleEvidenceCommand(args: string[], cwd: string): Promise<void> {
	const [subcommand, id] = args;
	if (subcommand !== "show" || !id) {
		console.log("Usage: airis evidence show <mission-id>");
		return;
	}
	const evidence = readEvidence(cwd, id);
	console.log(stableJson(evidence));
}

function handleLeaseCommand(args: string[], cwd: string): void {
	const [subcommand, id] = args;
	if (subcommand === "list") {
		const leases = listLeases(cwd);
		if (leases.length === 0) {
			console.log("No capability leases.");
			return;
		}
		for (const lease of leases) {
			const active = !lease.revokedAt && Date.parse(lease.expiresAt) > Date.now();
			console.log(
				`${lease.id} ${active ? chalk.green("active") : chalk.dim("inactive")} expires=${lease.expiresAt} mission=${lease.missionId ?? "-"}`,
			);
		}
		return;
	}
	if (subcommand === "revoke" && id) {
		const lease = revokeLease(cwd, id);
		console.log(chalk.green(`Revoked lease ${lease.id}`));
		return;
	}
	console.log("Usage:\n  airis lease list\n  airis lease revoke <id>");
}

function handleFailuresCommand(args: string[], cwd: string): void {
	const [subcommand, ...rest] = args;
	if (subcommand !== "search") {
		console.log('Usage: airis failures search "<error>"');
		return;
	}
	const query = rest.join(" ").trim();
	if (!query) throw new Error('Usage: airis failures search "<error>"');
	const failures = searchFailures(cwd, query);
	if (failures.length === 0) {
		console.log("No matching failure records.");
		return;
	}
	for (const failure of failures) {
		console.log(`${failure.fingerprint} attempts=${failure.attempts} resolved=${failure.resolvedAt ?? "no"}`);
		console.log(`  command: ${failure.command}`);
		console.log(`  stderr: ${failure.stderrPreview.split("\n")[0] ?? ""}`);
	}
}

function createMission(cwd: string, request: string): MissionContract {
	const contract = compileMissionContract({ cwd, request });
	writeMission(cwd, contract);
	return contract;
}

function approveMission(cwd: string, id: string): MissionContract {
	const contract = readMission(cwd, id);
	if (!["draft", "approved", "partially_completed", "failed"].includes(contract.status)) {
		throw new Error(`Cannot approve mission ${id} from status ${contract.status}`);
	}
	const lease = createLeaseForMission(cwd, contract);
	const approved: MissionContract = {
		...contract,
		status: "approved",
		approvedAt: contract.approvedAt ?? nowIso(),
		leaseId: lease.id,
		updatedAt: nowIso(),
	};
	writeMission(cwd, approved);
	return approved;
}

function requireId(args: string[], usage: string): string {
	const id = args[0];
	if (!id) throw new Error(`Usage: ${usage}`);
	return id;
}

function printMissionHelp(): void {
	console.log(`Usage:
  airis mission "<request>" --verified
  airis mission create "<request>"
  airis mission show <id>
  airis mission approve <id>
  airis mission run <id>
  airis mission verify <id>
  airis mission status <id>

Verified missions store contracts under .airis/missions and evidence under .airis/evidence.`);
}

function printContract(contract: MissionContract, cwd: string): void {
	console.log(chalk.bold(`AIRIS Mission Contract ${contract.id}`));
	console.log(`Status: ${formatStatus(contract.status)}`);
	console.log(`Goal: ${contract.goal}`);
	console.log(`Mission file: ${missionPath(cwd, contract.id)}`);
	console.log("\nAcceptance criteria:");
	for (const criterion of contract.acceptanceCriteria) {
		console.log(`  ${criterion.id} ${criterion.mandatory ? "required" : "optional"}: ${criterion.description}`);
	}
	console.log("\nAllowed commands:");
	for (const command of contract.allowedCommands) console.log(`  - ${command}`);
	console.log("\nAllowed directories:");
	for (const directory of contract.allowedDirectories) console.log(`  - ${directory}`);
}

function printEvidenceSummary(report: EvidenceReport): void {
	console.log(`Mission ${report.missionId}: ${formatStatus(report.status)}`);
	console.log(report.summary);
	for (const criterion of report.criteria) {
		const marker =
			criterion.status === "pass"
				? chalk.green("PASS")
				: criterion.status === "fail"
					? chalk.red("FAIL")
					: chalk.yellow("UNVERIFIED");
		console.log(`  ${marker} ${criterion.criterionId} ${criterion.evidenceSource}`);
	}
	console.log(chalk.dim(`Evidence written to .airis/evidence/${report.missionId}.json`));
}

function formatStatus(status: string): string {
	if (status === "completed") return chalk.green(status);
	if (status === "failed") return chalk.red(status);
	if (status === "partially_completed") return chalk.yellow(status);
	return status;
}
