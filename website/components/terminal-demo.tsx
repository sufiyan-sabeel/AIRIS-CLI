"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { SectionHeader } from "./section-header";

const lines = [
  { type: "prompt", text: "$ airis --model gemini/gemini-2.0-flash" },
  { type: "output", text: "" },
  { type: "output", text: "  ◆ AIRIS v0.79.3 — Interactive Mode" },
  { type: "output", text: "  Provider: Google Gemini" },
  { type: "output", text: "  Model: gemini-2.0-flash" },
  { type: "output", text: "" },
  { type: "user", text: "  > Refactor the parser function in src/utils/parser.ts" },
  { type: "output", text: "" },
  { type: "tool", text: "  ↻ Reading src/utils/parser.ts..." },
  { type: "output", text: "  Found function parseConfig at line 42" },
  { type: "output", text: "" },
  { type: "ai", text: "  I see several improvements:" },
  { type: "ai", text: "  • The function mixes parsing and validation concerns" },
  { type: "ai", text: "  • Uses mutability where immutable patterns are cleaner" },
  { type: "ai", text: "  • Missing error boundaries for malformed input" },
  { type: "output", text: "" },
  { type: "tool", text: "  ↻ Editing src/utils/parser.ts..." },
  { type: "tool", text: "  ✓ Applied refactoring (3 changes)" },
  { type: "success", text: "  ✓ Refactored. Complexity reduced from 8 to 3." },
  { type: "output", text: "" },
  { type: "prompt", text: "  > " },
];

export function TerminalDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      setVisibleCount(lines.length);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          let idx = 0;
          const interval = setInterval(() => {
            idx++;
            setVisibleCount(idx);
            if (idx >= lines.length) clearInterval(interval);
          }, 120);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeader
          label="Demo"
          title="See It in Action"
          description="Interactive AI coding assistant running directly in your terminal."
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          ref={containerRef}
          className="terminal-window"
        >
          <div className="terminal-header">
            <div className="flex gap-2">
              <div className="terminal-dot bg-[#ff5f56]" />
              <div className="terminal-dot bg-[#ffbd2e]" />
              <div className="terminal-dot bg-[#27c93f]" />
            </div>
            <span className="ml-4 text-xs text-[var(--color-text-muted)]">
              airis — interactive session
            </span>
          </div>
          <div className="terminal-body">
            {lines.map((line, i) => (
              <div
                key={i}
                className={`terminal-line ${
                  i < visibleCount ? "visible" : ""
                }`}
                style={{ transitionDelay: `${i * 30}ms` }}
              >
                {line.type === "prompt" && (
                  <span className="text-[var(--color-success)]">$</span>
                )}
                {line.type === "tool" && (
                  <span className="text-[var(--color-warning)]">tool</span>
                )}
                {line.type === "success" && (
                  <span className="text-[var(--color-success)]">success</span>
                )}
                {line.type === "user" && (
                  <span className="text-[var(--color-accent)]">user</span>
                )}
                {line.type === "ai" && (
                  <span className="text-[var(--color-text-secondary)]">ai</span>
                )}
                <span
                  className={
                    line.type === "ai"
                      ? "text-[var(--color-text-secondary)]"
                      : line.type === "success"
                      ? "text-[var(--color-success)]"
                      : line.type === "tool"
                      ? "text-[var(--color-warning)]"
                      : ""
                  }
                >
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
