/**
 * Self-Debug Brain - Automatic error analysis and recovery for AIRIS.
 *
 * When errors occur during tool execution or agent operations, this module:
 * 1. Captures error context (tool, args, error message, stack trace)
 * 2. Analyzes error patterns to identify root causes
 * 3. Generates debugging steps to understand the issue
 * 4. Attempts auto-fix when safe and appropriate
 * 5. Learns from past errors to improve future debugging
 */

import { type Static, Type } from "typebox";

// ============================================================================
// Types
// ============================================================================

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorCategory =
	| "syntax"
	| "runtime"
	| "type"
	| "import"
	| "network"
	| "permission"
	| "resource"
	| "logic"
	| "unknown";

export interface ErrorContext {
	toolName: string;
	toolCallId: string;
	args: unknown;
	errorMessage: string;
	errorStack?: string;
	timestamp: number;
	cwd: string;
	/** Related files that might be affected */
	relatedFiles?: string[];
	/** Previous attempts that failed */
	previousAttempts?: string[];
}

export interface ErrorAnalysis {
	category: ErrorCategory;
	severity: ErrorSeverity;
	rootCause: string;
	affectedFiles: string[];
	suggestedFixes: SuggestedFix[];
	confidence: number;
	/** Pattern ID if this matches a known pattern */
	patternId?: string;
	/** Whether this error has been seen before in this session */
	isRecurring: boolean;
}

export interface SuggestedFix {
	type: "auto" | "guided" | "manual";
	description: string;
	/** Commands or code to apply the fix */
	actions: FixAction[];
	/** Risk level of applying this fix */
	risk: "safe" | "moderate" | "risky";
	/** Whether user confirmation is required */
	requiresConfirmation: boolean;
}

export interface FixAction {
	type: "edit" | "bash" | "read" | "write";
	/** For edit: file path, old text, new text */
	filePath?: string;
	oldText?: string;
	newText?: string;
	/** For bash: command to run */
	command?: string;
	/** For read: file path to read */
	path?: string;
	/** For write: file path and content */
	content?: string;
}

export interface DebugSession {
	id: string;
	originalError: ErrorContext;
	analysis: ErrorAnalysis;
	attempts: DebugAttempt[];
	status: "in_progress" | "resolved" | "abandoned";
	resolvedAt?: number;
	createdAt: number;
}

export interface DebugAttempt {
	id: number;
	action: FixAction;
	result: "success" | "failure" | "skipped";
	output?: string;
	timestamp: number;
}

export interface ErrorPattern {
	id: string;
	regex: RegExp;
	category: ErrorCategory;
	severity: ErrorSeverity;
	commonCauses: string[];
	suggestedFixes: Omit<SuggestedFix, "risk" | "requiresConfirmation">[];
}

// ============================================================================
// Error Patterns Database
// ============================================================================

