"use client";

import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface AIRISLogoProps {
  className?: string;
  size?: number;
  animate?: boolean;
  glow?: boolean;
  float?: boolean;
}

export default function AIRISLogo({
  className,
  size = 40,
  animate = true,
  glow = false,
  float = false,
}: AIRISLogoProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const runAnimation = useCallback(async () => {
    if (!animate || prefersReduced || !svgRef.current) return;
    const svg = svgRef.current;

    try {
      const anime = await import("animejs");
      const { animate: anim, stagger, svg: svgHelper } = anime;

      const paths = svg.querySelectorAll("path");
      const circles = svg.querySelectorAll("circle");
      const rect = svg.querySelector("rect");

      // Set initial state for path drawing
      paths.forEach((path: SVGPathElement) => {
        try {
          const length = path.getTotalLength();
          path.style.strokeDasharray = `${length}`;
          path.style.strokeDashoffset = `${length}`;
        } catch {
          path.style.strokeDasharray = "200";
          path.style.strokeDashoffset = "200";
        }
      });

      circles.forEach((circle: SVGCircleElement) => {
        circle.style.opacity = "0";
        circle.style.transformOrigin = "center";
        circle.style.transform = "scale(0)";
      });

      if (rect) {
        rect.style.opacity = "0";
      }

      // Phase 1: Rect fade in
      if (rect) {
        anim(rect, {
          opacity: [0, 1],
          duration: 600,
          ease: "outExpo",
        });
      }

      // Phase 2: Path drawing (staggered)
      paths.forEach((path: SVGPathElement, i: number) => {
        anim(path, {
          strokeDashoffset: [200, 0],
          duration: 800 + i * 100,
          delay: 200 + i * 80,
          ease: "inOutSine",
        });
      });

      // Phase 3: Circles pop in
      anim(Array.from(circles), {
        opacity: [0, 1],
        scale: [0, 1],
        duration: 400,
        delay: stagger(80, { start: 600 }),
        ease: "outBack(1.7)",
      });

      // Phase 4: Glow pulse (looping)
      if (glow) {
        anim(svg, {
          filter: [
            "drop-shadow(0 0 0px rgba(96,165,250,0))",
            "drop-shadow(0 0 20px rgba(96,165,250,0.5))",
            "drop-shadow(0 0 0px rgba(96,165,250,0))",
          ],
          duration: 2000,
          loop: true,
          ease: "inOutSine",
          delay: 1200,
        });
      }
    } catch {
      // animejs not loaded — silently skip
    }
  }, [animate, prefersReduced, glow]);

  useEffect(() => {
    runAnimation();
  }, [runAnimation]);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby="airis-title airis-desc"
      className={cn(
        float && !prefersReduced && "animate-float",
        className
      )}
    >
      <title id="airis-title">AIRIS CLI logo</title>
      <desc id="airis-desc">
        A professional AIRIS monogram with an orbital command path and connected
        intelligence nodes.
      </desc>
      <defs>
        <linearGradient
          id="airis-base"
          x1="12"
          y1="8"
          x2="52"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#111827" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient
          id="airis-accent"
          x1="13"
          y1="13"
          x2="51"
          y2="51"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#60A5FA" />
          <stop offset="0.52" stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <filter
          id="airis-shadow"
          x="5"
          y="5"
          width="54"
          height="56"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="7"
            stdDeviation="5"
            floodColor="#020617"
            floodOpacity="0.24"
          />
        </filter>
      </defs>
      <g filter="url(#airis-shadow)">
        <rect
          x="10"
          y="8"
          width="44"
          height="48"
          rx="14"
          fill="url(#airis-base)"
        />
        <path
          d="M17 42.5C24.7 50.2 39.3 50.2 47 42.5"
          stroke="url(#airis-accent)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M19 22.5C25.3 14.2 38.7 14.2 45 22.5"
          stroke="#E5E7EB"
          strokeOpacity="0.88"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M20 43L31.9 18L44 43"
          stroke="#F8FAFC"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M25.7 34.6H38.4"
          stroke="#60A5FA"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M32 18V28.8"
          stroke="#93C5FD"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="32"
          cy="18"
          r="3.4"
          fill="url(#airis-accent)"
          stroke="#F8FAFC"
          strokeWidth="1.6"
        />
        <circle cx="19" cy="22.5" r="2.6" fill="#60A5FA" />
        <circle cx="45" cy="22.5" r="2.6" fill="#60A5FA" />
        <circle
          cx="47"
          cy="42.5"
          r="2.9"
          fill="#7C3AED"
          stroke="#F8FAFC"
          strokeWidth="1.3"
        />
      </g>
    </svg>
  );
}
