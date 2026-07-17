/**
 * Device capability detection and adaptive quality system.
 * Provides runtime device classification for performance scaling.
 */

export type DeviceTier = "low" | "medium" | "high" | "ultra";

export interface DeviceCapabilities {
  tier: DeviceTier;
  /** Device pixel ratio clamped for performance */
  dpr: number;
  /** Whether WebGL is available */
  webgl: boolean;
  /** Whether reduced motion is preferred */
  reducedMotion: boolean;
  /** Whether device is mobile (touch primary, small screen) */
  mobile: boolean;
  /** Whether device is a tablet */
  tablet: boolean;
  /** Available logical processors (approximation) */
  cpuCores: number;
  /** Total device memory in GB (approximation, 0 if unknown) */
  deviceMemory: number;
  /** Max recommended particle count */
  maxParticles: number;
  /** Whether to use low-quality textures/meshes */
  lowQuality: boolean;
  /** Whether to skip 3D entirely */
  no3D: boolean;
}

let cached: DeviceCapabilities | null = null;

function detectTier(
  mobile: boolean,
  cores: number,
  mem: number,
  dpr: number,
  reducedMotion: boolean
): DeviceTier {
  if (reducedMotion) return "low";
  if (mobile && (cores <= 4 || mem <= 2 || dpr <= 1)) return "low";
  if (mobile && cores <= 6) return "medium";
  if (!mobile && cores >= 12 && mem >= 8 && dpr >= 2) return "ultra";
  if (cores >= 8 && mem >= 4) return "high";
  if (cores >= 4) return "medium";
  return "low";
}

function getMaxParticles(tier: DeviceTier): number {
  switch (tier) {
    case "ultra": return 250;
    case "high": return 150;
    case "medium": return 80;
    case "low": return 30;
  }
}

export function detectDevice(): DeviceCapabilities {
  if (cached) return cached;

  if (typeof window === "undefined") {
    cached = {
      tier: "high",
      dpr: 1,
      webgl: true,
      reducedMotion: false,
      mobile: false,
      tablet: false,
      cpuCores: 8,
      deviceMemory: 4,
      maxParticles: 150,
      lowQuality: false,
      no3D: false,
    };
    return cached;
  }

  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const tablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua) && !mobile;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 0;
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 3);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // WebGL detection
  let webgl = true;
  try {
    const canvas = document.createElement("canvas");
    webgl = !!(
      canvas.getContext("webgl") || canvas.getContext("webgl2")
    );
  } catch {
    webgl = false;
  }

  const tier = detectTier(mobile, cores, mem, dpr, reducedMotion);
  const no3D = !webgl || reducedMotion || tier === "low";

  cached = {
    tier,
    dpr,
    webgl,
    reducedMotion,
    mobile,
    tablet,
    cpuCores: cores,
    deviceMemory: mem,
    maxParticles: getMaxParticles(tier),
    lowQuality: tier === "low" || tier === "medium",
    no3D,
  };

  return cached;
}

/** Hook-compatible version that returns fresh values each call (use in useEffect) */
export function getDeviceCapabilities(): DeviceCapabilities {
  cached = null;
  return detectDevice();
}
