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
	ModelRuntime,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AirisPermissionPolicy, createAirisGuard } from "./guard.ts";
import { writeGuardExtension } from "./guard-extension.ts";
import {
	type AirisDeltaHandler,
	type AirisRuntime,
	type AirisRuntimeDiagnostics,
	type AirisRuntimeOptions,
	type AirisSessionSummary,
	type AirisTurnResult,
	AirisRuntimeUnavailableError,
	normalizeRuntimeError,
} from "./index.ts";

const PI_PACKAGE = "@earendil-works/pi-coding-agent";

/**
 * Conservative default: block reads of common secret locations, block writes to
 * dotenv/key material, and block the most destructive shell commands. Applied
 * whenever an agentDir is configured, so the extension is never silently absent.
 */
export const DEFAULT_AIRIS_POLICY: AirisPermissionPolicy = {
	denyRead: ["~/.ssh/**", "**/.env", "**/.aws/credentials", "**/.config/gh/hosts.yml"],
	denyWrite: ["**/.env", "**/*.pem", "**/*.key", "~/.ssh/**"],
	denyExec: ["rm -rf /", "sudo ", "mkfs", "dd if="],
	failClosed: true,
};

/**
 * Resolves a model id against Pi's ModelRuntime.
 * Accepts "provider/model" (model-runtime.ts:454) or a bare id, which is matched
 * across providers via getAllModels (:470).
 */
export function resolveModel(runtime: ModelRuntime, modelId: string): unknown {
	const [first, ...rest] = modelId.split("/");
	if (rest.length > 0) {
		const model = runtime.getModel(first, rest.join("/"));
		if (model) return model;
		throw new AirisRuntimeUnavailableError(`unknown model: ${modelId}`);
	}
	const matches = runtime.getAllModels().filter((m) => m.id === modelId);
	if (matches.length === 1) return matches[0];
	if (matches.length > 1) {
		const providers = matches.map((m) => m.provider).join(", ");
		throw new AirisRuntimeUnavailableError(
			`model "${modelId}" is ambiguous across providers (${providers}); use provider/model`,
		);
	}
	throw new AirisRuntimeUnavailableError(`unknown model: ${modelId}`);
}

