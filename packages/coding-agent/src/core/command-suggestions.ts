/**
 * Command Suggestions — context-aware slash command recommendations.
 *
 * Given a lightweight session context (recent errors, changed files, message
 * count, provider health), produce ranked slash command suggestions. Pure and
 * testable; the caller supplies the list of available commands to filter
 * against so suggestions are always reachable.
 */

export interface SuggestionContext {
	recentErrors: string[];
	changedFiles: string[];
	sessionMessages: number;
	providerErrors: number;
	mode?: string;
}

export interface CommandSuggestion {
	command: string;
	reason: string;
	score: number;
}

interface Rule {
	command: string;
	score: number;
	reason: string;
	test: (ctx: SuggestionContext) => boolean;
}

const RULES: Rule[] = [
	{
		command: "providers",
		score: 6,
		reason: "Provider errors detected; inspect health and failover state",
		test: (c) =>
			c.providerErrors > 0 || c.recentErrors.some((e) => /provider|timeout|rate.?limit|5\d\d|unreachable/i.test(e)),
	},
	{
		command: "provider-health",
		score: 5,
		reason: "Recent failures suggest a provider issue",
		test: (c) => c.recentErrors.some((e) => /provider|timeout|rate.?limit|5\d\d/i.test(e)),
	},
	{
		command: "trust",
		score: 6,
		reason: "Permission or access errors; review project trust",
		test: (c) => c.recentErrors.some((e) => /permission|eacces|denied|not allowed|operation not permitted/i.test(e)),
	},
	{
		command: "sandbox",
		score: 4,
		reason: "Access errors; check sandbox configuration",
		test: (c) => c.recentErrors.some((e) => /permission|eacces|denied|sandbox/i.test(e)),
	},
	{
		command: "security",
		score: 5,
		reason: "Security-related errors detected",
		test: (c) => c.recentErrors.some((e) => /secret|token|credential|leak|injection|unsafe/i.test(e)),
	},
	{
		command: "deps-audit",
		score: 4,
		reason: "Dependency or install errors; audit dependencies",
		test: (c) => c.recentErrors.some((e) => /npm|node_modules|module not found|cannot find|install/i.test(e)),
	},
	{
		command: "compact",
		score: 4,
		reason: "Long session; compress context to stay efficient",
		test: (c) => c.sessionMessages >= 30,
	},
	{
		command: "plan",
		score: 4,
		reason: "Many changed files; consider a plan before more edits",
		test: (c) => c.changedFiles.length >= 5,
	},
	{
		command: "recap",
		score: 3,
		reason: "Summarize progress in a long session",
		test: (c) => c.sessionMessages >= 20,
	},
	{
		command: "stats",
		score: 2,
		reason: "Review session statistics and performance",
		test: (c) => c.sessionMessages >= 10,
	},
];

const FALLBACK: CommandSuggestion[] = [
	{ command: "help", reason: "List available commands", score: 1 },
	{ command: "status", reason: "Show current status", score: 1 },
];

/** Produce ranked, reachable command suggestions. */
export function suggestCommands(
	context: SuggestionContext,
	availableCommands: ReadonlyArray<string>,
): CommandSuggestion[] {
	const available = new Set(availableCommands.map((c) => c.replace(/^\//, "")));
	const scored: CommandSuggestion[] = [];
	for (const rule of RULES) {
		if (!available.has(rule.command)) continue;
		if (rule.test(context)) {
			scored.push({ command: rule.command, reason: rule.reason, score: rule.score });
		}
	}
	scored.sort((a, b) => b.score - a.score);
	if (scored.length === 0) {
		return FALLBACK.filter((s) => available.has(s.command));
	}
	return scored;
}
