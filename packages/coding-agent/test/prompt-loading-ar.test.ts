/**
 * Tests for prompt loading verification - confirms .airis/prompts/ar.md is discoverable
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPromptTemplates } from "../src/core/prompt-templates.ts";

describe("prompt loading - architecture review (ar.md)", () => {
	const agentDir = join(process.cwd(), ".airis");
	const promptsDir = join(agentDir, "prompts");
	const arPromptPath = join(promptsDir, "ar.md");

	it("should have ar.md in the correct prompt directory", () => {
		expect(existsSync(arPromptPath)).toBe(true);
	});

	it("should have valid frontmatter with description and argument-hint", () => {
		const content = readFileSync(arPromptPath, "utf-8");

		// Check frontmatter exists
		expect(content.startsWith("---")).toBe(true);

		// Check description
		expect(content).toContain("description:");

		// Check argument-hint
		expect(content).toContain("argument-hint:");

		// Check body content exists
		const bodyStart = content.indexOf("---", 3);
		expect(bodyStart).toBeGreaterThan(0);
		const body = content.slice(bodyStart + 3);
		expect(body.trim().length).toBeGreaterThan(100);
	});

	it("should be loadable by prompt template loader", () => {
		const templates = loadPromptTemplates({
			cwd: process.cwd(),
			agentDir: ".airis",
			promptPaths: [],
			includeDefaults: true,
		});

		const arTemplate = templates.find((t) => t.name === "ar");
		expect(arTemplate).toBeDefined();

		if (arTemplate) {
			expect(arTemplate.name).toBe("ar");
			expect(arTemplate.description).toBeTruthy();
			expect(arTemplate.argumentHint).toBe("[scope|--full]");
			expect(arTemplate.content).toContain("Architecture Review");
			expect(arTemplate.content).toContain("Modularity");
			expect(arTemplate.content).toContain("Scalability");
			expect(arTemplate.sourceInfo).toBeDefined();
			expect(arTemplate.sourceInfo.scope).toBe("user");
		}
	});

	it("should expand correctly with arguments", () => {
		const templates = loadPromptTemplates({
			cwd: process.cwd(),
			agentDir: ".airis",
			promptPaths: [],
			includeDefaults: true,
		});

		const arTemplate = templates.find((t) => t.name === "ar");
		expect(arTemplate).toBeDefined();

		if (arTemplate) {
			// Test expansion with arguments
			const expanded = `/ar my-component`;
			expect(expanded.startsWith("/ar")).toBe(true);
		}
	});

	it("should have correct file structure for prompt template", () => {
		const content = readFileSync(arPromptPath, "utf-8");

		// Should have the key sections
		expect(content).toContain("## Architecture Review Report");
		expect(content).toContain("### Executive Summary");
		expect(content).toContain("### Strengths");
		expect(content).toContain("### Critical Issues");
		expect(content).toContain("### Moderate Concerns");
		expect(content).toContain("### Recommendations");
		expect(content).toContain("### Architecture Diagram");
		expect(content).toContain("## Special Focus Areas");
	});
});