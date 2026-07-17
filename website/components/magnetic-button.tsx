"use client";

import { useRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  strength?: number;
  radius?: number;
  asChild?: boolean;
}

/**
 * Magnetic button that subtly follows the cursor within its bounds.
 * Falls back to static styling when reduced motion is preferred.
 */
export function MagneticButton({
  children,
  className,
  strength = 0.3,
  radius = 200,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const prefersReduced = useReducedMotion();

  function handleMouseMove(e: React.MouseEvent) {
    if (prefersReduced || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) / radius;
    const deltaY = (e.clientY - centerY) / radius;

    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (dist > 1) return;

    const moveX = deltaX * strength * rect.width;
    const moveY = deltaY * strength * rect.height;

    ref.current.style.transform = `translate(${moveX}px, ${moveY}px)`;
  }

  function handleMouseLeave() {
    if (prefersReduced || !ref.current) return;
    ref.current.style.transform = "translate(0px, 0px)";
  }

  return (
    <button
      ref={ref}
      className={cn("magnetic-btn", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
}
