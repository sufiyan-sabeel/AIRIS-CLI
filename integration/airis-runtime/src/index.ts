/**
 * AIRIS ↔ Pi runtime adapter — the only place in AIRIS that imports Pi.
 *
 * Boundary rules:
 *  - Pi-specific imports live in `pi-runtime.ts` and nowhere else.
 *  - Everything else in AIRIS talks to the interfaces in this file.
 *  - The adapter is built only after the vendored runtime has been built
 *    (`vendor/pi`), because the `file:` dependencies resolve to built artifacts.
 *
 * The Pi surface used here is taken from the vendored SDK documentation at
 * vendor/pi/packages/coding-agent/docs/sdk.md and the exported declarations in
 * vendor/pi/packages/coding-agent/dist/index.d.ts — not invented.
 */

/** Options for starting an AIRIS runtime session. */
export interface AirisRuntimeOptions {
	/** Workspace the session operates on. Defaults to process.cwd(). */
	cwd?: string;
	/**
	 * "memory" keeps the transcript in memory; "persistent" uses Pi's on-disk
	 * session store. Defaults to "memory" so tests and short runs leave no state.
	 */
	persistence?: "memory" | "persistent";
	/** Model id to select, when the runtime supports explicit selection. */
	model?: string;
}

/** One completed agent turn. */
export interface AirisTurnResult {
	/** Final assistant text for the turn. */
	text: string;
	/** Number of tool executions observed during the turn. */
	toolExecutions: number;
	/** Whether the turn ended because it was aborted. */
	aborted: boolean;
}

/** Streaming callback invoked for each assistant text delta. */
export type AirisDeltaHandler = (delta: string) => void;

/**
 * The stable interface AIRIS depends on. Implementations may wrap Pi, but
 * callers must never import Pi directly.
 */
export interface AirisRuntime {
	/** Whether the underlying runtime could be loaded. */
	readonly available: boolean;
	/** Resolve the runtime and open a session. */
	start(): Promise<void>;
	/** Submit a prompt and resolve when the turn completes. */
	prompt(text: string, onDelta?: AirisDeltaHandler): Promise<AirisTurnResult>;
	/** Abort the active turn, if any. */
	abort(): Promise<void>;
	/** Release the session and its resources. */
	dispose(): Promise<void>;
}

/** Raised when the runtime cannot be loaded or initialized. */
export class AirisRuntimeUnavailableError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "AirisRuntimeUnavailableError";
	}
}

/**
 * Normalizes anything thrown by the runtime into a stable, non-leaking message.
 * Pi errors can carry provider payloads; this keeps them out of AIRIS logs while
 * preserving the message text.
 */
export function normalizeRuntimeError(error: unknown): string {
	if (error instanceof AirisRuntimeUnavailableError) return error.message;
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error);
	} catch {
		return "unknown runtime error";
	}
}
