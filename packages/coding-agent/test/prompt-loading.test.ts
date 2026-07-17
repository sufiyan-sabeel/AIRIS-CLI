/**
 * Tests for architecture review prompt loading (ar.md)
 * Verifies that .airis/prompts/ar.md is discoverable by the prompt loader
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPromptTemplates } from "../src/core/prompt-templates.ts";

describe("Architecture Review Prompt Loading (ar.md)", () => {
	const projectRoot = process.cwd();
	const agentDir = join(projectRoot, ".airis");
	const promptsDir = join(agentDir, "prompts");
	const arPromptPath = join(promptsDir, "ar.md");

	it("should exist at the correct location", () => {
		expect(existsSync(arPromptPath)).toBe(true);
	});

	it("should be a valid markdown file with frontmatter", () => {
		const content = readFileSync(arPromptPath, "utf-8");

		// Should have frontmatter
		expect(content).toMatch(/^---/);
		expect(content).toMatch(/description:/);
		expect(content).toMatch(/argument-hint:/);
	});

	it("should be loadable by prompt template loader", () => {
		const templates = loadPromptTemplates({
			cwd: projectRoot,
			agentDir,
			promptPaths: [],
			includeDefaults: true,
		});

		// Find the ar template
		const arTemplate = templates.find((t) => t.name === "ar");
		expect(arTemplate).toBeDefined();
		expect(arTemplate?.name).toBe("ar");
		expect(arTemplate?.description).toContain("architecture review");
		expect(arTemplate?.argumentHint).toBe("[scope|--full]");
	});

	it("should have correct source info", () => {
		const templates = loadPromptTemplates({
			cwd: projectRoot,
			agentDir,
			promptPaths: [],
			includeDefaults: true,
		});

		const arTemplate = templates.find((t) => t.name === "ar");
		expect(arTemplate).toBeDefined();

		// Should be from local/user scope
		expect(arTemplate?.sourceInfo.source).toBe("local");
		expect(arTemplate?.sourceInfo.scope).toBe("user");
		expect(arTemplate?.sourceInfo.baseDir).toBe(promptsDir);
	});

	it("should be expandable as a prompt template", () => {
		const templates = loadPromptTemplates({
			cwd: projectRoot,
			agentDir,
			promptPaths: [],
			includeDefaults: true,
		});

		const arTemplate = templates.find((t) => t.name === "ar");
		expect(arTemplate).toBeDefined();

		// Test expansion with arguments
		const expanded = arTemplate!.content.replace(/\$\{1\}/g, "test scope");
		expect(expanded).toContain("test scope");
	});

	it("should contain the expected review criteria sections", () => {
		const content = readFileSync(arPromptPath, "utf-8");

		// Check for key architectural review sections
		expect(content).toContain("Modularity & Separation of Concerns");
		expect(content).toContain("Scalability & Extensibility");
		expect(content).toContain("Maintainability");
		expect(content).toContain("Performance Considerations");
		expect(content).toContain("Reliability & Error Handling");
		expect(content).toContain("Security");
		expect(content).toContain("Testing & Quality");
	});

	it("should have proper output format specification", () => {
		const content = readFileSync(arPromptPath, "utf-8");

		expect(content).toContain("Architecture Review Report");
		expect(content).toContain("Executive Summary");
		expect(content).toContain("Strengths");
		expect(content).toContain("Critical Issues");
		expect(content).toContain("Moderate Concerns");
		expect(content).toContain("Recommendations");
		expect(content).toContain("Architecture Diagram");
	});

	it("should reference special focus areas for AIRIS components", () => {
		const content = readFileSync(arPromptPath, "utf-8");

		expect(content).toContain("Extension System");
		expect(content).toContain("Provider System");
		expect(content).toContain("Tool System");
		expect(content).toContain("Session Management");
		expect(content).toContain("TUI/Interactive Mode");
		expect(content).toContain("Configuration");
	});
});
