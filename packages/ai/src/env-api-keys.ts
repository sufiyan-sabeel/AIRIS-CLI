// NEVER convert to top-level imports - breaks browser/Vite builds
let _existsSync: typeof import("node:fs").existsSync | null = null;
let _homedir: typeof import("node:os").homedir | null = null;
let _join: typeof import("node:path").join | null = null;

type DynamicImport = (specifier: string) => Promise<unknown>;

const dynamicImport: DynamicImport = (specifier) => import(specifier);
const NODE_FS_SPECIFIER = "node:" + "fs";
const NODE_OS_SPECIFIER = "node:" + "os";
const NODE_PATH_SPECIFIER = "node:" + "path";

// Eagerly load in Node.js/Bun environment only
if (typeof process !== "undefined" && (process.versions?.node || process.versions?.bun)) {
	dynamicImport(NODE_FS_SPECIFIER).then((m) => {
		_existsSync = (m as typeof import("node:fs")).existsSync;
	});
	dynamicImport(NODE_OS_SPECIFIER).then((m) => {
		_homedir = (m as typeof import("node:os")).homedir;
	});
	dynamicImport(NODE_PATH_SPECIFIER).then((m) => {
		_join = (m as typeof import("node:path")).join;
	});
}

import type { KnownProvider } from "./types.ts";

let _procEnvCache: Map<string, string> | null = null;

/**
 * Fallback for https://github.com/oven-sh/bun/issues/27802
 * Bun compiled binaries have an empty `process.env` inside sandbox
 * environments on Linux. We can recover the env from `/proc/self/environ`.
 */
function getProcEnv(key: string): string | undefined {
	if (!process.versions?.bun) return undefined;
	if (typeof process === "undefined") return undefined;

	// If process.env already has entries, the bug is not triggered.
	if (Object.keys(process.env).length > 0) return undefined;

	if (_procEnvCache === null) {
		_procEnvCache = new Map();
		try {
			const { readFileSync } = require("node:fs") as typeof import("node:fs");
			const data = readFileSync("/proc/self/environ", "utf-8");
			for (const entry of data.split("\0")) {
				const idx = entry.indexOf("=");
				if (idx > 0) {
					_procEnvCache.set(entry.slice(0, idx), entry.slice(idx + 1));
				}
			}
		} catch {
			// /proc/self/environ may not be readable.
		}
	}

	return _procEnvCache.get(key);
}

let cachedVertexAdcCredentialsExists: boolean | null = null;

function hasVertexAdcCredentials(): boolean {
	if (cachedVertexAdcCredentialsExists === null) {
		// If node modules haven't loaded yet (async import race at startup),
		// return false WITHOUT caching so the next call retries once they're ready.
		// Only cache false permanently in a browser environment where fs is never available.
		if (!_existsSync || !_homedir || !_join) {
			const isNode = typeof process !== "undefined" && (process.versions?.node || process.versions?.bun);
			if (!isNode) {
				// Definitively in a browser — safe to cache false permanently
				cachedVertexAdcCredentialsExists = false;
			}
			return false;
		}

		// Check GOOGLE_APPLICATION_CREDENTIALS env var first (standard way)
		const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || getProcEnv("GOOGLE_APPLICATION_CREDENTIALS");
		if (gacPath) {
			cachedVertexAdcCredentialsExists = _existsSync(gacPath);
		} else {
			// Fall back to default ADC path (lazy evaluation)
			cachedVertexAdcCredentialsExists = _existsSync(
				_join(_homedir(), ".config", "gcloud", "application_default_credentials.json"),
			);
		}
	}
	return cachedVertexAdcCredentialsExists;
}

