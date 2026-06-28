# AIRIS Vision Studio

AIRIS Vision Studio adds local image generation and image editing to AIRIS CLI.

Brand: AIRIS CLI / KageOS  
Creator: Umaiz Sufiyan

The TypeScript CLI handles routing, validation, safety checks, logging, config, and process management. Python is used only as the local Diffusers execution backend.

## Setup

Create the local Python environment from the AIRIS repository root:

```bash
python3 -m venv .airis-vision-venv
source .airis-vision-venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install diffusers transformers accelerate safetensors pillow huggingface_hub
```

Download a model:

```bash
airis image setup --model sd15
airis image setup --model sd15-inpaint
```

After model download, generation and editing run from local model files.

## Generate

```bash
airis image generate "a professional graphite blue AI terminal interface, no neon"
```

PNG files are written to:

```text
outputs/images
```

AIRIS records the last successful image in:

```text
.airis/vision/last-image.json
```

## Edit

```bash
airis image edit --input image.png --mask mask.png --prompt "replace background"
```

Editing uses `StableDiffusionInpaintPipeline`. Both `--input` and `--mask` must exist before AIRIS starts Python.

## Models

```bash
airis image models
```

Built-in model keys:

```text
sd15          runwayml/stable-diffusion-v1-5
sd15-inpaint  runwayml/stable-diffusion-inpainting
```

Local model paths can be supported through `--model <path>` for generation/editing.

## Open Last

```bash
airis image open-last
```

AIRIS only reports a PNG as created after the output file exists.

## Termux / Ubuntu Notes

On Termux or Android Linux environments, CPU generation can be slow and memory constrained. Keep the default CPU settings first. If the process is killed by the OS, reduce memory pressure and use a smaller size:

```bash
airis image generate "graphite terminal UI" --width 384 --height 384
```

Ubuntu CPU setup works with the same commands above. GPU acceleration requires a compatible PyTorch install and changing `.airis/vision/config.json` device to `cuda`.

## CPU Warning

CPU generation may take several minutes per image. AIRIS lowers generation size on low-RAM systems and caps CPU defaults to practical resolutions.

## Troubleshooting

If the venv is missing, AIRIS prints the exact missing Python path. Recreate it:

```bash
python3 -m venv .airis-vision-venv
source .airis-vision-venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install diffusers transformers accelerate safetensors pillow huggingface_hub
```

If the model is missing:

```bash
airis image setup --model sd15
```

If generation fails, AIRIS streams the Python error directly. Fix the displayed dependency, model, or memory error and rerun the command.
