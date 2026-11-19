/**
 * AIRIS permission boundary for Pi tool execution.
 *
 * This module is deliberately free of Pi imports: it decides *whether* a tool
 * call is allowed, and records the decision. Attaching it to Pi happens through
 * Pi's own `tool_call` / `tool_result` extension events, whose result shape is
 * `{ block?: boolean; reason?: string; terminate?: boolean }`
 * (vendor/pi/packages/coding-agent/src/core/extensions/types.ts:1475).
 *
 * Design rules:
 *  - Deny by default when a rule matches.
 *  - Fail closed: any evaluation error blocks the call.
 *  - Every decision is recorded, allowed or denied.
 *  - Secrets are never copied into audit records.
 */

/** A tool call as the permission layer sees it. */
export interface AirisToolCall {
	/** Tool name, e.g. "bash", "read", "write", "edit". */
	tool: string;
	/** Tool input, already parsed by the runtime. */
	input: Record<string, unknown>;
}

/** Permission policy, derived from AIRIS's own sandbox configuration. */
export interface AirisPermissionPolicy {
	/** Path patterns the runtime may not read. */
	denyRead?: readonly string[];
	/** Path patterns the runtime may not write. */
	denyWrite?: readonly string[];
	/** Shell command patterns that may never run. */
	denyExec?: readonly string[];
	/** When true (default) an evaluation error blocks the call. */
	failClosed?: boolean;
}

/** One audit record. Contains no credentials and no file contents. */
export interface AirisAuditRecord {
	/** ISO timestamp of the decision. */
	at: string;
	/** Tool name. */
	tool: string;
	/** "allow" or "deny". */
	decision: "allow" | "deny";
	/** Why the decision was made, when denied. */
	reason?: string;
	/** The path or command the decision applied to, when one was identified. */
	target?: string;
}

/** Receives audit records. Must not throw; the guard never depends on it succeeding. */
export type AirisAuditSink = (record: AirisAuditRecord) => void;

export interface AirisGuardDecision {
	block: boolean;
	reason?: string;
	target?: string;
}

const PATH_TOOLS_READ = new Set(["read", "glob", "grep", "list"]);
const PATH_TOOLS_WRITE = new Set(["write", "edit", "multi_edit"]);
const EXEC_TOOLS = new Set(["bash", "shell", "exec"]);

/** Extracts the path a tool call targets, if any. */
export function targetPathOf(call: AirisToolCall): string | undefined {
	const input = call.input ?? {};
	for (const key of ["path", "file_path", "filePath", "file", "target"]) {
		const value = input[key];
		if (typeof value === "string" && value.length > 0) return value;
	}
	return undefined;
}

/** Extracts the command a shell tool would run, if any. */
export function targetCommandOf(call: AirisToolCall): string | undefined {
	const input = call.input ?? {};
	const value = input.command ?? input.cmd ?? input.script;
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Matches a path against a deny pattern.
 * Supports exact paths, `*` within a segment, `**` across segments and a
 * leading `~` for the home directory. Matching is intentionally conservative:
 * an unparseable pattern is treated as a match (fail closed).
 */
export function matchesPathPattern(path: string, pattern: string): boolean {
	try {
		let normalizedPath = path.replace(/\\/g, "/");
		let normalizedPattern = pattern.replace(/\\/g, "/");
		if (normalizedPattern.startsWith("~/")) {
			const home = process.env.HOME ?? "";
			if (!home) return true; // cannot resolve ~ => fail closed
			normalizedPattern = `${home.replace(/\\/g, "/")}/${normalizedPattern.slice(2)}`;
		}
		const escaped = normalizedPattern
			.split("**")
			.map((part) =>
				part
					.split("*")
					.map((chunk) => chunk.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
					.join("[^/]*"),
			)
			.join(".*");
		return new RegExp(`^${escaped}$`).test(normalizedPath) || normalizedPath.includes(normalizedPattern.replace(/\*/g, ""));
	} catch {
		return true;
	}
}

/** Matches a shell command against a deny pattern (substring, case-insensitive). */
export function matchesCommandPattern(command: string, pattern: string): boolean {
	try {
		return command.toLowerCase().includes(pattern.toLowerCase());
	} catch {
		return true;
	}
}

/**
 * Decides whether a tool call may proceed.
 * Throws nothing: any internal error is turned into a denial (fail closed).
 */
export function evaluateToolCall(
	call: AirisToolCall,
	policy: AirisPermissionPolicy,
): AirisGuardDecision {
	const failClosed = policy.failClosed ?? true;
	try {
		if (!call || typeof call.tool !== "string" || call.tool.length === 0) {
			return failClosed
				? { block: true, reason: "malformed tool call" }
				: { block: false };
		}

		const path = targetPathOf(call);
		const command = targetCommandOf(call);

		if (path && PATH_TOOLS_READ.has(call.tool)) {
			for (const pattern of policy.denyRead ?? []) {
				if (matchesPathPattern(path, pattern)) {
					return { block: true, reason: `read denied by rule "${pattern}"`, target: path };
				}
			}
		}

		if (path && PATH_TOOLS_WRITE.has(call.tool)) {
			for (const pattern of policy.denyWrite ?? []) {
				if (matchesPathPattern(path, pattern)) {
					return { block: true, reason: `write denied by rule "${pattern}"`, target: path };
				}
			}
		}

		if (EXEC_TOOLS.has(call.tool) && command) {
			for (const pattern of policy.denyExec ?? []) {
				if (matchesCommandPattern(command, pattern)) {
					return { block: true, reason: `command denied by rule "${pattern}"`, target: command };
				}
			}
		}

		return { block: false, target: path ?? command };
	} catch {
		return failClosed
			? { block: true, reason: "permission evaluation failed (fail closed)" }
			: { block: false };
	}
}

/**
 * Creates the handlers AIRIS attaches to Pi's `tool_call` and `tool_result`
 * extension events. Every decision is written to the audit sink.
 */
export function createAirisGuard(options: {
	policy: AirisPermissionPolicy;
	audit?: AirisAuditSink;
	now?: () => Date;
}): {
	onToolCall: (call: AirisToolCall) => AirisGuardDecision;
	onToolResult: (call: AirisToolCall) => void;
} {
	const now = options.now ?? (() => new Date());
	const emit = (record: AirisAuditRecord): void => {
		try {
			options.audit?.(record);
		} catch {
			// An audit sink failure must never allow a call through silently, but it
			// also must not crash the runtime; the decision itself is unaffected.
		}
	};

	return {
		onToolCall(call: AirisToolCall): AirisGuardDecision {
			const decision = evaluateToolCall(call, options.policy);
			emit({
				at: now().toISOString(),
				tool: call?.tool ?? "unknown",
				decision: decision.block ? "deny" : "allow",
				reason: decision.reason,
				target: decision.target,
			});
			return decision;
		},
		onToolResult(call: AirisToolCall): void {
			emit({
				at: now().toISOString(),
				tool: call?.tool ?? "unknown",
				decision: "allow",
				reason: "tool_result recorded",
				target: targetPathOf(call) ?? targetCommandOf(call),
			});
		},
	};
}
