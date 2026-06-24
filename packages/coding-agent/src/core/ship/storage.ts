import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ShipState } from "./types.ts";

export function nowIso(): string {
	return new Date().toISOString();
}

export function createShipId(): string {
	return `ship_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
}

function stableJson(value: unknown): string {
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

function atomicWriteJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	const content = `${stableJson(value)}\n`;
	const tempPath = `${path}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
	writeFileSync(tempPath, content, { encoding: "utf-8", mode: 0o600 });
	renameSync(tempPath, path);
}

function readJsonFile<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function assertSafeId(value: string, label: string): void {
	if (!/^[a-zA-Z0-9_.-]+$/.test(value) || value.includes("..")) {
		throw new Error(`Invalid ${label}: ${value}`);
	}
}

export function getShipDir(cwd: string): string {
	return join(cwd, ".airis", "ship");
}

export function shipStatePath(cwd: string, id: string): string {
	assertSafeId(id, "ship id");
	return join(getShipDir(cwd), `${id}.json`);
}

export function writeShipState(cwd: string, state: ShipState): void {
	atomicWriteJson(shipStatePath(cwd, state.id), state);
}

export function readShipState(cwd: string, id: string): ShipState {
	const path = shipStatePath(cwd, id);
	if (!existsSync(path)) throw new Error(`Ship state not found: ${id}`);
	return readJsonFile<ShipState>(path);
}

export function listShipStates(cwd: string): ShipState[] {
	const dir = getShipDir(cwd);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((file) => file.endsWith(".json"))
		.map((file) => readJsonFile<ShipState>(join(dir, file)));
}

export function findActiveShipState(cwd: string): ShipState | undefined {
	const states = listShipStates(cwd);
	return states.find(
		(s) => s.phase !== "completed" && s.phase !== "failed" && s.phase !== "cancelled",
	);
}

export function getEvidenceDir(cwd: string): string {
	return join(cwd, ".airis", "evidence");
}

export function writeEvidenceFile(cwd: string, shipId: string, filename: string, content: string): string {
	const dir = getEvidenceDir(cwd);
	mkdirSync(dir, { recursive: true });
	const evidencePath = join(dir, `${shipId}-${filename}`);
	writeFileSync(evidencePath, content, { encoding: "utf-8" });
	return evidencePath;
}
