"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface MagicRingsProps {
  className?: string;
  ringCount?: number;
  speed?: number;
  darkColors?: string[];
  lightColors?: string[];
}

const DARK_COLORS = [
  "rgba(96,165,250,0.35)",   // blue
  "rgba(34,211,238,0.3)",    // cyan
  "rgba(124,58,237,0.25)",   // purple
  "rgba(59,130,246,0.2)",    // blue-500
  "rgba(139,92,246,0.15)",   // violet
];

const LIGHT_COLORS = [
  "rgba(59,130,246,0.25)",   // blue
  "rgba(99,102,241,0.2)",    // indigo
  "rgba(148,163,184,0.15)",  // slate
  "rgba(79,70,229,0.2)",     // indigo-600
  "rgba(168,85,247,0.15)",   // purple
];

export default function MagicRings({
  className,
  ringCount = 6,
  speed = 0.3,
}: MagicRingsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const animRef = useRef<number>(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check for low-performance device
    const isLowPerf =
      typeof navigator !== "undefined" &&
      (navigator.hardwareConcurrency ?? 4) < 4;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = container.clientWidth;
      h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        pausedRef.current = !entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    let time = 0;
    const rings = Array.from({ length: ringCount }, (_, i) => ({
      radius: 60 + i * 40,
      speed: speed * (1 + i * 0.15),
      lineWidth: 1.5 - i * 0.1,
      dashLen: 20 + i * 15,
      offset: i * 0.8,
    }));

    const animate = () => {
      if (pausedRef.current || isLowPerf) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      time += 0.016;
      ctx.clearRect(0, 0, w, h);

      rings.forEach((ring, i) => {
        const color = colors[i % colors.length];
        const radius = ring.radius * Math.min(w, h) / 500;
        const rotation = time * ring.speed + ring.offset;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = ring.lineWidth;
        ctx.setLineDash([ring.dashLen, ring.dashLen * 0.6]);
        ctx.lineDashOffset = rotation * 60;
        ctx.stroke();

        // Inner glow ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
        ctx.strokeStyle = color.replace(/[\d.]+\)$/, "0.08)");
        ctx.lineWidth = 8;
        ctx.stroke();
      });

      ctx.setLineDash([]);
      animRef.current = requestAnimationFrame(animate);
    };

    if (inView) animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      io.disconnect();
    };
  }, [inView, ringCount, speed, colors]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
