/**
 * The single file in AIRIS that imports Pi.
 *
 * Every symbol used here was read from the vendored upstream source before being
 * written down:
 *   - createAgentSession(options?) -> { session, extensionsResult, modelFallbackMessage? }
 *     vendor/pi/packages/coding-agent/src/core/sdk.ts:191
 *   - session.prompt(text, options?)            src/core/agent-session.ts:2177
 *   - session.abort()                           src/core/agent-session.ts:2616
 *   - session.subscribe(listener) -> unsubscribe src/core/agent-session.ts:1457
 *   - session.getLastAssistantText()            src/core/agent-session.ts:4526
 *   - session.dispose()                         src/core/agent-session.ts:1481
 *   - SessionManager.inMemory()                 documented in docs/sdk.md
 *   - events: "message_update" + assistantMessageEvent.type === "text_delta",
 *     and "tool_execution_end"                  src/core/agent-session.ts:210-224, 1441
 */
import {
	createAgentSession,
	type AgentSession,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import {
	type AirisDeltaHandler,
	type AirisRuntime,
	type AirisRuntimeOptions,
	type AirisTurnResult,
	AirisRuntimeUnavailableError,
	normalizeRuntimeError,
} from "./index.ts";

const PI_PACKAGE = "@earendil-works/pi-coding-agent";

/**
 * Whether the vendored runtime is built and importable. Returns false rather
 * than throwing so callers can degrade explicitly instead of crashing.
 */
export async function isPiRuntimeAvailable(): Promise<boolean> {
	try {
		await import(PI_PACKAGE);
		return true;
	} catch {
		return false;
	}
}

/** AIRIS runtime backed by the genuine Pi coding agent. */
export class PiAirisRuntime implements AirisRuntime {
	private session: AgentSession | undefined;
	private unsubscribe: (() => void) | undefined;
	private toolExecutions = 0;
	private aborted = false;

	private readonly options: AirisRuntimeOptions;

	constructor(options: AirisRuntimeOptions = {}) {
		this.options = options;
	}

	get available(): boolean {
		return this.session !== undefined;
	}

	async start(): Promise<void> {
		if (this.session) return;

		const cwd = this.options.cwd ?? process.cwd();
		try {
			const { session } = await createAgentSession({
				cwd,
				// "memory" leaves no state on disk, which is the default so tests and
				// short runs are side-effect free. "persistent" uses Pi's on-disk
				// session store (Pi persists by default when no manager is supplied).
				...(this.options.persistence === "persistent"
					? {}
					: { sessionManager: SessionManager.inMemory() }),
			});
			this.session = session;
		} catch (error) {
			throw new AirisRuntimeUnavailableError(
				`Failed to start the Pi runtime: ${normalizeRuntimeError(error)}`,
				error,
			);
		}
	}

	async prompt(text: string, onDelta?: AirisDeltaHandler): Promise<AirisTurnResult> {
		const session = this.requireSession();
		this.toolExecutions = 0;
		this.aborted = false;

		// Subscribe before prompting so streamed output is not missed.
		this.unsubscribe?.();
		this.unsubscribe = session.subscribe((event) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				onDelta?.(event.assistantMessageEvent.delta);
			} else if (event.type === "tool_execution_end") {
				this.toolExecutions += 1;
			} else if (event.type === "agent_settled" && event.aborted) {
				this.aborted = true;
			}
		});

		try {
			await session.prompt(text);
		} catch (error) {
			throw new AirisRuntimeUnavailableError(
				`Pi runtime prompt failed: ${normalizeRuntimeError(error)}`,
				error,
			);
		} finally {
			this.unsubscribe?.();
			this.unsubscribe = undefined;
		}

		return {
			text: session.getLastAssistantText() ?? "",
			toolExecutions: this.toolExecutions,
			aborted: this.aborted,
		};
	}

	async abort(): Promise<void> {
		await this.session?.abort();
	}

	async dispose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.session?.dispose();
		this.session = undefined;
	}

	private requireSession(): AgentSession {
		if (!this.session) {
			throw new AirisRuntimeUnavailableError(
				"Pi runtime session is not started; call start() first.",
			);
		}
		return this.session;
	}
}

/** Creates an AIRIS runtime backed by Pi. */
export function createAirisRuntime(options: AirisRuntimeOptions = {}): AirisRuntime {
	return new PiAirisRuntime(options);
}
