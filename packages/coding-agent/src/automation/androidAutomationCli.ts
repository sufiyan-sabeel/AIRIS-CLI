import { createInterface } from "node:readline";
import chalk from "chalk";
import { APP_NAME } from "../config.ts";
import { executeAndroidAction, formatResponse } from "./androidBridge.ts";
import { getConfirmationMessage, isAndroidAutomationRequest } from "./androidIntentRouter.ts";
import { SAFE_ACTIONS } from "./types.ts";

const SAFE_ANDROID_ACTIONS = new Set(SAFE_ACTIONS);

function printAutomationHelp(): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} automation <request...>
  ${APP_NAME} droid <request...>

Run an Android automation request through the local ADB bridge.

Examples:
  ${APP_NAME} droid open settings
  ${APP_NAME} droid read screen
  ${APP_NAME} droid tap 360 800
  ${APP_NAME} droid open whatsapp and search Sufiyan
`);
}

async function promptAutomationConfirm(message: string): Promise<boolean> {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(`${message} [y/N] `, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
		});
	});
}

export async function handleAutomationCommand(args: string[]): Promise<boolean> {
	const [command, ...rest] = args;
	if (command !== "automation" && command !== "droid") {
		return false;
	}

	if (rest.includes("--help") || rest.includes("-h")) {
		printAutomationHelp();
		return true;
	}

	const request = rest.join(" ").trim();
	if (!request) {
		printAutomationHelp();
		process.exitCode = 1;
		return true;
	}

	const automation = isAndroidAutomationRequest(request);
	if (!automation) {
		console.error(chalk.red(`Could not match Android automation request: ${request}`));
		console.error(chalk.dim(`Use "${APP_NAME} automation --help" for examples.`));
		process.exitCode = 1;
		return true;
	}

	const { confidence, intent } = automation;
	if (intent.safety === "blocked") {
		console.error(chalk.red("AIRIS cannot automate that Android request because it is sensitive or destructive."));
		process.exitCode = 1;
		return true;
	}

	const needsConfirmation =
		intent.safety === "confirm" || confidence !== "high" || !SAFE_ANDROID_ACTIONS.has(intent.action);
	if (needsConfirmation) {
		const message = getConfirmationMessage(intent);
		if (!process.stdin.isTTY || !process.stdout.isTTY) {
			console.error(chalk.red(message));
			console.error(chalk.dim("Run the command from an interactive terminal to confirm it."));
			process.exitCode = 1;
			return true;
		}
		const confirmed = await promptAutomationConfirm(message);
		if (!confirmed) {
			console.error(chalk.dim("Aborted."));
			process.exitCode = 1;
			return true;
		}
	}

	const response = await executeAndroidAction(intent.action, intent.params);
	const formatted = formatResponse(response);
	if (response.ok) {
		console.log(formatted);
		process.exitCode = 0;
	} else {
		console.error(chalk.red(formatted));
		process.exitCode = 1;
	}
	return true;
}
