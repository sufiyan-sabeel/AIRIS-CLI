import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { compileMissionContract } from "../../src/core/verified-autonomy/compiler.ts";
import { createLeaseForMission } from "../../src/core/verified-autonomy/leases.ts";
import { readEvidence, readMission, writeMission } from "../../src/core/verified-autonomy/storage.ts";
import type { MissionContract } from "../../src/core/verified-autonomy/types.ts";
import { verifyMission } from "../../src/core/verified-autonomy/verifier.ts";

let tempDir: string | undefined;

afterEach(() => {
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

function makeTempDir(): string {
	tempDir = mkdtempSync(join(tmpdir(), "airis-mission-test-"));
	return tempDir;
}

describe("AIRIS verified autonomy", () => {
	test("compiles and stores a mission contract", () => {
		const cwd = makeTempDir();
		const contract = compileMissionContract({ cwd, request: "Build a verified feature. Keep providers working." });
		writeMission(cwd, contract);

		const stored = readMission(cwd, contract.id);
		expect(stored.id).toBe(contract.id);
		expect(stored.status).toBe("draft");
		expect(stored.acceptanceCriteria.length).toBeGreaterThan(1);
		expect(stored.allowedDirectories).toContain(cwd);
	});

	test("verifies command evidence under an active lease", async () => {
		const cwd = makeTempDir();
		const command = `"${process.execPath}" --version`;
		const base = compileMissionContract({ cwd, request: "Verify command evidence" });
		const contract: MissionContract = {
			...base,
			allowedCommands: [command],
			verificationStrategy: { commands: [command], notes: [] },
			acceptanceCriteria: [
				{
					id: "AC-001",
					description: "Contract is hashed.",
					mandatory: true,
					verification: { type: "file_hash", path: "mission-contract" },
				},
				{
					id: "AC-002",
					description: "Node version command succeeds.",
					mandatory: true,
					verification: { type: "command", command },
				},
			],
			status: "approved",
		};
		const lease = createLeaseForMission(cwd, contract);
		writeMission(cwd, { ...contract, leaseId: lease.id });

		const report = await verifyMission({ cwd, missionId: contract.id });

		expect(report.status).toBe("completed");
		expect(report.criteria.every((criterion) => criterion.status === "pass")).toBe(true);
		expect(report.commands[0]?.stdoutPreview).toMatch(/^v/);
		expect(readEvidence(cwd, contract.id).missionId).toBe(contract.id);
	});
});