function getApiKeyEnvVars(provider: string): readonly string[] | undefined {
	if (provider === "github-copilot") {
		return ["COPILOT_GITHUB_TOKEN"];
	}

	// ANTHROPIC_OAUTH_TOKEN takes precedence over ANTHROPIC_AAIRIS_KEY
	if (provider === "anthropic") {
		return ["ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_AAIRIS_KEY"];
	}

	const envMap: Record<string, string> = {
		"ant-ling": "ANT_LING_AAIRIS_KEY",
		openai: "OPENAI_AAIRIS_KEY",
		"azure-openai-responses": "AZURE_OPENAI_AAIRIS_KEY",
		nvidia: "NVIDIA_AAIRIS_KEY",
		deepseek: "DEEPSEEK_AAIRIS_KEY",
		google: "GEMINI_AAIRIS_KEY",
		"google-vertex": "GOOGLE_CLOUD_AAIRIS_KEY",
		groq: "GROQ_AAIRIS_KEY",
		cerebras: "CEREBRAS_AAIRIS_KEY",
		xai: "XAI_AAIRIS_KEY",
		openrouter: "OPENROUTER_AAIRIS_KEY",
		"vercel-ai-gateway": "AI_GATEWAY_AAIRIS_KEY",
		zai: "ZAI_AAIRIS_KEY",
		"zai-coding-cn": "ZAI_CODING_CN_AAIRIS_KEY",
		mistral: "MISTRAL_AAIRIS_KEY",
		minimax: "MINIMAX_AAIRIS_KEY",
		"minimax-cn": "MINIMAX_CN_AAIRIS_KEY",
		moonshotai: "MOONSHOT_AAIRIS_KEY",
		"moonshotai-cn": "MOONSHOT_AAIRIS_KEY",
		huggingface: "HF_TOKEN",
		fireworks: "FIREWORKS_AAIRIS_KEY",
		together: "TOGETHER_AAIRIS_KEY",
		opencode: "OPENCODE_AAIRIS_KEY",
		"opencode-go": "OPENCODE_AAIRIS_KEY",
		"kimi-coding": "KIMI_AAIRIS_KEY",
		"cloudflare-workers-ai": "CLOUDFLARE_AAIRIS_KEY",
		"cloudflare-ai-gateway": "CLOUDFLARE_AAIRIS_KEY",
		xiaomi: "XIAOMI_AAIRIS_KEY",
		"xiaomi-token-plan-cn": "XIAOMI_TOKEN_PLAN_CN_AAIRIS_KEY",
		"xiaomi-token-plan-ams": "XIAOMI_TOKEN_PLAN_AMS_AAIRIS_KEY",
		"xiaomi-token-plan-sgp": "XIAOMI_TOKEN_PLAN_SGP_AAIRIS_KEY",
	};

	const envVar = envMap[provider];
	return envVar ? [envVar] : undefined;
}

/**
 * Find configured environment variables that can provide an API key for a provider.
 *
 * This only reports actual API key variables. It intentionally excludes ambient
 * credential sources such as AWS profiles, AWS IAM credentials, and Google
 * Application Default Credentials.
 */
export function findEnvKeys(provider: KnownProvider): string[] | undefined;
export function findEnvKeys(provider: string): string[] | undefined;
export function findEnvKeys(provider: string): string[] | undefined {
	const envVars = getApiKeyEnvVars(provider);
	if (!envVars) return undefined;

	const found = envVars.filter((envVar) => !!process.env[envVar] || !!getProcEnv(envVar));
	return found.length > 0 ? found : undefined;
}

/**
 * Get API key for provider from known environment variables, e.g. OPENAI_AAIRIS_KEY.
 *
 * Will not return API keys for providers that require OAuth tokens.
 */
export function getEnvApiKey(provider: KnownProvider): string | undefined;
export function getEnvApiKey(provider: string): string | undefined;
export function getEnvApiKey(provider: string): string | undefined {
	const envKeys = findEnvKeys(provider);
	if (envKeys?.[0]) {
		return process.env[envKeys[0]] || getProcEnv(envKeys[0]);
	}

	// Vertex AI supports either an explicit API key or Application Default Credentials.
	// Auth is configured via `gcloud auth application-default login`.
	if (provider === "google-vertex") {
		const hasCredentials = hasVertexAdcCredentials();
		const hasProject = !!(
			process.env.GOOGLE_CLOUD_PROJECT ||
			process.env.GCLOUD_PROJECT ||
			getProcEnv("GOOGLE_CLOUD_PROJECT") ||
			getProcEnv("GCLOUD_PROJECT")
		);
		const hasLocation = !!(process.env.GOOGLE_CLOUD_LOCATION || getProcEnv("GOOGLE_CLOUD_LOCATION"));

		if (hasCredentials && hasProject && hasLocation) {
			return "<authenticated>";
		}
	}

	if (provider === "amazon-bedrock") {
		// Amazon Bedrock supports multiple credential sources:
		// 1. AWS_PROFILE - named profile from ~/.aws/credentials
		// 2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY - standard IAM keys
		// 3. AWS_BEARER_TOKEN_BEDROCK - Bedrock bearer token
		// 4. AWS_CONTAINER_CREDENTIALS_RELATIVE_URI - ECS task roles
		// 5. AWS_CONTAINER_CREDENTIALS_FULL_URI - ECS task roles (full URI)
		// 6. AWS_WEB_IDENTITY_TOKEN_FILE - IRSA (IAM Roles for Service Accounts)
		if (
			process.env.AWS_PROFILE ||
			(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
			process.env.AWS_BEARER_TOKEN_BEDROCK ||
			process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
			process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
			process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
			getProcEnv("AWS_PROFILE") ||
			(getProcEnv("AWS_ACCESS_KEY_ID") && getProcEnv("AWS_SECRET_ACCESS_KEY")) ||
			getProcEnv("AWS_BEARER_TOKEN_BEDROCK") ||
			getProcEnv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI") ||
			getProcEnv("AWS_CONTAINER_CREDENTIALS_FULL_URI") ||
			getProcEnv("AWS_WEB_IDENTITY_TOKEN_FILE")
		) {
			return "<authenticated>";
		}
	}

	return undefined;
}
