import { spawnProcess, spawnProcessSync, waitForChildProcess } from "../../utils/child-process.ts";
import { getActiveMissionLease, isCommandAllowedByLease, isDirectoryAllowedByLease, normalizeCommand } from "./leases.ts";
import {
	nowIso,
	preview,
	readMission,
	redactSecrets,
	sha256,
	stableJson,
	writeEvidence,
	writeMission,
} from "./storage.ts";
import type { CommandEvidence, EvidenceCriterion, EvidenceReport, MissionContract, MissionStatus } from "./types.ts";
import { findBlockingFailure, recordFailure, resolveFailuresForCommand } from "./failures.ts";

const DESTRUCTIVE_COMMAND_RE = /(^|\s)(rm\s+-rf|rm\s+-fr|del\s+\/f|rmdir\s+\/s|format\b|mkfs\b|dd\b|git\s+reset\s+--hard|git\s+clean\s+-fd|chmod\s+-R\s+777|chown\s+-R)($|\s)/i;
const MAX_CAPTURE_BYTES = 250_000;

export interface VerifyMissionOptions {
	cwd: string;
	missionId: string;
	signal?: AbortSignal;
}

interface RunCommandResult extends CommandEvidence {
	stdout: string;
	stderr: string;
}

export async function verifyMission(options: VerifyMissionOptions): Promise<EvidenceReport> {
	const contract = readMission(options.cwd, options.missionId);
	if (contract.status !== "approved" && contract.status !== "running" && contract.status !== "partially_completed") {
		throw new Error(`Mission ${contract.id} must be approved before verification. Current status: ${contract.status}`);
	}

	const runningContract: MissionContract = { ...contract, status: "running", updatedAt: nowIso() };
	writeMission(options.cwd, runningContract);

	const lease = contract.leaseId ? getActiveMissionLease(options.cwd, contract.id) : undefined;
	const contractSha256 = sha256(stableJson(contract));
	const criteria: EvidenceCriterion[] = [];
	const commands: CommandEvidence[] = [];
	const priorFailures: string[] = [];
	const workspaceSha256 = computeWorkspaceSha256(options.cwd);

	for (const criterion of contract.acceptanceCriteria) {
		if (options.signal?.aborted) {
			criteria.push({
				criterionId: criterion.id,
				verificationMethod: criterion.verification.type,
				evidenceSource: "abort-signal",
				timestamp: nowIso(),
				status: "unverified",
				confidence: 0,
				details: "Mission verification was cancelled.",
			});
			continue;
		}

		if (criterion.verification.type === "file_hash") {
			criteria.push({
				criterionId: criterion.id,
				verificationMethod: "file_hash",
				evidenceSource: "mission contract",
				timestamp: nowIso(),
				status: "pass",
				confidence: 0.98,
				sha256: contractSha256,
			});
			continue;
		}

		if (criterion.verification.type === "git_diff") {
			criteria.push({
				criterionId: criterion.id,
				verificationMethod: "git_diff",
				evidenceSource: "git status + git diff --stat",
				timestamp: nowIso(),
				status: "pass",
				confidence: 0.85,
				sha256: workspaceSha256,
			});
			continue;
		}

		if (criterion.verification.type === "manual") {
			criteria.push({
				criterionId: criterion.id,
				verificationMethod: "manual",
				evidenceSource: "human review required",
				timestamp: nowIso(),
				status: "unverified",
				confidence: 0,
				details: "AIRIS cannot mark semantic completion without human acceptance evidence.",
			});
			continue;
		}

		const command = criterion.verification.command;
		if (!command) {
			criteria.push(unverifiedCriterion(criterion.id, criterion.verification.type, "missing command"));
			continue;
		}

		const leaseError = validateLeaseForCommand(lease, options.cwd, command);
		if (leaseError) {
			criteria.push({
				criterionId: criterion.id,
				verificationMethod: "command",
				evidenceSource: `command:${command}`,
				timestamp: nowIso(),
				status: "fail",
				confidence: 0.95,
				details: leaseError,
			});
			commands.push(blockedCommandEvidence(command, options.cwd, leaseError));
			continue;
		}

		const priorFailure = findBlockingFailure(options.cwd, command, workspaceSha256);
		if (priorFailure) {
			priorFailures.push(priorFailure.fingerprint);
			criteria.push({
				criterionId: criterion.id,
				verificationMethod: "command",
				evidenceSource: `failure:${priorFailure.fingerprint}`,
				timestamp: nowIso(),
				status: "unverified",
				confidence: 0.9,
				details: "Skipped repeated command because the same command already failed for the current workspace fingerprint.",
			});
			continue;
		}

		const result = await runCommand(command, options.cwd, contract.budgets.timeoutMs, options.signal);
		commands.push(stripCommandOutput(result));
		const passed = result.exitCode === 0 && !result.timedOut;
		if (passed) {
			resolveFailuresForCommand(options.cwd, command, `evidence:${contract.id}`);
		} else {
			const failure = recordFailure({
				cwd: options.cwd,
				command,
				exitCode: result.exitCode,
				stderr: result.stderr || result.stdout,
				workspaceSha256,
			});
			priorFailures.push(failure.fingerprint);
		}
		criteria.push({
			criterionId: criterion.id,
			verificationMethod: "command",
			evidenceSource: `command:${command}`,
			timestamp: result.finishedAt,
			status: passed ? "pass" : "fail",
			confidence: passed ? 0.95 : 0.9,
			sha256: sha256(`${result.stdoutSha256}:${result.stderrSha256}:${result.exitCode}`),
			exitCode: result.exitCode,
			details: result.timedOut ? "Command timed out." : undefined,
		});
	}

	const status = computeMissionStatus(runningContract, criteria);
	const report: EvidenceReport = {
		schemaVersion: "airis.evidence.v1",
		missionId: contract.id,
		contractSha256,
		generatedAt: nowIso(),
		status,
		summary: summarizeStatus(status, criteria),
		criteria,
		commands,
		artifacts: [
			{
				label: "workspace-state",
				sha256: workspaceSha256,
			},
		],
		priorFailures: Array.from(new Set(priorFailures)),
	};
	writeEvidence(options.cwd, report);
	writeMission(options.cwd, { ...runningContract, status, updatedAt: nowIso() });
	return report;
}

