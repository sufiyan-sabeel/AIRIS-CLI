import { compare, valid } from "semver";
import { getAirisUserAgent } from "./pi-user-agent.ts";

const LATEST_VERSION_URL = "https://api.github.com/repos/sufiyan-sabeel/AIRIS-CLI/releases/latest";
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 10000;

export interface LatestAirisRelease {
	version: string;
	packageName?: string;
	note?: string;
}

export function comparePackageVersions(leftVersion: string, rightVersion: string): number | undefined {
	const left = valid(leftVersion.trim());
	const right = valid(rightVersion.trim());
	if (!left || !right) {
		return undefined;
	}
	return compare(left, right);
}

export function isNewerPackageVersion(candidateVersion: string, currentVersion: string): boolean {
	const comparison = comparePackageVersions(candidateVersion, currentVersion);
	if (comparison !== undefined) {
		return comparison > 0;
	}
	return candidateVersion.trim() !== currentVersion.trim();
}

export async function getLatestAirisRelease(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<LatestAirisRelease | undefined> {
	if (process.env.PI_SKIP_VERSION_CHECK || process.env.PI_OFFLINE) return undefined;

	const response = await fetch(LATEST_VERSION_URL, {
		headers: {
			"User-Agent": getAirisUserAgent(currentVersion),
			accept: "application/json",
		},
		signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_VERSION_CHECK_TIMEOUT_MS),
	});
	if (!response.ok) return undefined;

	const data = (await response.json()) as {
		tag_name?: unknown;
		name?: unknown;
		body?: unknown;
	};
	const rawVersion = typeof data.tag_name === "string" ? data.tag_name.replace(/^v/, "").trim() : "";
	if (!rawVersion) {
		return undefined;
	}
	const packageName = typeof data.name === "string" && data.name.trim() ? data.name.trim() : undefined;
	const note = typeof data.body === "string" && data.body.trim() ? data.body.trim() : undefined;
	return {
		version: rawVersion,
		packageName,
		...(note ? { note } : {}),
	};
}

export async function getLatestAirisVersion(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<string | undefined> {
	return (await getLatestAirisRelease(currentVersion, options))?.version;
}

export async function checkForNewAirisVersion(currentVersion: string): Promise<LatestAirisRelease | undefined> {
	try {
		const latestRelease = await getLatestAirisRelease(currentVersion);
		if (latestRelease && isNewerPackageVersion(latestRelease.version, currentVersion)) {
			return latestRelease;
		}
		return undefined;
	} catch {
		return undefined;
	}
}
