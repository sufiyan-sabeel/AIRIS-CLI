"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TypingAnimationProps {
  text: string[];
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pause?: number;
}

export function TypingAnimation({
  text,
  className,
  typingSpeed = 70,
  deletingSpeed = 35,
  pause = 1400,
}: TypingAnimationProps) {
  const [current, setCurrent] = useState("");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");

  useEffect(() => {
    if (text.length === 0) return;
    const full = text[index % text.length];

    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (current.length < full.length) {
        timeout = setTimeout(
          () => setCurrent(full.slice(0, current.length + 1)),
          typingSpeed
        );
      } else {
        setPhase("pausing");
      }
    } else if (phase === "pausing") {
      timeout = setTimeout(() => setPhase("deleting"), pause);
    } else {
      if (current.length > 0) {
        timeout = setTimeout(
          () => setCurrent(full.slice(0, current.length - 1)),
          deletingSpeed
        );
      } else {
        setIndex((i) => (i + 1) % text.length);
        setPhase("typing");
      }
    }

    return () => clearTimeout(timeout);
  }, [current, phase, index, text, typingSpeed, deletingSpeed, pause]);

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span>{current}</span>
      <span className="caret" aria-hidden />
    </span>
  );
}