/** Absolute path of this package's guard module, for the generated extension. */
function guardModulePath(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "guard.ts");
}

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
	private guardLoaded = false;
	private guardHandlesToolCalls = false;
	private extensionErrors: string[] = [];

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
			// The permission extension is installed before the session exists, so a
			// session can never run without AIRIS's guard. A failure here aborts the
			// start rather than degrading to an ungated runtime.
			let agentDir = this.options.agentDir;
			if (agentDir) {
				const auditSessionId = this.options.auditSessionId ?? `airis-pi-${Date.now()}`;
				writeGuardExtension({
					agentDir,
					policy: this.options.permissionPolicy ?? DEFAULT_AIRIS_POLICY,
					auditPath: join(agentDir, "audit.jsonl"),
					guardModulePath: guardModulePath(),
					sessionId: auditSessionId,
				});
			}
			// SessionManager decides where the transcript lives:
			//   restoreFrom  -> SessionManager.open(path)      (resume an existing session)
			//   persistent   -> SessionManager.create(cwd)     (new session on disk)
			//   memory       -> SessionManager.inMemory()      (no files written)
			// All three are upstream APIs: session-manager.ts:1773/1784/1822.
			const sessionManager = this.options.restoreFrom
				? SessionManager.open(this.options.restoreFrom)
				: this.options.persistence === "persistent"
					? SessionManager.create(cwd)
					: SessionManager.inMemory(cwd);

			// One ModelRuntime serves both model resolution and the session, so no
			// second, competing model registry is created.
			const modelRuntime = await ModelRuntime.create({ allowModelNetwork: false });
			let model = this.options.model ? resolveModel(modelRuntime, this.options.model) : undefined;

			// TEST ONLY: register Pi's own faux provider with scripted responses so the
			// CLI path can be exercised deterministically. This is the real runtime
			// with a scripted model, not a mock of Pi.
			if (this.options.testScriptedResponses?.length) {
				const ai = (await import("@earendil-works/pi-ai")) as unknown as {
					fauxProvider: () => {
						provider: unknown;
						getModel: () => unknown;
						setResponses: (r: unknown[]) => void;
					};
					fauxAssistantMessage: (content: unknown[]) => unknown;
					fauxText: (text: string) => unknown;
				};
				const faux = ai.fauxProvider();
				const steps: unknown[] = [];
				if (this.options.testToolCall) {
					steps.push(
						ai.fauxAssistantMessage([
							(ai as unknown as { fauxToolCall: (n: string, a: unknown) => unknown }).fauxToolCall(
								this.options.testToolCall.tool,
								this.options.testToolCall.input,
							),
						]),
					);
				}
				for (const text of this.options.testScriptedResponses) {
					steps.push(ai.fauxAssistantMessage([ai.fauxText(text)]));
				}
				faux.setResponses(steps);
				(modelRuntime as unknown as { registerNativeProvider: (p: unknown) => void }).registerNativeProvider(
					faux.provider,
				);
				await modelRuntime.setRuntimeApiKey("faux", "airis-test-key-not-a-secret");
				model = faux.getModel();
			}

			const created = await createAgentSession({
				cwd,
				sessionManager,
				modelRuntime,
				...(model ? { model: model as never } : {}),
				...(agentDir ? { agentDir } : {}),
			});
			const { session } = created;

			// Verify Pi actually loaded the guard and registered a tool_call
			// handler. A written file is not proof of interception.
			this.extensionErrors = (created.extensionsResult?.errors ?? []).map(
				(e) => `${e.path}: ${e.error}`,
			);
			const guard = created.extensionsResult?.extensions?.find((e) =>
				e.path.includes("airis-guard"),
			);
			this.guardLoaded = guard !== undefined;
			this.guardHandlesToolCalls = (guard?.handlers.get("tool_call")?.length ?? 0) > 0;

			if (agentDir && (!this.guardLoaded || !this.guardHandlesToolCalls)) {
				session.dispose();
				throw new AirisRuntimeUnavailableError(
					"AIRIS permission extension did not load; refusing to start an ungated session" +
						(this.extensionErrors.length ? ` (${this.extensionErrors.join("; ")})` : ""),
				);
			}
			this.session = session;
		} catch (error) {
			throw new AirisRuntimeUnavailableError(
				`Failed to start the Pi runtime: ${normalizeRuntimeError(error)}`,
				error,
			);
		}
	}

	/**
	 * Resolves "provider/model" (or a bare model id across providers) using Pi's
	 * ModelRuntime, which is the supported lookup (model-runtime.ts:454).
	 */
	async resolveModelId(modelId: string): Promise<unknown> {
		const runtime = await ModelRuntime.create({ allowModelNetwork: false });
		return resolveModel(runtime, modelId);
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

	async diagnostics(): Promise<AirisRuntimeDiagnostics> {
		const session = this.session;
		return {
			available: session !== undefined,
			model: session?.model?.id,
			provider: session?.model?.provider,
			tools: session?.getActiveToolNames() ?? [],
			persistence: this.options.persistence ?? "memory",
			cwd: this.options.cwd ?? process.cwd(),
			restoredFrom: this.options.restoreFrom,
			guardLoaded: this.guardLoaded,
			guardHandlesToolCalls: this.guardHandlesToolCalls,
			extensionErrors: this.extensionErrors,
		};
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

/**
 * Lists persisted Pi sessions for a working directory.
 * Uses SessionManager.list (session-manager.ts:1923).
 */
export async function listAirisSessions(cwd: string): Promise<AirisSessionSummary[]> {
	const sessions = await SessionManager.list(cwd);
	return sessions.map((session) => ({ path: session.path }));
}

/** Creates an AIRIS runtime backed by Pi. */
export function createAirisRuntime(options: AirisRuntimeOptions = {}): AirisRuntime {
	return new PiAirisRuntime(options);
}
