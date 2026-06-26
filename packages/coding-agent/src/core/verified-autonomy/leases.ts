import { resolve } from "node:path";
import { createLeaseId, nowIso, readLeases, writeLeases } from "./storage.ts";
import type { CapabilityLease, MissionContract } from "./types.ts";

export function createLeaseForMission(
	cwd: string,
	contract: MissionContract,
	durationMs = 10 * 60 * 1000,
): CapabilityLease {
	const now = Date.now();
	const lease: CapabilityLease = {
		schemaVersion: "airis.lease.v1",
		id: createLeaseId(),
		missionId: contract.id,
		directories: contract.allowedDirectories.map((directory) => resolve(directory)),
		commands: [...contract.allowedCommands],
		networkDomains: [...contract.allowedNetworkDomains],
		createdAt: new Date(now).toISOString(),
		expiresAt: new Date(now + durationMs).toISOString(),
	};
	const leases = readLeases(cwd).filter((entry) => entry.id !== lease.id);
	leases.push(lease);
	writeLeases(cwd, leases);
	return lease;
}

export function listLeases(cwd: string): CapabilityLease[] {
	return readLeases(cwd).map((lease) => normalizeLease(lease));
}

export function revokeLease(cwd: string, id: string): CapabilityLease {
	const leases = readLeases(cwd);
	const lease = leases.find((entry) => entry.id === id);
	if (!lease) throw new Error(`Lease not found: ${id}`);
	lease.revokedAt = nowIso();
	writeLeases(cwd, leases);
	return lease;
}

export function getActiveMissionLease(cwd: string, missionId: string): CapabilityLease | undefined {
	const now = Date.now();
	return readLeases(cwd)
		.map((lease) => normalizeLease(lease))
		.find((lease) => lease.missionId === missionId && !lease.revokedAt && Date.parse(lease.expiresAt) > now);
}

export function isCommandAllowedByLease(lease: CapabilityLease, command: string): boolean {
	return lease.commands.some((allowed) => normalizeCommand(allowed) === normalizeCommand(command));
}

export function isDirectoryAllowedByLease(lease: CapabilityLease, cwd: string): boolean {
	const resolvedCwd = resolve(cwd);
	return lease.directories.some((directory) => {
		const resolvedDirectory = resolve(directory);
		return (
			resolvedCwd === resolvedDirectory ||
			resolvedCwd.startsWith(`${resolvedDirectory}${process.platform === "win32" ? "\\" : "/"}`)
		);
	});
}

export function normalizeCommand(command: string): string {
	return command.trim().replace(/\s+/g, " ");
}

function normalizeLease(lease: CapabilityLease): CapabilityLease {
	return {
		...lease,
		directories: lease.directories.map((directory) => resolve(directory)),
		commands: lease.commands.map((command) => normalizeCommand(command)),
	};
}
