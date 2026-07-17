/**
 * WebGL detection and fallback utilities.
 */

export interface WebGLInfo {
  supported: boolean;
  version: number | null;
  renderer: string | null;
  vendor: string | null;
  maxTextureSize: number;
  maxCubeMapSize: number;
  maxRenderBufferSize: number;
  maxVertexAttributes: number;
  maxVaryingVectors: number;
  maxVertexUniforms: number;
  maxFragmentUniforms: number;
  maxTextureUnits: number;
  shaderPrecision: string | null;
}

let cached: WebGLInfo | null = null;

export function detectWebGL(): WebGLInfo {
  if (cached) return cached;

  const info: WebGLInfo = {
    supported: false,
    version: null,
    renderer: null,
    vendor: null,
    maxTextureSize: 0,
    maxCubeMapSize: 0,
    maxRenderBufferSize: 0,
    maxVertexAttributes: 0,
    maxVaryingVectors: 0,
    maxVertexUniforms: 0,
    maxFragmentUniforms: 0,
    maxTextureUnits: 0,
    shaderPrecision: null,
  };

  if (typeof document === "undefined") {
    cached = { ...info, supported: true };
    return cached;
  }

  try {
    const canvas = document.createElement("canvas");
    let gl = canvas.getContext("webgl2") as WebGLRenderingContext | null;

    if (gl) {
      info.version = 2;
    } else {
      gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
      if (gl) info.version = 1;
    }

    if (gl) {
      info.supported = true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        info.renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        info.vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      } else {
        info.renderer = gl.getParameter(gl.RENDERER);
        info.vendor = gl.getParameter(gl.VENDOR);
      }

      info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      info.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
      info.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      info.maxVertexAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
      info.maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
      info.maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
      info.maxFragmentUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
      info.maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

      const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      info.shaderPrecision = precision ? `${precision.precision} bits` : null;
    }
  } catch {
    // WebGL not available
  }

  cached = info;
  return info;
}

export function isWebGLAvailable(): boolean {
  return detectWebGL().supported;
}

export function getWebGLErrorMessage(): string | null {
  const info = detectWebGL();
  if (info.supported) return null;

  if (typeof document === "undefined") return null;
  if (!window.WebGLRenderingContext) {
    return "Your browser does not support WebGL.";
  }
  return "WebGL is disabled or unavailable.";
}

export function getRecommendedRenderer(): "webgl2" | "webgl" | "canvas" {
  const info = detectWebGL();
  if (info.supported && info.version === 2) return "webgl2";
  if (info.supported) return "webgl";
  return "canvas";
}
