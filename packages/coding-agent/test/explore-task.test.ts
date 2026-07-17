/**
 * Tests for Explore Task - Multi-language symbol extraction, dependency analysis, metadata scanning
 */

import { describe, expect, it } from "vitest";
import {
	extractSymbols,
	formatExploreResultForContext,
} from "../src/core/adaptive/explore-task.ts";
import type { ExploreTaskResult } from "../src/core/adaptive/types.ts";

describe("Explore Task - Multi-language Symbol Extraction", () => {
	it("extracts TypeScript class", () => {
		const symbols = extractSymbols("export class UserService { }");
		expect(symbols).toContain("UserService");
	});

	it("extracts TypeScript interface", () => {
		const symbols = extractSymbols("export interface Config { }");
		expect(symbols).toContain("Config");
	});

	it("extracts TypeScript function", () => {
		const symbols = extractSymbols("function processData() { }");
		expect(symbols).toContain("processData");
	});

	it("extracts TypeScript arrow const", () => {
		const symbols = extractSymbols("export const handler = () => { }");
		expect(symbols).toContain("handler");
	});

	it("extracts Go function", () => {
		const symbols = extractSymbols("func main() { }");
		expect(symbols).toContain("main");
	});

	it("extracts Go struct", () => {
		const symbols = extractSymbols("type Person struct { }");
		expect(symbols).toContain("Person");
	});

	it("extracts Rust function", () => {
		const symbols = extractSymbols("fn process() { }");
		expect(symbols).toContain("process");
	});

	it("extracts Rust struct", () => {
		const symbols = extractSymbols("struct Config { }");
		expect(symbols).toContain("Config");
	});

	it("extracts Rust trait", () => {
		const symbols = extractSymbols("trait Serializable { }");
		expect(symbols).toContain("Serializable");
	});

	it("extracts Rust enum", () => {
		const symbols = extractSymbols("enum Status { }");
		expect(symbols).toContain("Status");
	});

	it("extracts Python function", () => {
		const symbols = extractSymbols("def calculate_total():");
		expect(symbols).toContain("calculate_total");
	});

	it("extracts Java class", () => {
		const symbols = extractSymbols("public class DataService { }");
		expect(symbols).toContain("DataService");
	});

	it("extracts C function definition", () => {
		const symbols = extractSymbols("int process_data(char* input) {");
		expect(symbols).toContain("process_data");
	});

	it("extracts Ruby method", () => {
		const symbols = extractSymbols("def process_data");
		expect(symbols).toContain("process_data");
	});

	it("extracts PHP function", () => {
		const symbols = extractSymbols("function handleRequest() {");
		expect(symbols).toContain("handleRequest");
	});

	it("extracts Swift class", () => {
		const symbols = extractSymbols("class ViewController {");
		expect(symbols).toContain("ViewController");
	});

	it("limits symbols to 8 per file", () => {
		const content = `
			export class A { }
			export class B { }
			export class C { }
			export class D { }
			export class E { }
			export class F { }
			export class G { }
			export class H { }
			export class I { }
			export class J { }
		`;
		const symbols = extractSymbols(content);
		expect(symbols.length).toBeLessThanOrEqual(8);
	});

	it("extracts Kotlin class via fun pattern", () => {
		const symbols = extractSymbols("fun main() { }");
		expect(symbols).toContain("main");
	});

	it("extracts Scala/PHP-style function", () => {
		const symbols = extractSymbols("function getData() { }");
		expect(symbols).toContain("getData");
	});
});

describe("Explore Task - formatExploreResultForContext", () => {
	it("formats empty result", () => {
		const result: ExploreTaskResult = {
			summary: "No matching files found",
			relevantFilesAndSymbols: [],
			architectureFindings: [],
			risks: [],
			recommendedImplementationLocation: [],
			unknownsRequiringClarification: [],
			metrics: { runtimeMs: 100, toolCalls: 1, filesRead: 0, truncated: false },
		};
		const formatted = formatExploreResultForContext(result);
		expect(formatted).toContain("Explore Task findings");
		expect(formatted).toContain("No matching files found");
		expect(formatted).toContain("100ms");
	});

	it("includes file symbols in formatted output", () => {
		const result: ExploreTaskResult = {
			summary: "Found relevant files",
			relevantFilesAndSymbols: [
				{
					path: "src/main.ts",
					symbols: ["App", "Config"],
					reason: "Matches task keywords",
					fileType: "source",
					detectedLanguage: "typescript",
				},
			],
			architectureFindings: ["Project: my-app (npm)"],
			risks: [],
			recommendedImplementationLocation: ["src/main.ts"],
			unknownsRequiringClarification: [],
			metrics: { runtimeMs: 500, toolCalls: 5, filesRead: 3, truncated: false },
		};
		const formatted = formatExploreResultForContext(result);
		expect(formatted).toContain("src/main.ts");
		expect(formatted).toContain("symbols=App,Config");
		expect(formatted).toContain("type=source");
		expect(formatted).toContain("lang=typescript");
		expect(formatted).toContain("Project: my-app (npm)");
	});

	it("includes dependency info in formatted output", () => {
		const result: ExploreTaskResult = {
			summary: "Found files with deps",
			relevantFilesAndSymbols: [
				{
					path: "src/utils.ts",
					symbols: ["helper", "parse"],
					reason: "Matches keywords",
					sourceDependencies: ["lodash", "axios"],
				},
			],
			architectureFindings: [],
			risks: [],
			recommendedImplementationLocation: ["src/utils.ts"],
			unknownsRequiringClarification: [],
			metrics: { runtimeMs: 300, toolCalls: 3, filesRead: 2, truncated: false },
		};
		const formatted = formatExploreResultForContext(result);
		expect(formatted).toContain("deps=lodash,axios");
	});

	it("includes project metadata", () => {
		const result: ExploreTaskResult = {
			summary: "Project found",
			relevantFilesAndSymbols: [],
			architectureFindings: [],
			risks: [],
			recommendedImplementationLocation: [],
			unknownsRequiringClarification: [],
			projectMetadata: {
				packageManager: "npm",
				projectName: "my-app",
				dependencies: ["react", "express"],
			},
			metrics: { runtimeMs: 200, toolCalls: 2, filesRead: 1, truncated: false },
		};
		const formatted = formatExploreResultForContext(result);
		expect(formatted).toContain("my-app");
		expect(formatted).toContain("npm");
		expect(formatted).toContain("deps: 2");
	});

	it("includes source-test map", () => {
		const result: ExploreTaskResult = {
			summary: "Found files",
			relevantFilesAndSymbols: [],
			architectureFindings: [],
			risks: [],
			recommendedImplementationLocation: [],
			unknownsRequiringClarification: [],
			sourceToTestMap: { "src/foo.ts": ["test/foo.test.ts"] },
			metrics: { runtimeMs: 150, toolCalls: 2, filesRead: 1, truncated: false },
		};
		const formatted = formatExploreResultForContext(result);
		expect(formatted).toContain("Source-Test map");
		expect(formatted).toContain("1 test(s) for src/foo.ts");
	});

	it("includes truncation warning", () => {
		const result: ExploreTaskResult = {
			summary: "Partial result",
			relevantFilesAndSymbols: [],
			architectureFindings: [],
			risks: [],
			recommendedImplementationLocation: [],
			unknownsRequiringClarification: ["Exploration stopped at resource limits"],
			metrics: { runtimeMs: 8000, toolCalls: 80, filesRead: 40, truncated: true },
		};
		const formatted = formatExploreResultForContext(result);
		expect(formatted).toContain("truncated");
	});
});