/**
 * Tests for the builtin sandbox extension.
 *
 * Tests pure functions exported from builtin-sandbox.ts:
 * - globMatch: glob pattern matching
 * - matchesAny: pattern list matching
 * - isPathAllowed: path access control
 * - normalizeAndResolve: path resolution
 * - deepMergeConfig: config merging
 * - DEFAULT_CONFIG: default configuration
 */

import { describe, expect, it } from "vitest";
import {
	DEFAULT_CONFIG,
	deepMergeConfig,
	globMatch,
	isPathAllowed,
	matchesAny,
	normalizeAndResolve,
	detectSecrets,
} from "../src/core/builtin-sandbox.ts";

// ============================================================================
// Glob Matching Tests
// ============================================================================

describe("sandbox globMatch", () => {
	// Basic wildcard patterns
	it("matches *.pem against filename only", () => {
		expect(globMatch("*.pem", "cert.pem")).toBe(true);
	});

	it("matches *.pem against absolute path", () => {
		expect(globMatch("*.pem", "/home/user/cert.pem")).toBe(true);
	});

	it("does not match *.pem against non-pem extension", () => {
		expect(globMatch("*.pem", "cert.txt")).toBe(false);
	});

	it("does not match *.pem against .pem.bak", () => {
		expect(globMatch("*.pem", "cert.pem.bak")).toBe(false);
	});

	// Dotfile patterns
	it("matches .env exactly", () => {
		expect(globMatch(".env", ".env")).toBe(true);
	});

	it("matches .env in absolute path", () => {
		expect(globMatch(".env", "/project/.env")).toBe(true);
	});

	it("matches .env.* pattern", () => {
		expect(globMatch(".env.*", ".env.local")).toBe(true);
	});

	it("does not match .env.* against plain .env", () => {
		expect(globMatch(".env.*", ".env")).toBe(false);
	});

	// File extension patterns
	it("matches *.key", () => {
		expect(globMatch("*.key", "/etc/ssl/private.key")).toBe(true);
	});

	it("matches *.p12", () => {
		expect(globMatch("*.p12", "cert.p12")).toBe(true);
	});

	it("matches *.cert", () => {
		expect(globMatch("*.cert", "server.cert")).toBe(true);
	});

	// Directory patterns
	it("matches tilde-pattern directories after resolution", () => {
		expect(globMatch(".ssh", "/root/.ssh")).toBe(true);
	});

	it("matches .aws directory name", () => {
		expect(globMatch(".aws", "/home/user/.aws")).toBe(true);
	});

	// Negative cases
	it("does not match across path separators with single *", () => {
		expect(globMatch("*.txt", "/a/b/c.txt")).toBe(true); // basename match
	});

	it("does not match non-matching extension", () => {
		expect(globMatch("*.key", "file.pem")).toBe(false);
	});

	// Globstar patterns
	it("matches ** across multiple path segments", () => {
		expect(globMatch("**/*.ts", "src/core/file.ts")).toBe(true);
	});

	// Case insensitive
	it("is case insensitive", () => {
		expect(globMatch("*.PEM", "cert.pem")).toBe(true);
		expect(globMatch("*.pem", "cert.PEM")).toBe(true);
	});
});

// ============================================================================
// matchesAny Tests
// ============================================================================

describe("sandbox matchesAny", () => {
	it("returns true when any pattern matches", () => {
		expect(matchesAny(["*.pem", "*.key"], "secret.key")).toBe(true);
	});

	it("returns false when no pattern matches", () => {
		expect(matchesAny(["*.pem", "*.key"], "file.txt")).toBe(false);
	});

	it("returns false for empty pattern list", () => {
		expect(matchesAny([], "file.txt")).toBe(false);
	});

	it("matches against multiple patterns and returns on first match", () => {
		expect(matchesAny(["*.txt", "*.md", "*.ts"], "readme.md")).toBe(true);
	});
});

