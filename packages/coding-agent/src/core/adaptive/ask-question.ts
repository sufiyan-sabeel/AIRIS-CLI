import {
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	Text,
	visibleWidth,
	wrapTextWithAnsi,
} from "@sufiyan-sabeel/airis-tui";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.ts";
import type { SessionManager } from "../session-manager.ts";
import { ADAPTIVE_TODO_CUSTOM_TYPE, getLatestAdaptiveTodoSnapshot } from "./todo-store.ts";

export const ADAPTIVE_QUESTION_CUSTOM_TYPE = "adaptive.question.decision";

const askQuestionSchema = Type.Object({
	title: Type.String({ description: "Short title for the decision" }),
	question: Type.String({ description: "The missing information, ambiguity, or risky decision to resolve" }),
	context: Type.Optional(
		Type.String({ description: "Brief task-specific context explaining why the answer matters" }),
	),
	choices: Type.Tuple(
		[
			Type.Object({ label: Type.String(), explanation: Type.String() }),
			Type.Object({ label: Type.String(), explanation: Type.String() }),
			Type.Object({ label: Type.String(), explanation: Type.String() }),
		],
		{ description: "Exactly three concise, mutually exclusive choices. First choice is recommended." },
	),
	risk: Type.Optional(
		Type.Union([
			Type.Literal("low"),
			Type.Literal("medium"),
			Type.Literal("high"),
			Type.Literal("security_sensitive"),
			Type.Literal("destructive"),
		]),
	),
	todoId: Type.Optional(Type.String({ description: "Current adaptive TODO or mission ID affected by this decision" })),
});

export type AskQuestionInput = Static<typeof askQuestionSchema>;

export interface AskQuestionChoice {
	index: 1 | 2 | 3 | 4;
	label: string;
	explanation?: string;
	recommended: boolean;
	custom: boolean;
}

export interface AskQuestionResult {
	status: "answered" | "cancelled" | "input_required";
	title: string;
	question: string;
	selected?: AskQuestionChoice;
	answer?: string;
	todoId?: string;
	risk: "low" | "medium" | "high" | "security_sensitive" | "destructive";
	createdAt: string;
}

function recordDecision(sessionManager: SessionManager, result: AskQuestionResult): void {
	sessionManager.appendCustomEntry(ADAPTIVE_QUESTION_CUSTOM_TYPE, result);
	if (result.status !== "answered" || !result.todoId || !result.answer) return;
	const snapshot = getLatestAdaptiveTodoSnapshot(sessionManager.getBranch());
	const item = snapshot.items.find((candidate) => candidate.id === result.todoId);
	if (!item) return;
	const updatedAt = new Date().toISOString();
	const updated = {
		...snapshot,
		updatedAt,
		items: snapshot.items.map((candidate) =>
			candidate.id === result.todoId
				? {
						...candidate,
						completionEvidence: [...candidate.completionEvidence, `Decision: ${result.answer}`],
						updatedAt,
					}
				: candidate,
		),
	};
	sessionManager.appendCustomEntry(ADAPTIVE_TODO_CUSTOM_TYPE, updated);
}

function structuredResultToText(result: AskQuestionResult): string {
	if (result.status === "input_required") {
		return `Input required: ${result.title}\n${result.question}`;
	}
	if (result.status === "cancelled") {
		return `Question cancelled: ${result.title}`;
	}
	const selected = result.selected;
	return `Decision recorded: ${selected?.index}. ${result.answer ?? selected?.label ?? "(no answer)"}`;
}

function sanitizeChoice(
	choice: { label: string; explanation: string },
	fallback: string,
): { label: string; explanation: string } {
	return {
		label: (choice.label || fallback).trim().slice(0, 120),
		explanation: (choice.explanation || "").trim().slice(0, 240),
	};
}