function validateLeaseForCommand(
	lease: ReturnType<typeof getActiveMissionLease>,
	cwd: string,
	command: string,
): string | undefined {
	if (DESTRUCTIVE_COMMAND_RE.test(command)) return `Destructive command blocked by default: ${command}`;
	if (!lease) return "No active capability lease. Approve the mission to create a temporary lease.";
	if (!isDirectoryAllowedByLease(lease, cwd)) return `Current directory is outside lease scope: ${cwd}`;
	if (!isCommandAllowedByLease(lease, command)) return `Command is outside lease scope: ${command}`;
	return undefined;
}

function unverifiedCriterion(id: string, method: EvidenceCriterion["verificationMethod"], details: string): EvidenceCriterion {
	return {
		criterionId: id,
		verificationMethod: method,
		evidenceSource: "mission contract",
		timestamp: nowIso(),
		status: "unverified",
		confidence: 0,
		details,
	};
}

function computeMissionStatus(contract: MissionContract, criteria: EvidenceCriterion[]): MissionStatus {
	const mandatoryIds = new Set(contract.acceptanceCriteria.filter((criterion) => criterion.mandatory).map((criterion) => criterion.id));
	const mandatory = criteria.filter((criterion) => mandatoryIds.has(criterion.criterionId));
	if (mandatory.some((criterion) => criterion.status === "fail")) return "failed";
	if (mandatory.some((criterion) => criterion.status === "unverified")) return "partially_completed";
	return "completed";
}

