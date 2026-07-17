/**
 * Tests for Project Learning.
 *
 * Covers:
 * - detectProjectFeatures for all supported languages
 * - learnFilePattern and learnCommand
 * - computeConfidence scoring
 * - ProjectLearning class (dedup, rejection, save/load, clear)
 * - getSummary output
 * - Duplicate suppression
 * - Rejection tracking
 * - Edge cases (empty, corrupted)
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeConfidence, detectProjectFeatures, learnCommand, learnFilePattern, ProjectLearning } from "../src/core/project-learning.ts";

// ============================================================================
// detectProjectFeatures Tests
// ============================================================================

describe("detectProjectFeatures", () => {
	it("detects TypeScript + npm for AIRIS-like project", () => {
		// Run against real project
		const features = detectProjectFeatures(".");
		expect(features.language).toBe("typescript");
		expect(features.packageManager).toBe("npm");
	});

	it("detects TypeScript + vitest for coding-agent subpackage", () => {
		const features = detectProjectFeatures("packages/coding-agent");
		expect(features.language).toBe("typescript");
	});

	it("returns empty result for empty directory", () => {
		const dir = mkdtempSync(join(tmpdir(), "pl-test-empty-"));
		try {
			const features = detectProjectFeatures(dir);
			expect(features.language).toBeUndefined();
			expect(features.buildSystem).toBeUndefined();
			expect(features.framework).toBeUndefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects Rust from Cargo.toml", () => {
		const dir = mkdtempSync(join(tmpdir(), "pl-test-rust-"));
		try {
			writeFileSync(join(dir, "Cargo.toml"), '[package]\nname = "test"\n');
			const features = detectProjectFeatures(dir);
			expect(features.language).toBe("rust");
			expect(features.buildSystem).toBe("cargo");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects Go from go.mod", () => {
		const dir = mkdtempSync(join(tmpdir(), "pl-test-go-"));
		try {
			writeFileSync(join(dir, "go.mod"), 'module example.com/test\n');
			const features = detectProjectFeatures(dir);
			expect(features.language).toBe("go");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects Python from requirements.txt", () => {
		const dir = mkdtempSync(join(tmpdir(), "pl-test-py-"));
		try {
			writeFileSync(join(dir, "requirements.txt"), 'flask\n');
			const features = detectProjectFeatures(dir);
			expect(features.language).toBe("python");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects vitest test framework from package.json", () => {
		const dir = mkdtempSync(join(tmpdir(), "pl-test-vitest-"));
		try {
			const pkg = { devDependencies: { vitest: "^1.0.0" } };
			writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
			const features = detectProjectFeatures(dir);
			expect(features.testFramework).toBe("vitest");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("detects React framework", () => {
		const dir = mkdtempSync(join(tmpdir(), "pl-test-react-"));
		try {
			const pkg = { dependencies: { react: "^18.0.0" } };
			writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
			const features = detectProjectFeatures(dir);
			expect(features.framework).toBe("react");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

// ============================================================================
// learnFilePattern Tests
// ============================================================================

describe("learnFilePattern", () => {
	it("tracks file extensions", () => {
		const result = learnFilePattern("src/main.ts", {});
		expect(result["*.ts"]).toBe(1);
	});

	it("increments existing extension counts", () => {
		let patterns = { "*.ts": 5 };
		patterns = learnFilePattern("src/new.ts", patterns);
		expect(patterns["*.ts"]).toBe(6);
	});

	it("tracks directory patterns", () => {
		const result = learnFilePattern("src/core/file.ts", {});
		expect(result["src/"]).toBe(1);
		expect(result["core/"]).toBe(1);
	});

	it("skips node_modules directories", () => {
		const result = learnFilePattern("node_modules/pkg/index.js", {});
		expect(result["node_modules/"]).toBeUndefined();
	});

	it("skips dist and build directories", () => {
		const result1 = learnFilePattern("dist/output.js", {});
		expect(result1["dist/"]).toBeUndefined();
		const result2 = learnFilePattern("build/output.js", {});
		expect(result2["build/"]).toBeUndefined();
	});

	it("handles multiple extensions in multiple files", () => {
		let patterns = {};
		patterns = learnFilePattern("a.ts", patterns);
		patterns = learnFilePattern("b.ts", patterns);
		patterns = learnFilePattern("c.js", patterns);
		expect(patterns["*.ts"]).toBe(2);
		expect(patterns["*.js"]).toBe(1);
	});
});

// ============================================================================
// learnCommand Tests
// ============================================================================

describe("learnCommand", () => {
	it("tracks base commands", () => {
		const result = learnCommand("npm run build", {});
		expect(result["npm"]).toBe(1);
	});

	it("increments existing command counts", () => {
		let cmds = { "npm": 3 };
		cmds = learnCommand("npm test", cmds);
		expect(cmds["npm"]).toBe(4);
	});

	it("extracts first word as command", () => {
		const result = learnCommand("git push origin main", {});
		expect(result["git"]).toBe(1);
		expect(result["push"]).toBeUndefined();
	});

	it("handles empty command gracefully", () => {
		const result = learnCommand("", {});
		expect(Object.keys(result).length).toBe(0);
	});
});

// ============================================================================
// computeConfidence Tests
// ============================================================================

describe("computeConfidence", () => {
	it("returns 0 for zero count", () => {
		expect(computeConfidence(0, 1)).toBe(0);
	});

	it("increases with count", () => {
		const low = computeConfidence(1, 1);
		const high = computeConfidence(10, 1);
		expect(high).toBeGreaterThan(low);
	});

	it("increases with session count", () => {
		const low = computeConfidence(5, 1);
		const high = computeConfidence(5, 10);
		expect(high).toBeGreaterThanOrEqual(low);
	});

	it("returns reduced confidence below significance threshold", () => {
		const below = computeConfidence(1, 1, 3);
		const above = computeConfidence(3, 1, 3);
		expect(above).toBeGreaterThan(below);
	});

	it("caps at 1.0", () => {
		const result = computeConfidence(100, 100);
		expect(result).toBeLessThanOrEqual(1);
	});
});

// ============================================================================
// ProjectLearning Integration Tests
// ============================================================================

describe("ProjectLearning", () => {
	let tempDir: string;
	let pl: ProjectLearning;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "pl-int-"));
		pl = new ProjectLearning(tempDir);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("learns file access patterns", () => {
		pl.learnFileAccess("src/main.ts");
		pl.learnFileAccess("src/utils.ts");
		const profile = pl.profile;
		expect(profile.filePatterns["*.ts"]).toBe(2);
		expect(profile.filePatterns["src/"]).toBe(2);
		expect(profile.dirty).toBe(true);
	});

	it("deduplicates same file path within session", () => {
		pl.learnFileAccess("src/main.ts");
		pl.learnFileAccess("src/main.ts"); // duplicate
		const profile = pl.profile;
		expect(profile.filePatterns["*.ts"]).toBe(1); // counted once
	});

	it("learns commands", () => {
		pl.learnCommand("npm run build");
		pl.learnCommand("npm test");
		const profile = pl.profile;
		expect(profile.commonCommands["npm"]).toBe(2);
	});

	it("deduplicates same command within session", () => {
		pl.learnCommand("npm run build");
		pl.learnCommand("npm run build"); // duplicate
		const profile = pl.profile;
		expect(profile.commonCommands["npm"]).toBe(1);
	});

	it("skips .airis/ internal files", () => {
		pl.learnFileAccess(".airis/settings.json");
		const profile = pl.profile;
		expect(Object.keys(profile.filePatterns).length).toBe(0);
	});

	it("skips files outside project", () => {
		pl.learnFileAccess("../etc/passwd");
		const profile = pl.profile;
		expect(Object.keys(profile.filePatterns).length).toBe(0);
	});

	it("adds conventions", () => {
		pl.addConvention("Use TypeScript strict mode");
		expect(pl.profile.conventions).toContain("Use TypeScript strict mode");
	});

	it("suppresses duplicate conventions", () => {
		pl.addConvention("Test convention");
		pl.addConvention("Test convention");
		expect(pl.profile.conventions.length).toBe(1);
	});

	it("rejects conventions", () => {
		pl.addConvention("Wrong pattern");
		pl.rejectConvention("Wrong pattern");
		expect(pl.profile.conventions).not.toContain("Wrong pattern");
		expect(pl.profile.rejectedPatterns).toContain("Wrong pattern");
	});

	it("prevents re-adding rejected conventions", () => {
		pl.rejectConvention("Bad pattern");
		pl.addConvention("Bad pattern");
		expect(pl.profile.conventions).not.toContain("Bad pattern");
	});

	it("adds notes", () => {
		pl.addNote("Important observation");
		expect(pl.profile.notes).toContain("Important observation");
	});

	it("clears all data", () => {
		pl.learnFileAccess("src/main.ts");
		pl.learnCommand("npm build");
		pl.addConvention("Test");
		pl.addNote("Note");
		pl.clear();
		const profile = pl.profile;
		expect(Object.keys(profile.filePatterns).length).toBe(0);
		expect(Object.keys(profile.commonCommands).length).toBe(0);
		expect(profile.conventions.length).toBe(0);
		expect(profile.notes.length).toBe(0);
	});

	it("persists and reloads from disk", () => {
		pl.learnFileAccess("src/main.ts");
		pl.addConvention("Use strict mode");
		pl.addNote("Important");
		pl.save();
		expect(pl.dirty).toBe(false);

		// Create new instance to reload
		const pl2 = new ProjectLearning(tempDir);
		const profile = pl2.profile;
		expect(profile.filePatterns["*.ts"]).toBe(1);
		expect(profile.conventions).toContain("Use strict mode");
		expect(profile.notes).toContain("Important");
	});

	it("recovers from corrupted profile file", () => {
		// Write invalid JSON
		writeFileSync(join(tempDir, ".airis", "memory", "project-profile.json"), "{invalid}");
		const pl2 = new ProjectLearning(tempDir);
		// Should recover with a fresh profile
		expect(pl2.profile.filePatterns).toBeDefined();
		expect(pl2.profile.sessionCount).toBe(1);
	});

	it("increments session count", () => {
		expect(pl.profile.sessionCount).toBe(1);
		pl.incrementSession();
		expect(pl.profile.sessionCount).toBe(2);
	});

	it("getSummary returns non-empty string", () => {
		pl.learnFileAccess("src/main.ts");
		pl.learnCommand("npm build");
		const summary = pl.getSummary();
		expect(summary.length).toBeGreaterThan(0);
		expect(summary).toContain("Project Profile");
		expect(summary).toContain("*.ts");
		expect(summary).toContain("npm");
	});
});
