#!/usr/bin/env node
/**
 * CLI entry point for the refactored coding agent.
 * Uses main.ts with AgentSession and new mode modules.
 *
 * Test with: npx tsx src/cli-new.ts [args...]
 */
import { APP_NAME, VERSION } from "./config.ts";
import { getErrorsLogPath, logCliError, logCliEvent, maskCliArgs } from "./core/cli-logs.ts";

process.title = APP_NAME;
process.env.AIRIS_CODING_AGENT = "true";
process.emitWarning = (() => {}) as typeof process.emitWarning;

const args = process.argv.slice(2);
logCliEvent("command.start", { command: args[0] ?? "chat", args: maskCliArgs(args) });

function validateSessionIdBeforeMainImport(): void {
	const sessionIdIndex = args.indexOf("--session-id");
	const sessionId = sessionIdIndex >= 0 ? args[sessionIdIndex + 1] : undefined;
	if (sessionId === undefined) return;
	if (!/^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(sessionId)) {
		console.error(
			"Error: Session id must be non-empty, contain only alphanumeric characters, '-', '_', and '.', and start and end with an alphanumeric character",
		);
		process.exit(1);
	}
}

async function run(): Promise<void> {
	if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
		console.log(VERSION);
		process.exit(0);
	}

	if (["mission", "evidence", "lease", "failures"].includes(args[0] ?? "")) {
		const { handleVerifiedAutonomyCommand } = await import("./core/verified-autonomy/cli.ts");
		await handleVerifiedAutonomyCommand(args);
		return;
	}

	if (args[0] === "ship") {
		const { handleShipCommand } = await import("./core/ship/cli.ts");
		await handleShipCommand(args.slice(1), process.cwd());
		return;
	}

	if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
		const { printHelp } = await import("./cli/args.ts");
		printHelp();
		process.exit(0);
	}

	validateSessionIdBeforeMainImport();

	// Configure undici's global dispatcher before provider SDKs issue requests.
	// Runtime settings are applied once SettingsManager has loaded global/project settings.
	const { configureHttpDispatcher } = await import("./core/http-dispatcher.ts");
	configureHttpDispatcher();

	const { main } = await import("./main.ts");
	await main(args);
}

run().catch((error: unknown) => {
	logCliError(error, { command: args[0] ?? "chat", args: maskCliArgs(args) });
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Error: ${message}`);
	console.error(`Details logged to ${getErrorsLogPath()}`);
	process.exitCode = 1;
});
