/**
 * Provider Probe — automatic provider enhancement.
 *
 * Given a base URL and API key (added by the user), this module:
 *  - validates connectivity and measures latency,
 *  - detects provider compatibility (OpenAI-compatible, Anthropic, etc.),
 *  - fetches and caches the available model list,
 *  - infers per-model capabilities (chat / images / tools / JSON),
 *  - measures availability over several samples,
 *  - generates and persists a provider profile.
 *
 * Transport is injectable so the module is fully testable without network.
 * The default transport uses the global `fetch` with an abort timeout.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "../config.ts";

export interface ProviderProbeTransport {
	(opts: {
		url: string;
		method: string;
		headers: Record<string, string>;
		body?: string;
		timeoutMs?: number;
	}): Promise<{ status: number; ok: boolean; body: string; ms: number; error?: string }>;
}

export interface DiscoveredModel {
	id: string;
	contextWindow?: number;
	supportsChat: boolean;
	supportsImages: boolean;
	supportsTools: boolean;
	supportsJson: boolean;
}

export interface ProviderCapabilities {
	chat: boolean;
	images: boolean;
	tools: boolean;
	streaming: boolean;
}

export interface ProviderProfile {
	baseUrl: string;
	providerHint?: string;
	compatibleWith: "openai-compatible" | "anthropic" | "unknown";
	reachable: boolean;
	authMethod?: "bearer" | "header" | "none" | "unknown";
	latencyMs: number;
	availability: number;
	models: DiscoveredModel[];
	capabilities: ProviderCapabilities;
	detectedAt: number;
	error?: string;
}

export interface ProviderProbeInput {
	baseUrl: string;
	apiKey?: string;
	providerHint?: string;
	transport?: ProviderProbeTransport;
	timeoutMs?: number;
	samples?: number;
}

export interface ProviderProfileStore {
	version: number;
	profiles: Record<string, ProviderProfile>;
}

const STORE_VERSION = 1;

function defaultTransport(): ProviderProbeTransport {
	return async ({ url, method, headers, body, timeoutMs }) => {
		const start = Date.now();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs ?? 10_000);
		try {
			const res = await fetch(url, {
				method,
				headers,
				body,
				signal: controller.signal,
			});
			const text = await res.text();
			return { status: res.status, ok: res.ok, body: text, ms: Date.now() - start };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { status: 0, ok: false, body: "", ms: Date.now() - start, error: message };
		} finally {
			clearTimeout(timer);
		}
	};
}

function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

function classifyCompatibility(
	body: string,
	providerHint: string | undefined,
): "openai-compatible" | "anthropic" | "unknown" {
	const hint = (providerHint ?? "").toLowerCase();
	if (hint.includes("anthropic")) return "anthropic";
	if (hint.includes("openai") || hint.includes("openrouter")) return "openai-compatible";
	try {
		const parsed = JSON.parse(body) as { data?: unknown; models?: unknown; type?: string };
		if (Array.isArray(parsed.data) || Array.isArray(parsed.models)) return "openai-compatible";
		if (parsed.type === "provider" || body.includes('"id"') && body.includes('"type"')) {
			if (body.includes('"content"')) return "anthropic";
		}
	} catch {
		// Not JSON; remain unknown.
	}
	return "unknown";
}

function inferModelCapabilities(
	id: string,
	meta: Record<string, unknown>,
): DiscoveredModel {
	const lower = id.toLowerCase();
	const modality = String(meta.modality ?? meta.architecture ?? "");
	const supportsImages =
		lower.includes("vision") ||
		lower.includes("image") ||
		lower.includes("gpt-4o") ||
		lower.includes("claude-3") ||
		modality.toLowerCase().includes("image");
	const contextWindow =
		typeof meta.context_length === "number"
			? meta.context_length
			: typeof meta.context_window === "number"
				? meta.context_window
				: undefined;
	return {
		id,
		contextWindow,
		supportsChat: true,
		supportsImages,
		supportsTools: lower.includes("instruct") ? false : true,
		supportsJson: true,
	};
}

/** Parse a model list from a probe response body. */
export function discoverModels(
	body: string,
	compatibleWith: "openai-compatible" | "anthropic" | "unknown",
): DiscoveredModel[] {
	if (!body) return [];
	try {
		const parsed = JSON.parse(body) as {
			data?: Array<Record<string, unknown>>;
			models?: Array<Record<string, unknown>>;
		};
		const list = parsed.data ?? parsed.models ?? [];
		if (!Array.isArray(list)) return [];
		return list
			.map((entry) => {
				const id = String(entry.id ?? entry.name ?? "");
				if (!id) return null;
				return inferModelCapabilities(id, entry);
			})
			.filter((m): m is DiscoveredModel => m !== null)
			.sort((a, b) => a.id.localeCompare(b.id));
	} catch {
		// Anthropic-style or unknown; cannot parse a model array here.
		return [];
	}
}

