export interface VisionSafetyResult {
	allowed: boolean;
	reason?: string;
}

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{
		pattern: /\b(child|children|minor|underage|teen|schoolgirl|schoolboy)\b.*\b(nude|sexual|erotic|explicit|porn)\b/i,
		reason: "sexual content involving minors",
	},
	{
		pattern: /\b(nude|sexual|erotic|explicit|porn|fetish|sex act|genital|breast|orgasm)\b/i,
		reason: "sexual image content",
	},
	{
		pattern: /\b(gore|dismember|decapitat|mutilat|corpse|bloodbath|graphic violence)\b/i,
		reason: "graphic violent image content",
	},
	{
		pattern: /\b(make|build|instructions?|blueprint)\b.*\b(bomb|explosive|weapon|gun|silencer|poison)\b/i,
		reason: "weapon or illegal harm instructions",
	},
	{
		pattern: /\b(fake id|counterfeit|credit card theft|phishing|malware|stolen credentials)\b/i,
		reason: "illegal or abusive request",
	},
	{ pattern: /\b(self-harm|suicide|kill myself|hanging|overdose)\b/i, reason: "self-harm content" },
	{
		pattern: /\b(realistic|photorealistic)\b.*\b(public figure|celebrity)\b.*\b(nude|sexual|violent)\b/i,
		reason: "abusive public-person image content",
	},
];

export function checkVisionPromptSafety(prompt: string): VisionSafetyResult {
	const normalized = prompt.trim();
	if (!normalized) {
		return { allowed: false, reason: "prompt is empty" };
	}

	for (const rule of BLOCKED_PATTERNS) {
		if (rule.pattern.test(normalized)) {
			return { allowed: false, reason: rule.reason };
		}
	}

	return { allowed: true };
}
