import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnProcess, waitForChildProcess } from "../utils/child-process.ts";
import { openBrowser } from "../utils/open-browser.ts";
import {
	ensureVisionDirectories,
	getVisionLastImagePath,
	normalizeImageSize,
	readVisionConfig,
	resolveModelPath,
	resolveVenvPython,
	resolveVisionBackendDir,
	VISION_MODELS,
} from "./image-config.ts";
import type { VisionEditRequest, VisionGenerateRequest, VisionModelKey, VisionRunResult } from "./image-types.ts";

interface PythonInvocation {
	script: "generate.py" | "edit.py" | "model_manager.py";
	args: string[];
	expectedOutputPath?: string;
}

export async function setupVisionModel(model: VisionModelKey, cwd = process.cwd()): Promise<VisionRunResult> {
	const config = readVisionConfig(cwd);
	ensureVisionDirectories(config, cwd);
	const info = VISION_MODELS[model];
	return runPython(
		{
			script: "model_manager.py",
			args: [
				"download",
				"--model-key",
				model,
				"--repo-id",
				info.repository,
				"--model-dir",
				resolve(cwd, config.model_dir),
			],
		},
		cwd,
	);
}

export async function runVisionGenerate(request: VisionGenerateRequest, cwd = process.cwd()): Promise<VisionRunResult> {
	const config = readVisionConfig(cwd);
	ensureVisionDirectories(config, cwd);
	const model = request.model ?? "sd15";
	const modelPath = resolveModelPath(config, model, cwd);
	if (!existsSync(modelPath)) {
		throw new Error(`Image model is missing: ${modelPath}. Run airis image setup --model sd15 first.`);
	}
	const outputPath = createOutputPath(config.output_dir, "generated", cwd);
	const size = normalizeImageSize(config, request.width, request.height);
	return runPython(
		{
			script: "generate.py",
			expectedOutputPath: outputPath,
			args: [
				"--model",
				modelPath,
				"--prompt",
				request.prompt,
				"--output",
				outputPath,
				"--device",
				config.device,
				"--width",
				String(size.width),
				"--height",
				String(size.height),
				"--steps",
				String(config.steps),
				"--guidance-scale",
				String(config.guidance_scale),
			],
		},
		cwd,
	);
}

export async function runVisionEdit(request: VisionEditRequest, cwd = process.cwd()): Promise<VisionRunResult> {
	const config = readVisionConfig(cwd);
	ensureVisionDirectories(config, cwd);
	const inputPath = resolve(cwd, request.input);
	const maskPath = resolve(cwd, request.mask);
	if (!existsSync(inputPath)) {
		throw new Error(`Input image not found: ${inputPath}`);
	}
	if (!existsSync(maskPath)) {
		throw new Error(`Mask image not found: ${maskPath}`);
	}
	const model = request.model ?? "sd15-inpaint";
	const modelPath = resolveModelPath(config, model, cwd);
	if (!existsSync(modelPath)) {
		throw new Error(`Inpaint model is missing: ${modelPath}. Run airis image setup --model sd15-inpaint first.`);
	}
	const outputPath = createOutputPath(config.output_dir, "edited", cwd);
	const size = normalizeImageSize(config, request.width, request.height);
	return runPython(
		{
			script: "edit.py",
			expectedOutputPath: outputPath,
			args: [
				"--model",
				modelPath,
				"--input",
				inputPath,
				"--mask",
				maskPath,
				"--prompt",
				request.prompt,
				"--output",
				outputPath,
				"--device",
				config.device,
				"--width",
				String(size.width),
				"--height",
				String(size.height),
				"--steps",
				String(config.steps),
				"--guidance-scale",
				String(config.guidance_scale),
			],
		},
		cwd,
	);
}

export function openLastVisionImage(cwd = process.cwd()): string {
	const lastImagePath = getVisionLastImagePath(cwd);
	if (!existsSync(lastImagePath)) {
		throw new Error("No last image recorded. Run airis image generate first.");
	}
	const parsed = JSON.parse(readFileSync(lastImagePath, "utf-8")) as { path?: string };
	if (!parsed.path) {
		throw new Error(`Last image record is invalid: ${lastImagePath}`);
	}
	const imagePath = resolve(cwd, parsed.path);
	if (!existsSync(imagePath)) {
		throw new Error(`Last image does not exist: ${imagePath}`);
	}
	openBrowser(imagePath);
	return imagePath;
}

async function runPython(invocation: PythonInvocation, cwd: string): Promise<VisionRunResult> {
	const config = readVisionConfig(cwd);
	const python = resolveVenvPython(config, cwd);
	if (!existsSync(python)) {
		throw new Error(
			`AIRIS Vision venv is missing: ${python}. Create it with python3 -m venv ${config.venv}, then install the documented Diffusers dependencies.`,
		);
	}
	const backendDir = resolveVisionBackendDir(cwd);
	const scriptPath = join(backendDir, invocation.script);
	if (!existsSync(scriptPath)) {
		throw new Error(`AIRIS Vision backend script is missing: ${scriptPath}`);
	}

	const child = spawnProcess(python, [scriptPath, ...invocation.args], {
		cwd,
		stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, PYTHONUNBUFFERED: "1" },
	});
	child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(chunk));
	child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));
	const exitCode = await waitForChildProcess(child);
	if (exitCode !== 0) {
		return { exitCode };
	}
	if (invocation.expectedOutputPath) {
		if (!existsSync(invocation.expectedOutputPath) || statSync(invocation.expectedOutputPath).size === 0) {
			throw new Error(`Python completed but PNG was not created: ${invocation.expectedOutputPath}`);
		}
		saveLastImage(invocation.expectedOutputPath, cwd);
		return { exitCode, outputPath: invocation.expectedOutputPath };
	}
	return { exitCode };
}

function createOutputPath(outputDir: string, prefix: string, cwd: string): string {
	const dir = resolve(cwd, outputDir);
	const timestamp = new Date()
		.toISOString()
		.replaceAll(":", "-")
		.replace(/\.\d{3}Z$/, "Z");
	return join(dir, `${prefix}-${timestamp}.png`);
}

function saveLastImage(outputPath: string, cwd: string): void {
	const recordPath = getVisionLastImagePath(cwd);
	const relativePath = outputPath.startsWith(cwd) ? outputPath.slice(cwd.length + 1) : outputPath;
	writeFileSync(recordPath, `${JSON.stringify({ path: relativePath, file: basename(outputPath) }, null, 2)}\n`);
}