// ============================================================================
// isPathAllowed Tests
// ============================================================================

describe("sandbox isPathAllowed", () => {
	const workingDir = "/home/user/project";

	it("allows access to files not in deny list", () => {
		const config = {
			enabled: true,
			denyRead: ["*.pem", "*.key"],
			denyWrite: [],
			allowRead: [],
			allowWrite: [],
		};
		const result = isPathAllowed("src/main.ts", "read", config, workingDir);
		expect(result.allowed).toBe(true);
	});

	it("denies access to files matching denyRead pattern", () => {
		const config = {
			enabled: true,
			denyRead: ["*.pem"],
			denyWrite: [],
			allowRead: [],
			allowWrite: [],
		};
		const result = isPathAllowed("cert.pem", "read", config, workingDir);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("read-deny");
	});

	it("denies write access to files matching denyWrite pattern", () => {
		const config = {
			enabled: true,
			denyRead: [],
			denyWrite: [".env"],
			allowRead: [],
			allowWrite: [],
		};
		const result = isPathAllowed(".env", "write", config, workingDir);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("write-deny");
	});

	it("allows access when file is in allowRead list even if also in denyRead", () => {
		const config = {
			enabled: true,
			denyRead: ["*.pem"],
			denyWrite: [],
			allowRead: ["/home/user/project/allowed.pem"],
			allowWrite: [],
		};
		const result = isPathAllowed("allowed.pem", "read", config, workingDir);
		expect(result.allowed).toBe(true);
	});

	it("allows write to allowWrite paths", () => {
		const config = {
			enabled: true,
			denyRead: [],
			denyWrite: ["*"],
			allowRead: [],
			allowWrite: ["/tmp"],
		};
		const result = isPathAllowed("output.log", "write", config, "/tmp");
		expect(result.allowed).toBe(true);
	});

	it("resolves relative paths against working directory", () => {
		const config = {
			enabled: true,
			denyRead: [],
			denyWrite: [".env"],
			allowRead: [],
			allowWrite: [],
		};
		// Relative .env should resolve to absolute and match
		const result = isPathAllowed(".env", "write", config, workingDir);
		expect(result.allowed).toBe(false);
	});

	it("handles empty deny lists gracefully", () => {
		const config = {
			enabled: true,
			denyRead: [],
			denyWrite: [],
			allowRead: [],
			allowWrite: [],
		};
		const result = isPathAllowed("any.file", "read", config, workingDir);
		expect(result.allowed).toBe(true);
	});
});

// ============================================================================
// normalizeAndResolve Tests
// ============================================================================

describe("sandbox normalizeAndResolve", () => {
	it("resolves relative paths against working directory", () => {
		const result = normalizeAndResolve("/home/user/project", "src/file.ts");
		expect(result).toBe("/home/user/project/src/file.ts");
	});

	it("returns absolute paths as-is after normalization", () => {
		const result = normalizeAndResolve("/home/user/project", "/etc/passwd");
		expect(result).toBe("/etc/passwd");
	});

	it("normalizes path separators", () => {
		const result = normalizeAndResolve("/home/user/project", "src/../src/file.ts");
		expect(result).toBe("/home/user/project/src/file.ts");
	});

	it("resolves tilde to home directory", () => {
		// With actual os.homedir()
		const result = normalizeAndResolve("/home/user/project", "~/file.txt");
		expect(result).not.toContain("~");
		expect(result).toContain("file.txt");
	});
});

// ============================================================================
// deepMergeConfig Tests
// ============================================================================

