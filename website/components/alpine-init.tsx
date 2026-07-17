"use client";

import { useEffect, useRef } from "react";
import Alpine from "alpinejs";

/**
 * Alpine.js initializer component.
 * Mount this once in the layout to enable Alpine.js directives
 * alongside React for lightweight interactivity.
 */
export function AlpineInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Alpine.js auto-starts when Alpine.start() is called
    // It integrates cleanly alongside React by managing non-React DOM islands
    (window as unknown as Record<string, unknown>).Alpine = Alpine;
    Alpine.start();

    return () => {
      // Cleanup isn't strictly necessary for Alpine but helps avoid memory leaks
      try {
        Alpine.stop();
      } catch {
        // ignore if already destroyed
      }
    };
  }, []);

  return null;
}
