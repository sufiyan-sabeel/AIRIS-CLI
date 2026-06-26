import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { getPackageDir, isBunBinary } from "../config.ts";
import type { VisionConfig, VisionModelInfo, VisionModelKey } from "./image-types.ts";

export const DEFAULT_VISION_CONFIG: VisionConfig = {
	backend: "diffusers",
	device: "cpu",
	default_width: 512,
	default_height: 512,
	steps: 20,
	guidance_scale: 7.5,
	output_dir: "outputs/images",
	model_dir: ".airis/models/image",
	venv: ".airis-vision-venv",
};

export const VISION_MODELS: Record<VisionModelKey, VisionModelInfo> = {
	sd15: {
		key: "sd15",
		repository: "runwayml/stable-diffusion-v1-5",
		description: "Stable Diffusion 1.5 text-to-image",
		task: "text-to-image",
	},
	"sd15-inpaint": {
		key: "sd15-inpaint",
		repository: "runwayml/stable-diffusion-inpainting",
		description: "Stable Diffusion 1.5 inpainting",
		task: "inpaint",
	},
};

export function getVisionConfigPath(cwd = process.cwd()): string {
	return join(cwd, ".airis", "vision", "config.json");
}

export function getVisionLastImagePath(cwd = process.cwd()): string {
	return join(cwd, ".airis", "vision", "last-image.json");
}

export function readVisionConfig(cwd = process.cwd()): VisionConfig {
	const configPath = getVisionConfigPath(cwd);
	if (!existsSync(configPath)) {
		writeVisionConfig(DEFAULT_VISION_CONFIG, cwd);
		return { ...DEFAULT_VISION_CONFIG };
	}

	const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<VisionConfig>;
	return normalizeVisionConfig(parsed);
}

export function writeVisionConfig(config: VisionConfig, cwd = process.cwd()): void {
	const configPath = getVisionConfigPath(cwd);
	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

export function ensureVisionDirectories(config: VisionConfig, cwd = process.cwd()): void {
	mkdirSync(dirname(getVisionConfigPath(cwd)), { recursive: true });
	mkdirSync(resolve(cwd, config.output_dir), { recursive: true });
	mkdirSync(resolve(cwd, config.model_dir), { recursive: true });
}

export function resolveVisionBackendDir(cwd = process.cwd()): string {
	const packageDir = getPackageDir();
	const packageSrcOrDist = existsSync(join(packageDir, "src")) ? "src" : "dist";
	const candidates = [
		join(cwd, ".airis", "vision", "backend"),
		join(packageDir, ".airis", "vision", "backend"),
		join(packageDir, packageSrcOrDist, ".airis", "vision", "backend"),
		join(dirname(dirname(packageDir)), ".airis", "vision", "backend"),
	];
	if (isBunBinary) {
		candidates.unshift(join(packageDir, ".airis", "vision", "backend"));
	}
	const found = candidates.find((candidate) => existsSync(join(candidate, "generate.py")));
	return found ?? candidates[0];
}

export function resolveVenvPython(config: VisionConfig, cwd = process.cwd()): string {
	const venvRoot = resolve(cwd, config.venv);
	return process.platform === "win32" ? join(venvRoot, "Scripts", "python.exe") : join(venvRoot, "bin", "python");
}

export function resolveModelPath(config: VisionConfig, model: VisionModelKey | string, cwd = process.cwd()): string {
	if (model.includes("/") || model.includes("\\") || model.startsWith(".")) {
		return resolve(cwd, model);
	}
	return resolve(cwd, config.model_dir, model);
}

export function normalizeImageSize(
	config: VisionConfig,
	width?: number,
	height?: number,
): { width: number; height: number } {
	const memoryLimitBytes = 8 * 1024 * 1024 * 1024;
	const lowMemory = totalmem() > 0 && totalmem() < memoryLimitBytes;
	const requestedWidth = width ?? config.default_width;
	const requestedHeight = height ?? config.default_height;
	const maxSize = lowMemory ? 384 : config.device === "cpu" ? 512 : 768;
	return {
		width: clampDimension(requestedWidth, maxSize),
		height: clampDimension(requestedHeight, maxSize),
	};
}

function normalizeVisionConfig(config: Partial<VisionConfig>): VisionConfig {
	return {
		...DEFAULT_VISION_CONFIG,
		...config,
		backend: config.backend === "diffusers" ? "diffusers" : DEFAULT_VISION_CONFIG.backend,
		device: isVisionDevice(config.device) ? config.device : DEFAULT_VISION_CONFIG.device,
		default_width: normalizeNumber(config.default_width, DEFAULT_VISION_CONFIG.default_width),
		default_height: normalizeNumber(config.default_height, DEFAULT_VISION_CONFIG.default_height),
		steps: normalizeNumber(config.steps, DEFAULT_VISION_CONFIG.steps),
		guidance_scale: normalizeNumber(config.guidance_scale, DEFAULT_VISION_CONFIG.guidance_scale),
	};
}

function isVisionDevice(value: unknown): value is VisionConfig["device"] {
	return value === "cpu" || value === "cuda" || value === "mps" || value === "auto";
}

function normalizeNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampDimension(value: number, maxSize: number): number {
	const rounded = Math.round(value / 8) * 8;
	return Math.max(64, Math.min(maxSize, rounded));
}