/** Probe a provider endpoint and build a profile. */
export async function probeProvider(input: ProviderProbeInput): Promise<ProviderProfile> {
	const transport = input.transport ?? defaultTransport();
	const baseUrl = normalizeBaseUrl(input.baseUrl);
	const timeoutMs = input.timeoutMs ?? 10_000;
	const samples = Math.max(1, input.samples ?? 3);
	const headers: Record<string, string> = { accept: "application/json" };
	let authMethod: ProviderProfile["authMethod"] = "none";
	if (input.apiKey) {
		if ((input.providerHint ?? "").toLowerCase().includes("anthropic")) {
			headers["x-api-key"] = input.apiKey;
			headers["anthropic-version"] = "2023-06-01";
			authMethod = "header";
		} else {
			headers["authorization"] = `Bearer ${input.apiKey}`;
			authMethod = "bearer";
		}
	}

	const modelsUrl = `${baseUrl}/models`;
	const results: Array<{ status: number; ok: boolean; body: string; ms: number; error?: string }> = [];
	for (let i = 0; i < samples; i++) {
		results.push(await transport({ url: modelsUrl, method: "GET", headers, timeoutMs }));
	}

	const successful = results.filter((r) => r.ok && r.status < 400);
	const reachable = successful.length > 0;
	const latencyMs = results.reduce((sum, r) => sum + r.ms, 0) / results.length;
	const availability = successful.length / results.length;

	const firstSuccess = successful[0];
	const compatibleWith = classifyCompatibility(firstSuccess?.body ?? "", input.providerHint);
	const models = discoverModels(firstSuccess?.body ?? "", compatibleWith);

	const capabilities: ProviderCapabilities = {
		chat: models.length > 0 || compatibleWith !== "unknown",
		images: models.some((m) => m.supportsImages),
		tools: models.some((m) => m.supportsTools) || (models.length > 0 && compatibleWith === "openai-compatible"),
		streaming: compatibleWith === "openai-compatible",
	};

	const error = reachable
		? undefined
		: results[0]?.error ?? `HTTP ${results[0]?.status ?? 0}`;

	return {
		baseUrl,
		providerHint: input.providerHint,
		compatibleWith,
		reachable,
		authMethod,
		latencyMs: Math.round(latencyMs),
		availability,
		models,
		capabilities,
		detectedAt: Date.now(),
		error,
	};
}

// ============================================================================
// Profile persistence
// ============================================================================

export function loadProviderProfiles(storePath?: string): ProviderProfileStore {
	const path = storePath ?? join(getAgentDir(), "providers.json");
	try {
		if (existsSync(path)) {
			const parsed = JSON.parse(readFileSync(path, "utf-8")) as ProviderProfileStore;
			if (parsed.version === STORE_VERSION && parsed.profiles) return parsed;
		}
	} catch {
		// Corrupt; start fresh.
	}
	return { version: STORE_VERSION, profiles: {} };
}

export function saveProviderProfile(profile: ProviderProfile, storePath?: string): void {
	const path = storePath ?? join(getAgentDir(), "providers.json");
	const store = loadProviderProfiles(path);
	store.profiles[profile.baseUrl] = profile;
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(path, JSON.stringify(store, null, 2), "utf-8");
}

export function getProviderProfile(baseUrl: string, storePath?: string): ProviderProfile | undefined {
	const store = loadProviderProfiles(storePath);
	return store.profiles[normalizeBaseUrl(baseUrl)];
}

/** Render a provider profile as a human-readable report. */
export function formatProviderProfile(profile: ProviderProfile): string {
	const lines: string[] = [];
	lines.push(`Provider: ${profile.providerHint ?? profile.baseUrl}`);
	lines.push(`  Endpoint: ${profile.baseUrl}`);
	lines.push(`  Compatibility: ${profile.compatibleWith}`);
	lines.push(`  Reachable: ${profile.reachable ? "yes" : "no"}`);
	if (!profile.reachable && profile.error) {
		lines.push(`  Error: ${profile.error}`);
	}
	lines.push(`  Auth: ${profile.authMethod ?? "unknown"}`);
	lines.push(`  Latency: ${profile.latencyMs}ms (avg)`);
	lines.push(`  Availability: ${(profile.availability * 100).toFixed(0)}%`);
	lines.push(
		`  Capabilities: chat=${profile.capabilities.chat} images=${profile.capabilities.images} tools=${profile.capabilities.tools} streaming=${profile.capabilities.streaming}`,
	);
	lines.push(`  Models (${profile.models.length}):`);
	if (profile.models.length === 0) {
		lines.push("    (none discovered)");
	}
	for (const model of profile.models.slice(0, 25)) {
		const flags = [
			model.supportsImages ? "img" : null,
			model.supportsTools ? "tools" : null,
			model.contextWindow ? `${model.contextWindow ctx` : null,
		]
			.filter(Boolean)
			.join(", ");
		lines.push(`    - ${model.id}${flags ? ` [${flags}]` : ""}`);
	}
	return lines.join("\n");
}
