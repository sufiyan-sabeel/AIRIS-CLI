/**
 * Configuration for bundled Go native binaries (aisearch and aifetch).
 * These replace external fd/rg/curl dependencies with self-contained
 * Go binaries built as part of the release pipeline.
 */

import { arch, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = process.env.AIRIS_BIN_DIR ?? join(moduleDir, "..", "..", "bin");

export interface NativeBinaryConfig {
	binaryName: string;
	binDir: string;
	fullPath: string;
}

type BinaryName = "aisearch" | "aifetch";

function getBinaryName(name: BinaryName): string {
	const ext = platform() === "win32" ? ".exe" : "";
	return `${name}${ext}`;
}

export function getAisearchConfig(): NativeBinaryConfig {
	const baseName = getBinaryName("aisearch");
	return {
		binaryName: baseName,
		binDir: BIN_DIR,
		fullPath: join(BIN_DIR, baseName),
	};
}

export function getAifetchConfig(): NativeBinaryConfig {
	const baseName = getBinaryName("aifetch");
	return {
		binaryName: baseName,
		binDir: BIN_DIR,
		fullPath: join(BIN_DIR, baseName),
	};
}

function buildAssetName(name: BinaryName): string {
	const plat = platform();
	const cpu = arch();

	let osName: string;
	switch (plat) {
		case "darwin":
			osName = "darwin";
			break;
		case "linux":
			osName = "linux";
			break;
		case "win32":
			osName = "windows";
			break;
		default:
			osName = "linux";
	}

	let archName: string;
	switch (cpu) {
		case "x64":
			archName = "amd64";
			break;
		case "arm64":
			archName = "arm64";
			break;
		default:
			archName = "amd64";
	}

	return `${name}-${osName}-${archName}${plat === "win32" ? ".exe" : ""}`;
}

export function getAisearchAssetName(): string {
	return buildAssetName("aisearch");
}

export function getAifetchAssetName(): string {
	return buildAssetName("aifetch");
}
