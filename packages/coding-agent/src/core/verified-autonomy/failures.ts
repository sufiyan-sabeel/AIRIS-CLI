import type { FailureRecord } from "./types.ts";
import { listFailureRecords, nowIso, preview, readFailure, sha256, writeFailure } from "./storage.ts";

export function createFailureFingerprint(command: string, exitCode: number, stderr: string, workspaceSha256: string): string {
	const normalizedStderr = stderr
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 12)
		.join("\n")
		.replace(/\d+/g, "#");
	return sha256(`${command}\n${exitCode}\n${workspaceSha256}\n${normalizedStderr}`).slice(0, 32);
}

export function recordFailure(options: {
	cwd: string;
	command: string;
	exitCode: number;
	stderr: string;
	workspaceSha256: string;
}): FailureRecord {
	const fingerprint = createFailureFingerprint(
		options.command,
		options.exitCode,
		options.stderr,
		options.workspaceSha256,
	);
	const existing = readFailure(options.cwd, fingerprint);
	const now = nowIso();
	const record: FailureRecord = existing
		? {
				...existing,
				attempts: existing.attempts + 1,
				lastSeenAt: now,
				stderrPreview: preview(options.stderr),
			}
		: {
				schemaVersion: "airis.failure.v1",
				fingerprint,
				command: options.command,
				cwd: options.cwd,
				workspaceSha256: options.workspaceSha256,
				exitCode: options.exitCode,
				stderrSha256: sha256(options.stderr),
				stderrPreview: preview(options.stderr),
				attempts: 1,
				firstSeenAt: now,
				lastSeenAt: now,
			};
	writeFailure(options.cwd, record);
	return record;
}

export function resolveFailuresForCommand(cwd: string, command: string, evidence: string): void {
	const now = nowIso();
	for (const failure of listFailureRecords(cwd)) {
		if (failure.command !== command || failure.resolvedAt) continue;
		writeFailure(cwd, {
			...failure,
			resolvedAt: now,
			resolutionEvidence: evidence,
		});
	}
}

export function findBlockingFailure(cwd: string, command: string, workspaceSha256: string): FailureRecord | undefined {
	return listFailureRecords(cwd).find(
		(failure) => failure.command === command && failure.workspaceSha256 === workspaceSha256 && !failure.resolvedAt,
	);
}

export function searchFailures(cwd: string, query: string): FailureRecord[] {
	const needle = query.toLowerCase();
	return listFailureRecords(cwd).filter((failure) => {
		return [failure.fingerprint, failure.command, failure.stderrPreview, failure.resolutionEvidence ?? ""]
			.join("\n")
			.toLowerCase()
			.includes(needle);
	});
}
