import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { sanitizeLogText } from "../cli-logs.ts";
import type { CapabilityLease, EvidenceReport, FailureRecord, MissionContract } from "./types.ts";

const SECRET_ASSIGNMENT_RE = /\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION)[A-Z0-9_]*)\s*=\s*([^\s"']+)/gi;
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

export function nowIso(): string {
	return new Date().toISOString();
}

export function createMissionId(): string {
	return `mis_${Date.now().toString(36)}_${randomBytes(8).toString("hex")}`;
}

export function createLeaseId(): string {
	return `lease_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
}

export function sha256(value: string | Buffer): string {
	return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value: unknown): string {
	return JSON.stringify(sortForStableJson(value), null, 2);
}

function sortForStableJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((item) => sortForStableJson(item));
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, item]) => [key, sortForStableJson(item)]),
		);
	}
	return value;
}

export function redactSecrets(value: string): string {
	return sanitizeLogText(value)
		.replace(SECRET_ASSIGNMENT_RE, "$1=[redacted]")
		.replace(PRIVATE_KEY_RE, "-----BEGIN PRIVATE KEY-----\n[redacted]\n-----END PRIVATE KEY-----");
}

export function preview(value: string, maxLength = 4000): string {
	const redacted = redactSecrets(value);
	return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}\n[truncated]` : redacted;
}

export function getAirisWorkspaceDir(cwd: string): string {
	return join(cwd, ".airis");
}

export function getMissionsDir(cwd: string): string {
	return join(getAirisWorkspaceDir(cwd), "missions");
}

export function getEvidenceDir(cwd: string): string {
	return join(getAirisWorkspaceDir(cwd), "evidence");
}

export function getFailuresDir(cwd: string): string {
	return join(getAirisWorkspaceDir(cwd), "failures");
}

export function getLeasesPath(cwd: string): string {
	return join(getAirisWorkspaceDir(cwd), "leases.json");
}

export function missionPath(cwd: string, id: string): string {
	assertSafeStorageId(id, "mission id");
	return join(getMissionsDir(cwd), `${id}.json`);
}

export function evidencePath(cwd: string, id: string): string {
	assertSafeStorageId(id, "mission id");
	return join(getEvidenceDir(cwd), `${id}.json`);
}

export function failurePath(cwd: string, fingerprint: string): string {
	assertSafeStorageId(fingerprint, "failure fingerprint");
	return join(getFailuresDir(cwd), `${fingerprint}.json`);
}

function assertSafeStorageId(value: string, label: string): void {
	if (!/^[a-zA-Z0-9_.-]+$/.test(value) || value.includes("..")) {
		throw new Error(`Invalid ${label}: ${value}`);
	}
}

export function atomicWriteJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	const content = `${stableJson(value)}\n`;
	const tempPath = `${path}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
	writeFileSync(tempPath, content, { encoding: "utf-8", mode: 0o600 });
	renameSync(tempPath, path);
}

export function readJsonFile<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function writeMission(cwd: string, contract: MissionContract): void {
	atomicWriteJson(missionPath(cwd, contract.id), contract);
}

export function readMission(cwd: string, id: string): MissionContract {
	const contract = readJsonFile<MissionContract>(missionPath(cwd, id));
	assertMissionContract(contract);
	return contract;
}

export function writeEvidence(cwd: string, evidence: EvidenceReport): void {
	atomicWriteJson(evidencePath(cwd, evidence.missionId), evidence);
}

export function readEvidence(cwd: string, id: string): EvidenceReport {
	const evidence = readJsonFile<EvidenceReport>(evidencePath(cwd, id));
	assertEvidenceReport(evidence);
	return evidence;
}

export function readLeases(cwd: string): CapabilityLease[] {
	const path = getLeasesPath(cwd);
	if (!existsSync(path)) return [];
	const leases = readJsonFile<CapabilityLease[]>(path);
	if (!Array.isArray(leases)) throw new Error(`Invalid lease store: ${path}`);
	return leases;
}

export function writeLeases(cwd: string, leases: CapabilityLease[]): void {
	atomicWriteJson(getLeasesPath(cwd), leases);
}

export function readFailure(cwd: string, fingerprint: string): FailureRecord | undefined {
	const path = failurePath(cwd, fingerprint);
	if (!existsSync(path)) return undefined;
	const failure = readJsonFile<FailureRecord>(path);
	assertFailureRecord(failure);
	return failure;
}

export function writeFailure(cwd: string, failure: FailureRecord): void {
	atomicWriteJson(failurePath(cwd, failure.fingerprint), failure);
}

export function listFailureRecords(cwd: string): FailureRecord[] {
	const dir = getFailuresDir(cwd);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((file) => file.endsWith(".json"))
		.map((file) => readJsonFile<FailureRecord>(join(dir, file)));
}

export function isInsideDirectory(candidate: string, directory: string): boolean {
	const resolvedCandidate = resolve(candidate);
	const resolvedDirectory = resolve(directory);
	return resolvedCandidate === resolvedDirectory || resolvedCandidate.startsWith(`${resolvedDirectory}${process.platform === "win32" ? "\\" : "/"}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireStringArray(value: unknown, field: string): asserts value is string[] {
	if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
		throw new Error(`Invalid ${field}: expected string[]`);
	}
}

export function assertMissionContract(value: unknown): asserts value is MissionContract {
	if (!isRecord(value) || value.schemaVersion !== "airis.mission.v1" || typeof value.id !== "string") {
		throw new Error("Invalid AIRIS mission contract");
	}
	requireStringArray(value.requirements, "requirements");
	requireStringArray(value.allowedDirectories, "allowedDirectories");
	requireStringArray(value.allowedCommands, "allowedCommands");
	if (!Array.isArray(value.acceptanceCriteria)) throw new Error("Invalid acceptanceCriteria");
}

export function assertEvidenceReport(value: unknown): asserts value is EvidenceReport {
	if (!isRecord(value) || value.schemaVersion !== "airis.evidence.v1" || typeof value.missionId !== "string") {
		throw new Error("Invalid AIRIS evidence report");
	}
	if (!Array.isArray(value.criteria) || !Array.isArray(value.commands)) throw new Error("Invalid evidence arrays");
}

export function assertFailureRecord(value: unknown): asserts value is FailureRecord {
	if (!isRecord(value) || value.schemaVersion !== "airis.failure.v1" || typeof value.fingerprint !== "string") {
		throw new Error("Invalid AIRIS failure record");
	}
}
