// @ts-nocheck — JSX types provided by @react-three/fiber at runtime
"use client";

import { useRef, useMemo, lazy, Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { NeuralBrain } from "./neural-brain";
import { FloatingGeometry } from "./floating-geometry";
import { detectDevice } from "@/lib/device";
import { isWebGLAvailable } from "@/lib/webgl";
import { useReducedMotion } from "framer-motion";

interface HeroSceneProps {
  mouseX?: number;
  mouseY?: number;
  scrollProgress?: number;
  className?: string;
}

function SceneContent({
  mouseX,
  mouseY,
  scrollProgress,
  isReduced,
  lowQuality,
  maxParticles,
}: {
  mouseX: number;
  mouseY: number;
  scrollProgress: number;
  isReduced: boolean;
  lowQuality: boolean;
  maxParticles: number;
}) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} color="#3b82f6" />
      <directionalLight position={[-3, -2, 4]} intensity={0.3} color="#06b6d4" />
      <pointLight position={[0, 0, 3]} intensity={0.3} color="#3b82f6" />

      <NeuralBrain
        mouseX={mouseX}
        mouseY={mouseY}
        scrollProgress={scrollProgress}
        isReduced={isReduced}
        lowQuality={lowQuality}
      />

      {!isReduced && maxParticles > 40 && (
        <FloatingGeometry
          count={lowQuality ? 8 : 20}
          lowQuality={lowQuality}
        />
      )}
    </>
  );
}

function SceneFallback({ isReduced }: { isReduced: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/3 via-transparent to-transparent" />
      {!isReduced && (
        <div
          className="absolute left-1/2 top-1/4 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 animate-pulse-subtle"
          style={{
            background:
              "radial-gradient(circle, hsl(213 94% 58% / 0.08) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}

export function HeroScene({
  mouseX = 0,
  mouseY = 0,
  scrollProgress = 0,
  className = "",
}: HeroSceneProps) {
  const prefersReduced = useReducedMotion();
  const isReduced = prefersReduced || false;
  const [webglOk, setWebglOk] = useState(true);
  const [device, setDevice] = useState<ReturnType<typeof detectDevice> | null>(null);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
    setDevice(detectDevice());
  }, []);

  // If WebGL is not available or reduced motion, show fallback
  if (!webglOk || device?.no3D) {
    return <SceneFallback isReduced={isReduced} />;
  }

  const dpr = device?.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  const lowQuality = device?.lowQuality ?? false;
  const maxParticles = device?.maxParticles ?? 150;

  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 ${className}`}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45, near: 0.1, far: 50 }}
        dpr={[1, dpr]}
        gl={{
          antialias: !lowQuality,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
          failIfMajorPerformanceCaveat: false,
        }}
        performance={{ min: lowQuality ? 0.3 : 0.5 }}
      >
        <SceneContent
          mouseX={mouseX}
          mouseY={mouseY}
          scrollProgress={scrollProgress}
          isReduced={isReduced}
          lowQuality={lowQuality}
          maxParticles={maxParticles}
        />
      </Canvas>
    </div>
  );
}

export { SceneFallback as HeroSceneFallback };
