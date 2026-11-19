/**
 * `airis --engine pi` — routes a single-shot prompt through the vendored Pi
 * runtime instead of the AIRIS engine.
 *
 * The adapter lives outside the AIRIS workspace (`integration/airis-runtime`), so
 * it is resolved at runtime through a computed specifier: AIRIS must stay
 * buildable and testable without the Pi runtime present, and a static import
 * would make `tsc` depend on vendor/pi having been built.
 */
import type { Args } from "./args.ts";

/** Resolves the adapter module without a static import. */
async function loadAdapter(): Promise<Record<string, unknown>> {
	const specifier = ["..", "..", "..", "integration", "airis-runtime", "src", "pi-runtime.ts"].join("/");
	return (await import(specifier)) as Record<string, unknown>;
}

function fail(message: string): never {
	process.stderr.write(`airis: ${message}\n`);
	process.exit(1);
}

/**
 * Runs one prompt through the Pi runtime and prints the streamed response.
 * Returns only when the turn completed; failures exit non-zero with an
 * actionable message rather than a stack trace.
 */
export async function runPiEngine(parsed: Args): Promise<void> {
	const prompt = parsed.messages[0];
	if (!prompt) {
		fail("--engine pi requires a prompt, e.g. airis --engine pi --print \"hello\"");
	}

	let adapter: Record<string, unknown>;
	try {
		adapter = await loadAdapter();
	} catch {
		fail(
			"the Pi runtime adapter is not available. Build it first: " +
				"cd vendor/pi && npm ci && npm run hydrate:model-data, then build the runtime.",
		);
	}

	const createAirisRuntime = adapter.createAirisRuntime as
		| ((options: { cwd?: string; persistence?: "memory" | "persistent" }) => unknown)
		| undefined;
	if (typeof createAirisRuntime !== "function") {
		fail("the Pi runtime adapter did not export createAirisRuntime");
	}

	const runtime = createAirisRuntime({ cwd: process.cwd() }) as {
		start(): Promise<void>;
		prompt(text: string, onDelta?: (delta: string) => void): Promise<{ text: string; aborted: boolean }>;
		dispose(): Promise<void>;
	};

	try {
		await runtime.start();
	} catch (error) {
		fail(
			`could not start the Pi runtime: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	try {
		const result = await runtime.prompt(prompt, (delta) => process.stdout.write(delta));
		if (!result.text) process.stdout.write("");
		process.stdout.write("\n");
	} catch (error) {
		fail(`Pi runtime turn failed: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		await runtime.dispose();
	}
}
