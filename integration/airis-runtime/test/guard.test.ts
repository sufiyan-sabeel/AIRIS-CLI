/**
 * Permission-boundary tests. Pure: no Pi runtime, no model, no credentials.
 * Covers the cases Milestone 4 requires: denied, allowed and interrupted
 * operations, plus fail-closed behaviour and audit recording.
 */
import { describe, expect, it, vi } from "vitest";
import {
	type AirisAuditRecord,
	createAirisGuard,
	evaluateToolCall,
	matchesPathPattern,
	type AirisPermissionPolicy,
} from "../src/guard.ts";

const policy: AirisPermissionPolicy = {
	denyRead: ["~/.ssh/**", "**/.env"],
	denyWrite: ["**/.env", "**/*.pem"],
	denyExec: ["rm -rf /", "sudo "],
};

describe("denied operations", () => {
	it("blocks reading a denied path", () => {
		const d = evaluateToolCall({ tool: "read", input: { path: `${process.env.HOME}/.ssh/id_rsa` } }, policy);
		expect(d.block).toBe(true);
		expect(d.reason).toContain("read denied");
	});

	it("blocks writing a denied path", () => {
		const d = evaluateToolCall({ tool: "write", input: { path: "/proj/.env" } }, policy);
		expect(d.block).toBe(true);
		expect(d.reason).toContain("write denied");
	});

	it("blocks a denied command", () => {
		const d = evaluateToolCall({ tool: "bash", input: { command: "sudo rm -rf /tmp/x" } }, policy);
		expect(d.block).toBe(true);
		expect(d.reason).toContain("command denied");
	});

	it("blocks a .pem write via the wildcard rule", () => {
		expect(evaluateToolCall({ tool: "edit", input: { path: "/keys/server.pem" } }, policy).block).toBe(true);
	});
});

describe("allowed operations", () => {
	it("allows reading an ordinary path", () => {
		const d = evaluateToolCall({ tool: "read", input: { path: "/proj/src/index.ts" } }, policy);
		expect(d.block).toBe(false);
	});

	it("allows an ordinary command", () => {
		expect(evaluateToolCall({ tool: "bash", input: { command: "ls -la" } }, policy).block).toBe(false);
	});

	it("allows a tool that targets no path or command", () => {
		expect(evaluateToolCall({ tool: "todo", input: {} }, policy).block).toBe(false);
	});
});

describe("fail-closed behaviour", () => {
	it("blocks a malformed call", () => {
		// Empty tool name: type-valid but semantically malformed.
		const d = evaluateToolCall({ tool: "", input: {} }, policy);
		expect(d.block).toBe(true);
		expect(d.reason).toContain("malformed");
	});

	it("blocks when a deny pattern cannot be resolved (~ with no HOME)", () => {
		const original = process.env.HOME;
		delete process.env.HOME;
		try {
			const d = evaluateToolCall({ tool: "read", input: { path: "/etc/passwd" } }, { denyRead: ["~/.ssh/**"] });
			expect(d.block).toBe(true);
		} finally {
			if (original !== undefined) process.env.HOME = original;
		}
	});

	it("honours failClosed: false only when explicitly configured", () => {
		// Empty tool name: type-valid but semantically malformed.
		const d = evaluateToolCall({ tool: "", input: {} }, { failClosed: false });
		expect(d.block).toBe(false);
	});
});

describe("interrupted / aborted operations", () => {
	it("records a tool_result even when the call produced no target", () => {
		const records: AirisAuditRecord[] = [];
		const guard = createAirisGuard({ policy, audit: (r) => records.push(r) });
		guard.onToolResult({ tool: "bash", input: {} });
		expect(records).toHaveLength(1);
		expect(records[0].reason).toBe("tool_result recorded");
	});
});

describe("audit recording", () => {
	it("records allow and deny decisions with tool, decision and reason", () => {
		const records: AirisAuditRecord[] = [];
		const guard = createAirisGuard({
			policy,
			audit: (r) => records.push(r),
			now: () => new Date("2026-11-19T10:00:00Z"),
		});

		guard.onToolCall({ tool: "read", input: { path: "/proj/a.ts" } });
		guard.onToolCall({ tool: "write", input: { path: "/proj/.env" } });

		expect(records).toHaveLength(2);
		expect(records[0]).toMatchObject({ tool: "read", decision: "allow", at: "2026-11-19T10:00:00.000Z" });
		expect(records[1]).toMatchObject({ tool: "write", decision: "deny" });
		expect(records[1].reason).toContain("write denied");
	});

	it("never records file contents or credentials", () => {
		const records: AirisAuditRecord[] = [];
		const guard = createAirisGuard({ policy, audit: (r) => records.push(r) });
		guard.onToolCall({
			tool: "write",
			input: { path: "/proj/.env", content: "API_KEY=sk-super-secret-value" },
		});
		const serialized = JSON.stringify(records);
		expect(serialized).not.toContain("sk-super-secret-value");
		expect(serialized).toContain(".env");
	});

	it("survives a throwing audit sink without changing the decision", () => {
		const guard = createAirisGuard({
			policy,
			audit: () => {
				throw new Error("audit down");
			},
		});
		expect(guard.onToolCall({ tool: "read", input: { path: "/proj/a.ts" } }).block).toBe(false);
	});
});

describe("pattern matching", () => {
	it("matches ** across segments and * within one", () => {
		expect(matchesPathPattern("/a/b/c/.env", "**/.env")).toBe(true);
		expect(matchesPathPattern("/a/.env", "**/.env")).toBe(true);
		expect(matchesPathPattern("/a/b/c.ts", "**/*.ts")).toBe(true);
		expect(matchesPathPattern("/a/b/c.js", "**/*.ts")).toBe(false);
	});
});