function summarizeStatus(status: MissionStatus, criteria: EvidenceCriterion[]): string {
	const failed = criteria.filter((criterion) => criterion.status === "fail").map((criterion) => criterion.criterionId);
	const unverified = criteria.filter((criterion) => criterion.status === "unverified").map((criterion) => criterion.criterionId);
	if (status === "completed") return "All mandatory acceptance criteria have verified evidence.";
	if (failed.length > 0) return `Mission failed; failed criteria: ${failed.join(", ")}.`;
	return `Mission partially completed; unverified criteria: ${unverified.join(", ")}.`;
}

async function runCommand(command: string, cwd: string, timeoutMs: number, signal?: AbortSignal): Promise<RunCommandResult> {
	const startedAt = nowIso();
	const args = splitCommand(command);
	const executable = args.shift();
	if (!executable) throw new Error("Cannot run an empty command");
	let stdout = "";
	let stderr = "";
	let timedOut = false;
	const child = spawnProcess(executable, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
	const timeout = setTimeout(() => {
		timedOut = true;
		child.kill("SIGTERM");
	}, Math.max(1000, timeoutMs));
	const abort = () => {
		timedOut = true;
		child.kill("SIGTERM");
	};
	signal?.addEventListener("abort", abort, { once: true });
	child.stdout?.on("data", (chunk) => {
		stdout = appendLimited(stdout, chunk.toString());
	});
	child.stderr?.on("data", (chunk) => {
		stderr = appendLimited(stderr, chunk.toString());
	});
	const exitCode = await waitForChildProcess(child).finally(() => {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abort);
	});
	const finishedAt = nowIso();
	const redactedStdout = redactSecrets(stdout);
	const redactedStderr = redactSecrets(stderr);
	return {
		command: normalizeCommand(command),
		cwd,
		startedAt,
		finishedAt,
		exitCode: timedOut ? -1 : (exitCode ?? -1),
		stdoutSha256: sha256(redactedStdout),
		stderrSha256: sha256(redactedStderr),
		stdoutPreview: preview(redactedStdout),
		stderrPreview: preview(redactedStderr),
		timedOut,
		stdout: redactedStdout,
		stderr: redactedStderr,
	};
}

function splitCommand(command: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: '"' | "'" | undefined;
	let escaping = false;
	for (const char of command) {
		if (escaping) {
			current += char;
			escaping = false;
			continue;
		}
		if (char === "\\") {
			escaping = true;
			continue;
		}
		if ((char === '"' || char === "'") && !quote) {
			quote = char;
			continue;
		}
		if (char === quote) {
			quote = undefined;
			continue;
		}
		if (/\s/.test(char) && !quote) {
			if (current) tokens.push(current);
			current = "";
			continue;
		}
		current += char;
	}
	if (current) tokens.push(current);
	return tokens;
}

function appendLimited(previous: string, next: string): string {
	const combined = previous + next;
	return combined.length > MAX_CAPTURE_BYTES ? combined.slice(combined.length - MAX_CAPTURE_BYTES) : combined;
}

function stripCommandOutput(result: RunCommandResult): CommandEvidence {
	const { stdout: _stdout, stderr: _stderr, ...evidence } = result;
	return evidence;
}

function blockedCommandEvidence(command: string, cwd: string, reason: string): CommandEvidence {
	const timestamp = nowIso();
	return {
		command,
		cwd,
		startedAt: timestamp,
		finishedAt: timestamp,
		exitCode: -1,
		stdoutSha256: sha256(""),
		stderrSha256: sha256(reason),
		stdoutPreview: "",
		stderrPreview: reason,
		timedOut: false,
	};
}

function computeWorkspaceSha256(cwd: string): string {
	const status = spawnProcessSync("git", ["status", "--short"], { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
	const diff = spawnProcessSync("git", ["diff", "--stat"], { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
	return sha256(`${status.stdout ?? ""}\n${status.stderr ?? ""}\n${diff.stdout ?? ""}\n${diff.stderr ?? ""}`);
}
