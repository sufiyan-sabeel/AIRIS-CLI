/**
 * Validation for the generated model registry.
 *
 * `scripts/generate-models.ts` fetches provider metadata over the network. Every
 * fetch helper in that script catches its own error and returns an empty list,
 * so a single network failure used to produce a *valid-looking but truncated*
 * registry and overwrite `src/models.generated.ts` with it. One observed run
 * lost 18,176 lines and dropped every `claude-opus-4-5` entry, which then broke
 * `tsc` and would have shipped a crippled model catalog.
 *
 * These functions are pure so they can be unit tested without network access.
 */

/** Providers that must always be present in a complete registry. */
export const REQUIRED_PROVIDERS: readonly string[] = ["anthropic", "openai", "google"];

/**
 * A regeneration is rejected when it produces fewer than this fraction of the
 * models currently committed. A real upstream change can shrink the catalog
 * slightly; losing more than half of it is always a fetch failure.
 */
export const MIN_RETAINED_RATIO = 0.5;

/** Number of model entries in a generated registry file. */
export function countModelsInRegistry(source: string): number {
	// Each entry the generator emits ends with `satisfies Model<"...">`.
	return source.match(/satisfies Model</g)?.length ?? 0;
}

export interface RegistryValidationInput {
	/** Number of models the generator resolved in this run. */
	modelCount: number;
	/** Distinct provider ids present in this run. */
	providers: readonly string[];
	/** Model count of the registry currently on disk, or null when absent. */
	previousModelCount: number | null;
}

export interface RegistryValidationResult {
	ok: boolean;
	errors: string[];
}

export function validateRegistry(input: RegistryValidationInput): RegistryValidationResult {
	const errors: string[] = [];
	const { modelCount, providers, previousModelCount } = input;

	if (modelCount === 0) {
		errors.push(
			"No models were resolved. Every upstream fetch failed or returned an empty payload; refusing to overwrite the existing registry.",
		);
		return { ok: false, errors };
	}

	const present = new Set(providers);
	const missing = REQUIRED_PROVIDERS.filter((provider) => !present.has(provider));
	if (missing.length > 0) {
		errors.push(
			`Required provider(s) missing from the generated registry: ${missing.join(", ")}. This usually means one upstream source failed while others succeeded.`,
		);
	}

	if (previousModelCount !== null && previousModelCount > 0) {
		const retained = modelCount / previousModelCount;
		if (retained < MIN_RETAINED_RATIO) {
			errors.push(
				`Generated registry has ${modelCount} models but the committed one has ${previousModelCount} (${Math.round(retained * 100)}% retained, minimum ${Math.round(MIN_RETAINED_RATIO * 100)}%). This is almost always a failed or partial fetch.`,
			);
		}
	}

	return { ok: errors.length === 0, errors };
}

/** Human-readable remediation hint for a failed validation. */
export function describeValidationFailure(errors: readonly string[]): string {
	return [
		"Refusing to write src/models.generated.ts — the existing registry is unchanged.",
		...errors.map((error) => `  - ${error}`),
		"",
		"Remediation:",
		"  * Check network access to models.dev and openrouter.ai.",
		"  * Re-run `npm run generate` from packages/ai once reachable.",
		"  * If upstream genuinely removed models, regenerate and commit deliberately;",
		"    this guard only blocks silent, large regressions.",
	].join("\n");
}