const ERROR_PATTERNS: ErrorPattern[] = [
	// Syntax errors
	{
		id: "syntax-error-ts",
		regex: /SyntaxError.*Unexpected token|error TS\d{4}:/i,
		category: "syntax",
		severity: "medium",
		commonCauses: [
			"Missing semicolon or bracket",
			"Invalid TypeScript syntax",
			"Malformed code near the reported line",
		],
		suggestedFixes: [
			{
				type: "guided",
				description: "Read the file and fix syntax errors",
				actions: [],
			},
		],
	},
	// Type errors
	{
		id: "type-error-ts",
		regex: /error TS\d{4}:|Type '.+' is not assignable to type|Property '.+' does not exist/i,
		category: "type",
		severity: "medium",
		commonCauses: [
			"Type mismatch between expected and actual",
			"Missing type definition",
			"Strict type checking violation",
		],
		suggestedFixes: [
			{
				type: "guided",
				description: "Analyze type error and update types",
				actions: [],
			},
		],
	},
	// Edit replacement errors
	{
		id: "edit-match-error",
		regex: /oldText.*(?:match|unique)|No exact match|replacement.*failed|Failed to edit|edit.*not found/i,
		category: "logic",
		severity: "medium",
		commonCauses: [
			"Edit replacement text no longer matches the current file content",
			"The selected replacement region is not unique",
			"The file changed after the edit was planned",
		],
		suggestedFixes: [
			{
				type: "guided",
				description: "Read the current file and retry with a smaller exact replacement",
				actions: [],
			},
		],
	},
	// Import errors
	{
		id: "import-error",
		regex: /Cannot find module|Module not found|ERR_MODULE_NOT_FOUND|ENOENT.*node_modules/i,
		category: "import",
		severity: "medium",
		commonCauses: ["Module not installed", "Import path typo", "Missing dependency"],
		suggestedFixes: [
			{
				type: "auto",
				description: "Install missing dependency",
				actions: [{ type: "bash", command: "npm install {module}" }],
			},
		],
	},
	// Command timeouts and hangs
	{
		id: "process-timeout",
		regex: /Command timed out after|timed out after \d+(?:ms| seconds?)|Test timed out|Timeout \d+ms/i,
		category: "runtime",
		severity: "high",
		commonCauses: [
			"The command exceeded its allowed runtime or spawned a hanging process",
			"A verification command is waiting on external resources or interactive input",
			"The timeout is too short for the requested operation",
		],
		suggestedFixes: [
			{
				type: "guided",
				description: "Isolate the hanging step or rerun the narrowest verification with an appropriate timeout",
				actions: [],
			},
		],
	},
	// Network errors
	{
		id: "network-error",
		regex: /ECONNREFUSED|ETIMEDOUT|fetch failed|network error|ECONNRESET/i,
		category: "network",
		severity: "high",
		commonCauses: ["Server unavailable", "Network connectivity issue", "Firewall blocking connection"],
		suggestedFixes: [
			{
				type: "guided",
				description: "Check network connectivity and server status",
				actions: [],
			},
		],
	},
	// Permission errors
	{
		id: "permission-error",
		regex: /EACCES|Permission denied|Operation not permitted/i,
		category: "permission",
		severity: "high",
		commonCauses: ["Insufficient file permissions", "Running as wrong user", "File locked by another process"],
		suggestedFixes: [
			{
				type: "guided",
				description: "Check file permissions and ownership",
				actions: [{ type: "bash", command: "ls -la {file}" }],
			},
		],
	},
	// Resource errors
	{
		id: "resource-error",
		regex: /ENOENT|EEXIST|EMFILE|ENOSPC|out of memory/i,
		category: "resource",
		severity: "high",
		commonCauses: ["File or directory not found", "Disk space full", "Too many open files"],
		suggestedFixes: [
			{
				type: "guided",
				description: "Check file existence and disk space",
				actions: [{ type: "bash", command: "df -h" }],
			},
		],
	},
	// Test/build failures
	{
		id: "test-failure",
		regex: /FAIL|failing|test.*failed|assertion.*error|expect.*received/i,
		category: "logic",
		severity: "medium",
		commonCauses: ["Test expectation mismatch", "Logic error in implementation", "Test environment issue"],
		suggestedFixes: [
			{
				type: "guided",
				description: "Analyze test failure and fix implementation",
				actions: [],
			},
		],
	},
];

// ============================================================================
// Self-Debug Brain Controller
// ============================================================================

export class SelfDebugBrain {
	private debugSessions: Map<string, DebugSession> = new Map();
	private errorHistory: ErrorContext[] = [];
	private learnedPatterns: Map<string, number> = new Map();
	private readonly maxHistorySize = 50;

	/**
	 * Analyze an error and generate debugging recommendations.
	 */
	analyzeError(context: ErrorContext): ErrorAnalysis {
		// Check history before recording the current error so first occurrences are not marked recurring.
		const isRecurring = this.isRecurringError(context);

		// Match against known patterns
		const matchedPattern = this.matchErrorPattern(context);

		// Extract affected files from context
		const affectedFiles = this.extractAffectedFiles(context);

		// Generate root cause hypothesis
		const rootCause = this.hypothesizeRootCause(context, matchedPattern);

		// Generate suggested fixes
		const suggestedFixes = this.generateFixes(context, matchedPattern, affectedFiles);

		// Calculate confidence based on pattern match and history
		const confidence = this.calculateConfidence(matchedPattern, isRecurring);

		const analysis = {
			category: matchedPattern?.category ?? "unknown",
			severity: matchedPattern?.severity ?? this.estimateSeverity(context),
			rootCause,
			affectedFiles,
			suggestedFixes,
			confidence,
			patternId: matchedPattern?.id,
			isRecurring,
		};
		this.recordError(context);
		return analysis;
	}

