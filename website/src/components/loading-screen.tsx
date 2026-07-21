"use client";

import { useEffect, useState } from "react";
import AIRISLogo from "@/components/logo/AIRISLogo";

export default function LoadingScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const delay = prefersReduced ? 300 : 1800;
    const timer = setTimeout(() => setShow(false), delay);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-700"
      style={{ opacity: show ? 1 : 0 }}
    >
      <AIRISLogo size={72} animate glow />
      <p className="mt-4 font-mono text-sm text-muted-foreground animate-pulse">
        loading…
      </p>
    </div>
  );
}
