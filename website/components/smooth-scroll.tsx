"use client";

import { useEffect, useRef, createContext, useContext, useCallback, useState, type ReactNode } from "react";

// Lenis types
interface LenisOptions {
  duration?: number;
  easing?: (t: number) => number;
  orientation?: "vertical" | "horizontal";
  gestureOrientation?: "vertical" | "horizontal" | "both";
  smoothWheel?: boolean;
  smoothTouch?: boolean;
  touchMultiplier?: number;
  wheelMultiplier?: number;
  infinite?: boolean;
  wrapper?: HTMLElement | Window;
  content?: HTMLElement;
}

interface LenisInstance {
  raf: (time: number) => void;
  destroy: () => void;
  scrollTo: (
    target: number | string | HTMLElement,
    options?: { offset?: number; duration?: number; immediate?: boolean }
  ) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback: (...args: unknown[]) => void) => void;
  start: () => void;
  stop: () => void;
  velocity: number;
  progress: number;
  isScrolling: boolean;
  isStopped: boolean;
  dimensions: { width: number; height: number };
  targetScroll: number;
  animatedScroll: number;
  [key: string]: unknown;
}

interface SmoothScrollContextType {
  lenis: LenisInstance | null;
  scrollTo: (
    target: number | string | HTMLElement,
    options?: { offset?: number; duration?: number; immediate?: boolean }
  ) => void;
  velocity: number;
}

const SmoothScrollContext = createContext<SmoothScrollContextType>({
  lenis: null,
  scrollTo: () => {},
  velocity: 0,
});

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

export function useScrollVelocity() {
  const { velocity } = useContext(SmoothScrollContext);
  return velocity;
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisInstance | null>(null);
  const [velocity, setVelocity] = useState(0);
  const prefersReduced =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const scrollTo = useCallback(
    (
      target: number | string | HTMLElement,
      options?: { offset?: number; duration?: number; immediate?: boolean }
    ) => {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(target, options);
      } else {
        // Fallback to native scroll
        if (typeof target === "number") {
          window.scrollTo({ top: target, behavior: options?.immediate ? "auto" : "smooth" });
        } else if (typeof target === "string") {
          document.querySelector(target)?.scrollIntoView({
            behavior: options?.immediate ? "auto" : "smooth",
          });
        } else if (target instanceof HTMLElement) {
          target.scrollIntoView({
            behavior: options?.immediate ? "auto" : "smooth",
          });
        }
      }
    },
    []
  );

  useEffect(() => {
    if (prefersReduced) return;

    let mounted = true;
    let rafId: number | null = null;

    async function initLenis() {
      try {
        const LenisMod = await import("@studio-freight/lenis");
        const Lenis = (LenisMod.default || LenisMod) as unknown as {
          new (options?: LenisOptions): LenisInstance;
        };

        const lenis = new Lenis({
          duration: 1.2,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: "vertical",
          gestureOrientation: "vertical",
          smoothWheel: true,
          smoothTouch: false, // Don't interfere with native touch scroll
          touchMultiplier: 2,
          wheelMultiplier: 1,
          infinite: false,
        });

        if (!mounted) {
          lenis.destroy();
          return;
        }

        lenisRef.current = lenis;

        // Track velocity for parallax effects
        lenis.on("scroll", (e: unknown) => {
          const event = e as { velocity: number; progress: number };
          setVelocity(event.velocity);
        });

        // RAF loop
        function raf(time: number) {
          lenis.raf(time);
          rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);

        // Handle anchor links properly
        function handleAnchorClick(e: MouseEvent) {
          const target = e.target as HTMLElement;
          const anchor = target.closest('a[href^="#"]');
          if (!anchor) return;

          const href = (anchor as HTMLAnchorElement).getAttribute("href");
          if (!href || href === "#") return;

          const id = href.slice(1);
          const el = document.getElementById(id);
          if (el) {
            e.preventDefault();
            lenis.scrollTo(el, { offset: -80 });
            // Update URL without causing scroll
            history.pushState(null, "", href);
          }
        }

        document.addEventListener("click", handleAnchorClick);

        return () => {
          document.removeEventListener("click", handleAnchorClick);
        };
      } catch {
        // Lenis unavailable, use native scrolling
        console.warn("Smooth scroll unavailable, using native scrolling");
      }
    }

    initLenis();

    return () => {
      mounted = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
    };
  }, [prefersReduced]);

  return (
    <SmoothScrollContext.Provider value={{ lenis: lenisRef.current, scrollTo, velocity }}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