	/**
	 * Create a debug session for tracking resolution attempts.
	 */
	createDebugSession(context: ErrorContext, analysis: ErrorAnalysis): DebugSession {
		const session: DebugSession = {
			id: `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			originalError: context,
			analysis,
			attempts: [],
			status: "in_progress",
			createdAt: Date.now(),
		};
		this.debugSessions.set(session.id, session);
		return session;
	}

	getSession(sessionId: string): DebugSession | undefined {
		return this.debugSessions.get(sessionId);
	}

	/**
	 * Record a debug attempt and update session status.
	 */
	recordAttempt(
		sessionId: string,
		action: FixAction,
		result: DebugAttempt["result"],
		output?: string,
	): DebugSession | undefined {
		const session = this.debugSessions.get(sessionId);
		if (!session) return undefined;

		const attempt: DebugAttempt = {
			id: session.attempts.length + 1,
			action,
			result,
			output,
			timestamp: Date.now(),
		};
		session.attempts.push(attempt);

		// Update status based on result
		if (result === "success") {
			session.status = "resolved";
			session.resolvedAt = Date.now();
			// Learn from successful fix
			this.learnFromResolution(session);
		} else if (session.attempts.filter((attempt) => attempt.result === "failure").length >= 3) {
			// Max failed attempts reached. Skipped attempts are informational and should not abandon a session.
			session.status = "abandoned";
		}

		return session;
	}

	/**
	 * Generate debugging context for the agent to use.
	 */
	formatDebugContext(analysis: ErrorAnalysis, session?: DebugSession): string {
		const lines = [
			"## Self-Debug Analysis",
			...(session ? [`**Session:** ${session.id}`] : []),
			`**Category:** ${analysis.category}`,
			`**Severity:** ${analysis.severity}`,
			`**Confidence:** ${Math.round(analysis.confidence * 100)}%`,
			`**Root Cause Hypothesis:** ${analysis.rootCause}`,
		];

		if (analysis.isRecurring) {
			lines.push("**Note:** This error has occurred before in this session.");
		}

		if (analysis.affectedFiles.length > 0) {
			lines.push(`**Affected Files:** ${analysis.affectedFiles.join(", ")}`);
		}

		if (analysis.suggestedFixes.length > 0) {
			lines.push("\n### Suggested Fixes:");
			for (const fix of analysis.suggestedFixes) {
				const riskBadge = fix.risk === "safe" ? "[SAFE]" : fix.risk === "moderate" ? "[MODERATE]" : "[RISKY]";
				lines.push(`- ${riskBadge} ${fix.description}`);
				if (fix.actions.length > 0) {
					for (const action of fix.actions) {
						if (action.type === "bash" && action.command) {
							lines.push(`  - Command: \`${action.command}\``);
						} else if (action.type === "edit" && action.filePath) {
							lines.push(`  - Edit: ${action.filePath}`);
						}
					}
				}
			}
		}

		if (session && session.attempts.length > 0) {
			lines.push("\n### Previous Attempts:");
			for (const attempt of session.attempts) {
				const statusIcon =
					attempt.result === "success" ? "[OK]" : attempt.result === "failure" ? "[FAIL]" : "[SKIP]";
				lines.push(`- ${statusIcon} Attempt ${attempt.id}: ${attempt.action.type}`);
				if (attempt.output) {
					lines.push(`  - Output: ${attempt.output.slice(0, 200)}`);
				}
			}
		}

		return lines.join("\n");
	}

	/**
	 * Get debugging instructions to inject into the agent context.
	 */
	getDebugInstructions(analysis: ErrorAnalysis): string {
		const instructions = [
			"## Self-Debug Mode Active",
			"An error has been detected and analyzed. Follow these steps:",
			"",
			"1. **Understand the Error:** Review the error message and context carefully.",
			`2. **Category:** This is a \`${analysis.category}\` error.`,
			`3. **Root Cause:** ${analysis.rootCause}`,
			"",
			"4. **Apply Fix:**",
		];

		if (analysis.suggestedFixes.length > 0) {
			const safeFix = analysis.suggestedFixes.find((f) => f.risk === "safe");
			if (safeFix) {
				instructions.push(`   - Recommended: ${safeFix.description}`);
			} else {
				instructions.push(`   - Try: ${analysis.suggestedFixes[0].description}`);
			}
		} else {
			instructions.push("   - Investigate the error manually using read and bash tools.");
		}

		instructions.push(
			"",
			"5. **Verify:** After applying a fix, run verification (tests, build, typecheck).",
			"6. **Resolve:** Only mark the debug session resolved after verification passes.",
			"7. **Learn:** If the fix works, note what resolved the issue.",
			"",
			"Use `self_debug` tool to report progress or request additional analysis.",
		);

		return instructions.join("\n");
	}

	/**
	 * Check if an error matches a known pattern.
	 */
	private matchErrorPattern(context: ErrorContext): ErrorPattern | undefined {
		const errorText = `${context.errorMessage} ${context.errorStack ?? ""}`;
		for (const pattern of ERROR_PATTERNS) {
			if (pattern.regex.test(errorText)) {
				return pattern;
			}
		}
		return undefined;
	}

	/**
	 * Check if this error has occurred before in the session.
	 */
	private isRecurringError(context: ErrorContext): boolean {
		const recentWindow = 5 * 60 * 1000; // 5 minutes
		const recentErrors = this.errorHistory.filter((e) => Date.now() - e.timestamp < recentWindow);
		return recentErrors.some(
			(e) =>
				e.toolName === context.toolName &&
				this.normalizeError(e.errorMessage) === this.normalizeError(context.errorMessage),
		);
	}

	/**
	 * Normalize error message for comparison.
	 */
	private normalizeError(error: string): string {
		return error
			.toLowerCase()
			.replace(/\d+/g, "N") // Replace numbers
			.replace(/['"]/g, "") // Remove quotes
			.replace(/\s+/g, " ") // Normalize whitespace
			.trim();
	}

	/**
	 * Extract file paths mentioned in the error context.
	 */
	private extractAffectedFiles(context: ErrorContext): string[] {
		const files: string[] = [...(context.relatedFiles ?? [])];
		const errorText = `${context.errorMessage} ${JSON.stringify(context.args)}`;

		// Match common file patterns
		const filePatterns = [
			/[\w./-]+\.(?:ts|tsx|js|jsx|json|md|py|rs|go|java|kt)/g,
			/(?:at|in|file|path)[\s:]+([^\s,]+)/gi,
		];

		for (const pattern of filePatterns) {
			const matches = errorText.match(pattern);
			if (matches) {
				files.push(...matches);
			}
		}

		return [...new Set(files)].slice(0, 5); // Limit to 5 files
	}

	/**
	 * Generate hypothesis for root cause.
	 */
	private hypothesizeRootCause(context: ErrorContext, pattern?: ErrorPattern): string {
		if (pattern) {
			if (pattern.id === "process-timeout") {
				return "Command timed out or hung while running";
			}
			const causes = pattern.commonCauses;
			return causes[0] ?? "Unknown error - requires manual investigation";
		}

		// Generic analysis based on error message
		const msg = context.errorMessage.toLowerCase();
		if (msg.includes("undefined") || msg.includes("null")) {
			return "Null or undefined value accessed";
		}
		if (msg.includes("timeout")) {
			return "Operation timed out";
		}
		if (msg.includes("memory") || msg.includes("heap")) {
			return "Memory limit exceeded";
		}

		return "Unknown error - requires manual investigation";
	}

	/**
	 * Generate suggested fixes based on error analysis.
	 */
	private generateFixes(context: ErrorContext, pattern?: ErrorPattern, affectedFiles: string[] = []): SuggestedFix[] {
		const fixes: SuggestedFix[] = [];

		// Add pattern-based fixes
		if (pattern) {
			for (const patternFix of pattern.suggestedFixes) {
				fixes.push({
					...patternFix,
					risk: patternFix.type === "auto" ? "safe" : "moderate",
					requiresConfirmation: patternFix.type !== "auto",
				});
			}
		}

		// Add generic investigation fix
		fixes.push({
			type: "guided",
			description: "Investigate error by reading relevant files and logs",
			actions: [{ type: "read", path: context.relatedFiles?.[0] ?? affectedFiles[0] ?? "." }],
			risk: "safe",
			requiresConfirmation: false,
		});

		return fixes;
	}

	/**
	 * Calculate confidence score for the analysis.
	 */
	private calculateConfidence(pattern?: ErrorPattern, isRecurring?: boolean): number {
		let confidence = 0.5; // Base confidence

		if (pattern) {
			confidence += 0.3; // Pattern match boost
		}
		if (isRecurring) {
			confidence += 0.1; // Recurring error provides more data
		}

		return Math.min(confidence, 0.95);
	}

	/**
	 * Estimate severity when no pattern matches.
	 */
	private estimateSeverity(context: ErrorContext): ErrorSeverity {
		const msg = context.errorMessage.toLowerCase();
		if (msg.includes("critical") || msg.includes("fatal") || msg.includes("crash")) {
			return "critical";
		}
		if (msg.includes("error") && !msg.includes("warning")) {
			return "high";
		}
		return "medium";
	}

	/**
	 * Record error in history.
	 */
	private recordError(context: ErrorContext): void {
		this.errorHistory.push(context);
		if (this.errorHistory.length > this.maxHistorySize) {
			this.errorHistory.shift();
		}
	}

	/**
	 * Learn from successful resolution.
	 */
	private learnFromResolution(session: DebugSession): void {
		const patternKey = `${session.analysis.category}-${session.originalError.toolName}`;
		const count = this.learnedPatterns.get(patternKey) ?? 0;
		this.learnedPatterns.set(patternKey, count + 1);
	}

	/**
	 * Get statistics about errors in this session.
	 */
	getStats(): {
		totalErrors: number;
		resolved: number;
		abandoned: number;
		byCategory: Record<string, number>;
	} {
		const sessions = Array.from(this.debugSessions.values());
		const byCategory: Record<string, number> = {};

		for (const session of sessions) {
			byCategory[session.analysis.category] = (byCategory[session.analysis.category] ?? 0) + 1;
		}

		return {
			totalErrors: this.errorHistory.length,
			resolved: sessions.filter((s) => s.status === "resolved").length,
			abandoned: sessions.filter((s) => s.status === "abandoned").length,
			byCategory,
		};
	}

	/**
	 * Clear history (for testing or session reset).
	 */
	clearHistory(): void {
		this.errorHistory = [];
		this.debugSessions.clear();
		this.learnedPatterns.clear();
	}
}

// ============================================================================
// Tool Schema for self_debug
// ============================================================================

export const selfDebugSchema = Type.Object({
	action: Type.Union([Type.Literal("analyze"), Type.Literal("fix"), Type.Literal("status"), Type.Literal("stats")]),
	/** Error message to analyze (for action=analyze) */
	errorMessage: Type.Optional(Type.String({ description: "The error message to analyze" })),
	/** Tool that caused the error (for action=analyze) */
	toolName: Type.Optional(Type.String({ description: "Tool that caused the error" })),
	/** Tool call arguments (for action=analyze) */
	toolArgs: Type.Optional(Type.Any({ description: "Arguments passed to the tool" })),
	/** Debug session ID (for action=fix, status) */
	sessionId: Type.Optional(Type.String({ description: "Debug session ID" })),
	/** Fix action to apply (for action=fix) */
	fixAction: Type.Optional(
		Type.Object({
			type: Type.Union([Type.Literal("edit"), Type.Literal("bash"), Type.Literal("read"), Type.Literal("write")]),
			filePath: Type.Optional(Type.String()),
			oldText: Type.Optional(Type.String()),
			newText: Type.Optional(Type.String()),
			command: Type.Optional(Type.String()),
		}),
	),
});

export type SelfDebugInput = Static<typeof selfDebugSchema>;