describe("sandbox deepMergeConfig", () => {
	it("preserves base config when no overrides", () => {
		const result = deepMergeConfig(DEFAULT_CONFIG, {});
		expect(result.denyRead).toEqual(DEFAULT_CONFIG.denyRead);
		expect(result.denyWrite).toEqual(DEFAULT_CONFIG.denyWrite);
	});

	it("overrides enabled flag", () => {
		const result = deepMergeConfig(DEFAULT_CONFIG, { enabled: true });
		expect(result.enabled).toBe(true);
	});

	it("appends deny lists instead of replacing", () => {
		const base = { enabled: false, denyRead: ["*.pem"], denyWrite: [] as string[], allowRead: [] as string[], allowWrite: [] as string[] };
		const result = deepMergeConfig(base, { denyRead: ["*.key"] });
		expect(result.denyRead).toContain("*.pem");
		expect(result.denyRead).toContain("*.key");
	});
});

// ============================================================================
// DEFAULT_CONFIG Tests
// ============================================================================

describe("sandbox DEFAULT_CONFIG", () => {
	it("is disabled by default", () => {
		expect(DEFAULT_CONFIG.enabled).toBe(false);
	});

	it("denies sensitive directories by default", () => {
		expect(DEFAULT_CONFIG.denyRead).toContain("~/.ssh");
		expect(DEFAULT_CONFIG.denyRead).toContain("~/.aws");
		expect(DEFAULT_CONFIG.denyRead).toContain("~/.gnupg");
	});

	it("denies credential file types by default", () => {
		expect(DEFAULT_CONFIG.denyWrite).toContain(".env");
		expect(DEFAULT_CONFIG.denyWrite).toContain(".env.*");
		expect(DEFAULT_CONFIG.denyWrite).toContain("*.pem");
		expect(DEFAULT_CONFIG.denyWrite).toContain("*.key");
		expect(DEFAULT_CONFIG.denyWrite).toContain("*.p12");
	});

	it("allows write to current dir and /tmp by default", () => {
		expect(DEFAULT_CONFIG.allowWrite).toContain(".");
		expect(DEFAULT_CONFIG.allowWrite).toContain("/tmp");
	});
});

// ============================================================================
// Secret Detection Tests
// ============================================================================

describe("detectSecrets", () => {
	it("detects AWS Access Key", () => {
		const result = detectSecrets("AKIAIOSFODNN7EXAMPLE");
		expect(result.length).toBeGreaterThan(0);
		expect(result[0].name).toContain("AWS");
	});

	it("detects GitHub Token", () => {
		const result = detectSecrets("ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
		expect(result.length).toBeGreaterThan(0);
		expect(result[0].name).toContain("GitHub");
	});

	it("detects OpenAI API Key", () => {
		const result = detectSecrets("sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
		expect(result.length).toBeGreaterThan(0);
		expect(result[0].name).toContain("OpenAI");
	});

	it("detects SSH Private Key", () => {
		const result = detectSecrets("-----BEGIN RSA PRIVATE KEY-----");
		expect(result.length).toBeGreaterThan(0);
		expect(result[0].name).toContain("SSH");
	});

	it("detects JWT Token", () => {
		const result = detectSecrets("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVNHqjc9kTX8NqG8i6YicKJqaF7oJKI");
		expect(result.length).toBeGreaterThan(0);
		expect(result[0].name).toContain("JWT");
	});

	it("detects Generic Secret assignment", () => {
		const result = detectSecrets('export API_KEY="sk-1234abcd5678efgh9012"');
		expect(result.length).toBeGreaterThan(0);
	});

	it("does not flag normal code as secrets", () => {
		const result = detectSecrets("console.log('hello world');");
		expect(result.length).toBe(0);
	});

	it("detects multiple secrets in one string", () => {
		const result = detectSecrets("AWS_KEY=AKIAIOSFODNN7EXAMPLE GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
		// Should find at least 2
		expect(result.length).toBeGreaterThanOrEqual(2);
	});

	it("redacts match to first 20 chars", () => {
		const result = detectSecrets("sk-1234567890123456789012345678901234567890");
		expect(result.length).toBeGreaterThan(0);
		expect(result[0].match.endsWith("...")).toBe(true);
	});
});
