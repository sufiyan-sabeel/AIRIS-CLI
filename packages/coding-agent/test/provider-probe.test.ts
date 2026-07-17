import { describe, expect, it } from "vitest";
import {
	classifyCompatibility,
	discoverModels,
	formatProviderProfile,
	getProviderProfile,
	type ProviderProbeTransport,
	probeProvider,
	saveProviderProfile,
} from "../src/core/provider-probe.ts";

function fakeTransport(body: string, status = 200): ProviderProbeTransport {
	return async () => ({ status, ok: status < 400, body, ms: 50 });
}

const OPENAI_MODELS = JSON.stringify({
	data: [{ id: "gpt-4o", context_length: 128000 }, { id: "gpt-4o-mini" }],
});

describe("discoverModels", () => {
	it("parses OpenAI-style model list", () => {
		const models = discoverModels(OPENAI_MODELS, "openai-compatible");
		expect(models.map((m) => m.id)).toEqual(["gpt-4o", "gpt-4o-mini"]);
		expect(models[0].contextWindow).toBe(128000);
		expect(models[0].supportsChat).toBe(true);
	});

	it("returns empty for non-JSON", () => {
		expect(discoverModels("not json", "unknown")).toEqual([]);
	});
});

describe("classifyCompatibility", () => {
	it("detects openai-compatible from hint", () => {
		expect(classifyCompatibility("", "openai")).toBe("openai-compatible");
		expect(classifyCompatibility("", "openrouter")).toBe("openai-compatible");
	});

	it("detects anthropic from hint", () => {
		expect(classifyCompatibility("", "anthropic")).toBe("anthropic");
	});

	it("detects openai-compatible from body shape", () => {
		expect(classifyCompatibility(OPENAI_MODELS, undefined)).toBe("openai-compatible");
	});

	it("falls back to unknown", () => {
		expect(classifyCompatibility("{}", undefined)).toBe("unknown");
	});
});

describe("probeProvider", () => {
	it("validates connectivity and fetches models", async () => {
		const profile = await probeProvider({
			baseUrl: "https://api.example.com/v1",
			apiKey: "sk-test",
			providerHint: "openai",
			transport: fakeTransport(OPENAI_MODELS),
			samples: 1,
		});
		expect(profile.reachable).toBe(true);
		expect(profile.compatibleWith).toBe("openai-compatible");
		expect(profile.authMethod).toBe("bearer");
		expect(profile.models).toHaveLength(2);
		expect(profile.capabilities.tools).toBe(true);
		expect(profile.availability).toBe(1);
		expect(profile.latencyMs).toBeGreaterThanOrEqual(0);
	});

	it("reports unreachable providers with an error", async () => {
		const transport: ProviderProbeTransport = async () => ({
			status: 0,
			ok: false,
			body: "",
			ms: 10,
			error: "ECONNREFUSED",
		});
		const profile = await probeProvider({
			baseUrl: "https://unreachable.invalid",
			transport,
			samples: 1,
		});
		expect(profile.reachable).toBe(false);
		expect(profile.error).toContain("ECONNREFUSED");
		expect(profile.models).toEqual([]);
	});

	it("uses header auth for anthropic hint", async () => {
		let seenHeaders: Record<string, string> = {};
		const transport: ProviderProbeTransport = async (opts) => {
			seenHeaders = opts.headers;
			return { status: 200, ok: true, body: "{}", ms: 10 };
		};
		const profile = await probeProvider({
			baseUrl: "https://api.anthropic.com",
			apiKey: "key",
			providerHint: "anthropic",
			transport,
			samples: 1,
		});
		expect(profile.authMethod).toBe("header");
		expect(seenHeaders["x-api-key"]).toBe("key");
	});

	it("computes availability across samples", async () => {
		let calls = 0;
		const transport: ProviderProbeTransport = async () => {
			calls++;
			// Fail 1 of 3 samples.
			if (calls === 2) return { status: 500, ok: false, body: "", ms: 10 };
			return { status: 200, ok: true, body: "{}", ms: 10 };
		};
		const profile = await probeProvider({
			baseUrl: "https://api.example.com",
			transport,
			samples: 3,
		});
		expect(profile.availability).toBeCloseTo(2 / 3);
	});
});

describe("provider profile persistence", () => {
	it("saves and reloads a profile", () => {
		const profile = {
			baseUrl: "https://api.example.com/v1",
			compatibleWith: "openai-compatible" as const,
			reachable: true,
			latencyMs: 50,
			availability: 1,
			models: [],
			capabilities: { chat: true, images: false, tools: true, streaming: true },
			detectedAt: 0,
		};
		saveProviderProfile(profile, "/tmp/airis-probe-test.json");
		const loaded = getProviderProfile("https://api.example.com/v1", "/tmp/airis-probe-test.json");
		expect(loaded?.baseUrl).toBe("https://api.example.com/v1");
		expect(formatProviderProfile(profile)).toContain("openai-compatible");
	});
});
