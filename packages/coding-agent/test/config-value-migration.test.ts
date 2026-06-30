import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRegistry } from "../src/core/model-registry.ts";
import { runMigrations } from "../src/migrations.ts";

describe("config value env var syntax migration", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	function createAgentDir(): string {
		const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "airis-config-value-migration-test-"));
		tempDirs.push(agentDir);
		return agentDir;
	}

	function withAgentDir(agentDir: string, fn: () => void): void {
		const previousAgentDir = process.env[ENV_AGENT_DIR];
		process.env[ENV_AGENT_DIR] = agentDir;
		try {
			fn();
		} finally {
			if (previousAgentDir === undefined) {
				delete process.env[ENV_AGENT_DIR];
			} else {
				process.env[ENV_AGENT_DIR] = previousAgentDir;
			}
		}
	}

	it("leaves uppercase auth.json API key values unchanged", () => {
		const agentDir = createAgentDir();
		fs.writeFileSync(
			path.join(agentDir, "auth.json"),
			`${JSON.stringify(
				{
					anthropic: { type: "aairis_key", key: "ANTHROPIC_AAIRIS_KEY" },
					openai: { type: "aairis_key", key: "$OPENAI_AAIRIS_KEY" },
					opencode: { type: "aairis_key", key: "public" },
					github: { type: "oauth", access: "ACCESS_TOKEN", refresh: "REFRESH_TOKEN", expires: 1 },
				},
				null,
				2,
			)}\n`,
			"utf-8",
		);
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		withAgentDir(agentDir, () => runMigrations(agentDir));

		const migrated = JSON.parse(fs.readFileSync(path.join(agentDir, "auth.json"), "utf-8")) as Record<
			string,
			Record<string, unknown>
		>;
		expect(migrated.anthropic.key).toBe("ANTHROPIC_AAIRIS_KEY");
		expect(migrated.openai.key).toBe("$OPENAI_AAIRIS_KEY");
		expect(migrated.opencode.key).toBe("public");
		expect(migrated.github.access).toBe("ACCESS_TOKEN");
		expect(logSpy).not.toHaveBeenCalled();
	});

	it.each([
		["malformed", '{\n  "providers": {\n'],
		["blank", ""],
	])("does not throw on %s models.json during migrations", (_name, content) => {
		const agentDir = createAgentDir();
		const modelsPath = path.join(agentDir, "models.json");
		fs.writeFileSync(modelsPath, content, "utf-8");

		withAgentDir(agentDir, () => expect(() => runMigrations(agentDir)).not.toThrow());

		expect(fs.readFileSync(modelsPath, "utf-8")).toBe(content);
		const registry = ModelRegistry.create(AuthStorage.create(path.join(agentDir, "auth.json")), modelsPath);
		const loadError = registry.getError();
		expect(loadError).toContain("Failed to parse models.json");
		expect(loadError).toContain(`File: ${modelsPath}`);
	});

	it("leaves uppercase models.json API key and header values unchanged", async () => {
		const agentDir = createAgentDir();
		const envKeys = ["CUSTOM_AAIRIS_KEY", "HEADER_AAIRIS_KEY", "MODEL_AAIRIS_KEY", "OVERRIDE_AAIRIS_KEY"];
		const savedEnv: Record<string, string | undefined> = {};
		for (const key of envKeys) {
			savedEnv[key] = process.env[key];
			process.env[key] = `env-${key}`;
		}

		try {
			fs.writeFileSync(
				path.join(agentDir, "models.json"),
				`${JSON.stringify(
					{
						providers: {
							"custom-provider": {
								baseUrl: "https://example.com/v1",
								apiKey: "CUSTOM_AAIRIS_KEY",
								api: "openai-completions",
								headers: {
									"x-aairis-key": "HEADER_AAIRIS_KEY",
									"x-literal": "literal",
								},
								models: [
									{
										id: "model-a",
										headers: { "x-model-key": "MODEL_AAIRIS_KEY" },
									},
								],
								modelOverrides: {
									"model-b": { headers: { "x-override-key": "OVERRIDE_AAIRIS_KEY" } },
								},
							},
						},
					},
					null,
					2,
				)}\n`,
				"utf-8",
			);
			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			withAgentDir(agentDir, () => runMigrations(agentDir));

			const migrated = JSON.parse(fs.readFileSync(path.join(agentDir, "models.json"), "utf-8")) as {
				providers: Record<
					string,
					{
						apiKey?: string;
						headers?: Record<string, string>;
						models?: Array<{ headers?: Record<string, string> }>;
						modelOverrides?: Record<string, { headers?: Record<string, string> }>;
					}
				>;
			};
			const provider = migrated.providers["custom-provider"]!;
			expect(provider.apiKey).toBe("CUSTOM_AAIRIS_KEY");
			expect(provider.headers?.["x-aairis-key"]).toBe("HEADER_AAIRIS_KEY");
			expect(provider.headers?.["x-literal"]).toBe("literal");
			expect(provider.models?.[0]?.headers?.["x-model-key"]).toBe("MODEL_AAIRIS_KEY");
			expect(provider.modelOverrides?.["model-b"]?.headers?.["x-override-key"]).toBe("OVERRIDE_AAIRIS_KEY");
			expect(logSpy).not.toHaveBeenCalled();

			const registry = ModelRegistry.create(
				AuthStorage.create(path.join(agentDir, "auth.json")),
				path.join(agentDir, "models.json"),
			);
			const model = registry.find("custom-provider", "model-a");
			expect(model).toBeDefined();
			expect(await registry.getApiKeyForProvider("custom-provider")).toBe("CUSTOM_AAIRIS_KEY");
			expect(await registry.getApiKeyAndHeaders(model!)).toMatchObject({
				ok: true,
				apiKey: "CUSTOM_AAIRIS_KEY",
				headers: {
					"x-aairis-key": "HEADER_AAIRIS_KEY",
					"x-literal": "literal",
					"x-model-key": "MODEL_AAIRIS_KEY",
				},
			});
		} finally {
			for (const key of envKeys) {
				if (savedEnv[key] === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = savedEnv[key];
				}
			}
		}
	});
});