export function createAskQuestionToolDefinition(
	sessionManager: SessionManager,
): ToolDefinition<typeof askQuestionSchema, AskQuestionResult> {
	return {
		name: "ask_question",
		label: "Ask Question",
		description:
			"Internal adaptive question tool. Use only when missing information, ambiguity, or a risky decision materially affects the task. Always provide exactly three contextual choices; the first is recommended. Never auto-choose destructive or security-sensitive decisions.",
		promptSnippet: "Ask a structured clarification question only when materially necessary",
		promptGuidelines: [
			"Do not ask questions when a safe, reversible default can be inferred.",
			"For ask_question, provide three concise, mutually exclusive choices; choice 1 is recommended with a short reason.",
			"Never automatically choose an option for destructive or security-sensitive decisions.",
		],
		parameters: askQuestionSchema,
		async execute(_toolCallId, params: AskQuestionInput, _signal, _onUpdate, ctx) {
			const risk = params.risk ?? "low";
			const choices = params.choices.map((choice, index) => sanitizeChoice(choice, `Option ${index + 1}`));
			const createdAt = new Date().toISOString();

			if (ctx.mode !== "tui") {
				const result: AskQuestionResult = {
					status: "input_required",
					title: params.title,
					question: params.question,
					todoId: params.todoId,
					risk,
					createdAt,
				};
				recordDecision(sessionManager, result);
				return { content: [{ type: "text", text: structuredResultToText(result) }], details: result };
			}

			const uiResult = await ctx.ui.custom<AskQuestionResult>((tui, theme, _kb, done) => {
				const TOTAL_CHOICES = 4;
				let selectedIndex = 0;
				let scrollOffset = 0;
				let cachedWidth: number | undefined;
				let cachedLines: string[] | undefined;
				let inputMode = false;
				let customDraft = "";

				const editorTheme: EditorTheme = {
					borderColor: (s) => theme.fg("accent", s),
					selectList: {
						selectedPrefix: (t) => theme.fg("accent", t),
						selectedText: (t) => theme.fg("accent", t),
						description: (t) => theme.fg("muted", t),
						scrollInfo: (t) => theme.fg("dim", t),
						noMatch: (t) => theme.fg("warning", t),
					},
				};
				const editor = new Editor(tui, editorTheme);
				editor.setText(customDraft);

				const invalidate = () => {
					cachedWidth = undefined;
					cachedLines = undefined;
					tui.requestRender();
				};

				const finish = (result: AskQuestionResult) => done(result);

				const enterInputMode = () => {
					inputMode = true;
					editor.focused = true;
					editor.setText(customDraft);
					invalidate();
				};

				const exitInputMode = () => {
					customDraft = editor.getText?.() ?? customDraft;
					inputMode = false;
					editor.focused = false;
					invalidate();
				};

				const clampScroll = () => {
					const maxOffset = Math.max(0, TOTAL_CHOICES - 3);
					scrollOffset = Math.max(0, Math.min(scrollOffset, maxOffset));
					if (selectedIndex < scrollOffset) scrollOffset = selectedIndex;
					if (selectedIndex > scrollOffset + 2) scrollOffset = selectedIndex - 2;
				};

				const submitSelected = () => {
					if (selectedIndex === 3) {
						enterInputMode();
						return;
					}
					const choice = choices[selectedIndex];
					finish({
						status: "answered",
						title: params.title,
						question: params.question,
						selected: {
							index: (selectedIndex + 1) as 1 | 2 | 3,
							label: choice.label,
							explanation: choice.explanation,
							recommended: selectedIndex === 0,
							custom: false,
						},
						answer: choice.label,
						todoId: params.todoId,
						risk,
						createdAt,
					});
				};

				editor.onSubmit = (value) => {
					customDraft = value;
					const answer = value.trim();
					if (!answer) {
						invalidate();
						return;
					}
					finish({
						status: "answered",
						title: params.title,
						question: params.question,
						selected: { index: 4, label: answer, recommended: false, custom: true },
						answer,
						todoId: params.todoId,
						risk,
						createdAt,
					});
				};

				function handleInput(data: string): void {
					if (inputMode) {
						if (matchesKey(data, Key.escape)) {
							exitInputMode();
							return;
						}
						editor.handleInput(data);
						customDraft = editor.getText?.() ?? customDraft;
						invalidate();
						return;
					}
					if (matchesKey(data, Key.escape)) {
						finish({
							status: "cancelled",
							title: params.title,
							question: params.question,
							todoId: params.todoId,
							risk,
							createdAt,
						});
						return;
					}
					if (matchesKey(data, Key.up)) {
						selectedIndex = Math.max(0, selectedIndex - 1);
						clampScroll();
						invalidate();
						return;
					}
					if (matchesKey(data, Key.down)) {
						selectedIndex = Math.min(TOTAL_CHOICES - 1, selectedIndex + 1);
						clampScroll();
						invalidate();
						return;
					}
					if (matchesKey(data, Key.enter)) {
						submitSelected();
						return;
					}
					if (/^[1-4]$/.test(data)) {
						selectedIndex = Number(data) - 1;
						clampScroll();
						submitSelected();
					}
				}

				function addWrapped(lines: string[], prefix: string, text: string, width: number): void {
					const prefixWidth = visibleWidth(prefix);
					const bodyWidth = Math.max(1, width - prefixWidth);
					const wrapped = wrapTextWithAnsi(text, bodyWidth);
					const cont = " ".repeat(prefixWidth);
					for (let i = 0; i < wrapped.length; i++) lines.push(`${i === 0 ? prefix : cont}${wrapped[i]}`);
				}

				function render(width: number): string[] {
					if (cachedLines && cachedWidth === width) return cachedLines;
					const renderWidth = Math.max(28, width);
					const lines: string[] = [];
					lines.push(theme.fg("border", "─".repeat(renderWidth)));
					addWrapped(lines, " ", theme.fg("accent", theme.bold(params.title)), renderWidth);
					addWrapped(lines, " ", theme.fg("text", params.question), renderWidth);
					if (params.context) addWrapped(lines, " ", theme.fg("muted", params.context), renderWidth);
					lines.push("");
					if (inputMode) {
						addWrapped(lines, " ", theme.fg("accent", "Write your own answer:"), renderWidth);
						for (const line of editor.render(Math.max(1, renderWidth - 2))) lines.push(` ${line}`);
						lines.push("");
						addWrapped(lines, " ", theme.fg("dim", "Enter submit \u2022 Esc return to choices"), renderWidth);
					} else {
						const renderChoices = [
							...choices,
							{ label: "Write your own answer...", explanation: "Open an editable multiline input." },
						];
						const visibleChoices = renderChoices.slice(scrollOffset, scrollOffset + 3);
						for (let local = 0; local < visibleChoices.length; local++) {
							const i = scrollOffset + local;
							const choice = renderChoices[i];
							const selected = i === selectedIndex;
							const prefix = selected ? theme.fg("accent", "> ") : "  ";
							const recommended = i === 0 ? theme.fg("success", " (Recommended)") : "";
							const label = `${i + 1}. ${choice.label}${recommended}`;
							addWrapped(
								lines,
								prefix,
								selected ? theme.fg("accent", label) : theme.fg("text", label),
								renderWidth,
							);
							if (choice.explanation)
								addWrapped(lines, "     ", theme.fg("muted", choice.explanation), renderWidth);
							lines.push("");
						}
						addWrapped(
							lines,
							" ",
							theme.fg("dim", "\u2191\u2193 or 1-4 select \u2022 Enter confirm \u2022 Esc cancel"),
							renderWidth,
						);
					}
					lines.push(theme.fg("border", "─".repeat(renderWidth)));
					cachedWidth = width;
					cachedLines = lines;
					return lines;
				}

				return { render, handleInput, invalidate };
			});

			recordDecision(sessionManager, uiResult);
			return { content: [{ type: "text", text: structuredResultToText(uiResult) }], details: uiResult };
		},
		renderCall(args, theme) {
			return new Text(
				`${theme.fg("toolTitle", theme.bold("ask_question "))}${theme.fg("accent", args.title)}`,
				0,
				0,
			);
		},
		renderResult(result, _options, theme) {
			const details = result.details as AskQuestionResult | undefined;
			if (!details) return new Text("", 0, 0);
			if (details.status === "answered")
				return new Text(theme.fg("success", `Decision: ${details.answer ?? "answered"}`), 0, 0);
			if (details.status === "input_required") return new Text(theme.fg("warning", "Input required"), 0, 0);
			return new Text(theme.fg("warning", "Question cancelled"), 0, 0);
		},
	};
}
