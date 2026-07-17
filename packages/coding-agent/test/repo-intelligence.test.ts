import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changeImpact, indexRepository, summarizeRepository } from "../src/core/repo-intelligence.ts";

let root: string;

beforeEach(() => {
	root = join(tmpdir(), `airis-repo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(join(root, "src"), { recursive: true });
	mkdirSync(join(root, "tests"), { recursive: true });
	writeFileSync(join(root, "src", "util.ts"), "export const x = 2;\n");
	writeFileSync(join(root, "src", "index.ts"), 'import { x } from "./util.ts";\nexport const a = x + 1;\n');
	writeFileSync(join(root, "src", "main.ts"), 'import { a } from "./index.ts";\nconsole.log(a);\n');
	writeFileSync(join(root, "tests", "foo.test.ts"), 'import { a } from "../src/index.ts";\nexport {};\n');
	writeFileSync(join(root, "README.md"), "# project\n");
});

afterEach(() => {
	if (existsSync(root)) rmSync(root, { recursive: true, force: true });
});

describe("indexRepository", () => {
	it("counts files and languages", () => {
		const index = indexRepository(root);
		expect(index.fileCount).toBeGreaterThanOrEqual(4);
		expect(index.languages[".ts"].files).toBe(4);
		expect(index.languages[".md"].files).toBe(1);
	});

	it("detects entry points", () => {
		const index = indexRepository(root);
		expect(index.entryPoints).toEqual(expect.arrayContaining(["src/index.ts", "src/main.ts"]));
	});

	it("builds an import graph", () => {
		const index = indexRepository(root);
		expect(index.importGraph["src/index.ts"]).toEqual(["src/util.ts"]);
		expect(index.importGraph["src/main.ts"]).toEqual(["src/index.ts"]);
		expect(index.importGraph["tests/foo.test.ts"]).toEqual(["src/index.ts"]);
	});
});

describe("changeImpact", () => {
	it("computes transitive reverse dependencies", () => {
		const index = indexRepository(root);
		const impacted = changeImpact(index, ["src/util.ts"]);
		expect(impacted).toEqual(expect.arrayContaining(["src/index.ts", "src/main.ts", "tests/foo.test.ts"]));
	});

	it("returns empty when nothing imports the file", () => {
		const index = indexRepository(root);
		const impacted = changeImpact(index, ["README.md"]);
		expect(impacted).toEqual([]);
	});
});

describe("summarizeRepository", () => {
	it("renders a summary", () => {
		const index = indexRepository(root);
		const summary = summarizeRepository(index);
		expect(summary).toContain("Repository Summary");
		expect(summary).toContain("src");
	});
});
