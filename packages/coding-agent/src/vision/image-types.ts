export type VisionBackend = "diffusers";
export type VisionDevice = "cpu" | "cuda" | "mps" | "auto";
export type VisionModelKey = "sd15" | "sd15-inpaint";

export interface VisionConfig {
	backend: VisionBackend;
	device: VisionDevice;
	default_width: number;
	default_height: number;
	steps: number;
	guidance_scale: number;
	output_dir: string;
	model_dir: string;
	venv: string;
}

export interface VisionModelInfo {
	key: VisionModelKey;
	repository: string;
	description: string;
	task: "text-to-image" | "inpaint";
}

export interface VisionGenerateRequest {
	prompt: string;
	width?: number;
	height?: number;
	model?: VisionModelKey | string;
}

export interface VisionEditRequest extends VisionGenerateRequest {
	input: string;
	mask: string;
}

export interface VisionRunResult {
	outputPath?: string;
	exitCode: number | null;
}
