import { existsSync } from "node:fs";
import chalk from "chalk";
import { box, keyValue, section, status } from "../cli/ui.ts";
import { APP_NAME } from "../config.ts";
import { readVisionConfig, VISION_MODELS } from "./image-config.ts";
import { openLastVisionImage, runVisionEdit, runVisionGenerate, setupVisionModel } from "./image-runner.ts";
import { checkVisionPromptSafety } from "./image-safety.ts";
import type { VisionModelKey } from "./image-types.ts";

interface ParsedImageOptions {
	model?: string;
	input?: string;
	mask?: string;
	prompt?: string;
	width?: number;
	height?: number;
}

export async function handleImageCommand(args: string[]): Promise<boolean> {
	if (args[0] !== "image") return false;
	const subcommand = args[1] ?? "help";
	try {
		switch (subcommand) {
			case "help":
			case "--help":
			case "-h":
				printImageHelp();
				return true;
			case "setup":
				await handleSetup(args.slice(2));
				return true;
			case "generate":
				await handleGenerate(args.slice(2));
				return true;
			case "edit":
				await handleEdit(args.slice(2));
				return true;
			case "models":
				printModels();
				return true;
			case "open-last":
				handleOpenLast();
				return true;
			default:
				console.error(chalk.red(`Unknown image command: ${subcommand}`));
				console.error(chalk.dim(`Run ${APP_NAME} image --help`));
				process.exitCode = 1;
				return true;
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
		return true;
	}
}

export function printImageHelp(): void {
	console.log(`${section("AIRIS Vision Studio")}
Brand: KageOS | Creator: Umaiz Sufiyan

Usage:
  ${APP_NAME} image setup --model sd15
  ${APP_NAME} image generate "prompt here"
  ${APP_NAME} image edit --input image.png --mask mask.png --prompt "replace background"
  ${APP_NAME} image models
  ${APP_NAME} image open-last

Options:
  --model <name|path>       Model key or local model path
  --width <pixels>          Requested width, rounded to a multiple of 8
  --height <pixels>         Requested height, rounded to a multiple of 8
`);
}

async function handleSetup(args: string[]): Promise<void> {
	const options = parseImageOptions(args);
	const model = options.model ?? "sd15";
	if (!isVisionModelKey(model)) {
		throw new Error(`Unknown setup model: ${model}`);
	}
	console.log(status("running", `Downloading ${model} for offline use after setup...`));
	const result = await setupVisionModel(model);
	if (result.exitCode === 0) {
		console.log(status("ok", `Model ready: ${model}`));
	} else {
		process.exitCode = result.exitCode ?? 1;
	}
}

async function handleGenerate(args: string[]): Promise<void> {
	const options = parseImageOptions(args);
	const prompt = options.prompt ?? firstPositional(args);
	if (!prompt) {
		throw new Error('image generate requires a prompt, for example: airis image generate "graphite AI terminal"');
	}
	const safety = checkVisionPromptSafety(prompt);
	if (!safety.allowed) {
		throw new Error(`Image prompt blocked: ${safety.reason}`);
	}
	console.log(status("running", "Generating image locally with Diffusers..."));
	const result = await runVisionGenerate({
		prompt,
		model: options.model,
		width: options.width,
		height: options.height,
	});
	if (result.exitCode === 0 && result.outputPath && existsSync(result.outputPath)) {
		console.log(status("ok", `PNG created: ${result.outputPath}`));
	} else {
		process.exitCode = result.exitCode ?? 1;
	}
}

async function handleEdit(args: string[]): Promise<void> {
	const options = parseImageOptions(args);
	if (!options.input) {
		throw new Error("image edit requires --input <image.png>");
	}
	if (!options.mask) {
		throw new Error("image edit requires --mask <mask.png>");
	}
	if (!options.prompt) {
		throw new Error('image edit requires --prompt "edit instruction"');
	}
	const safety = checkVisionPromptSafety(options.prompt);
	if (!safety.allowed) {
		throw new Error(`Image prompt blocked: ${safety.reason}`);
	}
	console.log(status("running", "Editing image locally with Diffusers inpainting..."));
	const result = await runVisionEdit({
		input: options.input,
		mask: options.mask,
		prompt: options.prompt,
		model: options.model,
		width: options.width,
		height: options.height,
	});
	if (result.exitCode === 0 && result.outputPath && existsSync(result.outputPath)) {
		console.log(status("ok", `PNG created: ${result.outputPath}`));
	} else {
		process.exitCode = result.exitCode ?? 1;
	}
}

function printModels(): void {
	const config = readVisionConfig();
	const rows = Object.values(VISION_MODELS).map((model) => {
		const installed = existsSync(`${config.model_dir}/${model.key}`);
		return keyValue(
			model.key,
			`${installed ? "installed" : "missing"} | ${model.repository} | ${model.description}`,
			14,
		);
	});
	console.log(box("AIRIS Vision Models", rows));
}

function handleOpenLast(): void {
	const imagePath = openLastVisionImage();
	console.log(status("ok", `Opened last image: ${imagePath}`));
}

function parseImageOptions(args: string[]): ParsedImageOptions {
	const options: ParsedImageOptions = {};
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		switch (arg) {
			case "--model":
				options.model = requireValue(args, ++index, "--model");
				break;
			case "--input":
				options.input = requireValue(args, ++index, "--input");
				break;
			case "--mask":
				options.mask = requireValue(args, ++index, "--mask");
				break;
			case "--prompt":
				options.prompt = requireValue(args, ++index, "--prompt");
				break;
			case "--width":
				options.width = parsePositiveInteger(requireValue(args, ++index, "--width"), "--width");
				break;
			case "--height":
				options.height = parsePositiveInteger(requireValue(args, ++index, "--height"), "--height");
				break;
		}
	}
	return options;
}

function firstPositional(args: readonly string[]): string | undefined {
	return args.find((arg, index) => !arg.startsWith("-") && args[index - 1] !== "--model");
}

function requireValue(args: readonly string[], index: number, flag: string): string {
	const value = args[index];
	if (!value || value.startsWith("--")) {
		throw new Error(`${flag} requires a value`);
	}
	return value;
}

function parsePositiveInteger(value: string, flag: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`${flag} must be a positive integer`);
	}
	return parsed;
}

function isVisionModelKey(value: string): value is VisionModelKey {
	return value === "sd15" || value === "sd15-inpaint";
}
