"use client";

import { motion, type Variants } from "framer-motion";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface BlurFadeTextProps {
  text: string;
  className?: string;
  variant?: { hidden: { y: number }; visible: { y: number } };
  duration?: number;
  characterDelay?: number;
  delay?: number;
  yOffset?: number;
  animateByCharacter?: boolean;
}

export default function BlurFadeText({
  text,
  className,
  variant,
  duration = 0.4,
  characterDelay = 0.03,
  delay = 0,
  yOffset = 8,
  animateByCharacter = false,
}: BlurFadeTextProps) {
  const defaultVariants: Variants = {
    hidden: { y: -yOffset, opacity: 0, filter: "blur(8px)" },
    visible: { y: 0, opacity: 1, filter: "blur(0px)" },
  };
  const combinedVariants = variant || defaultVariants;
  const characters = useMemo(() => Array.from(text), [text]);

  if (animateByCharacter) {
    return (
      <span className="inline-flex flex-wrap">
        {characters.map((char, i) => (
          <motion.span
            key={i}
            initial="hidden"
            animate="visible"
            variants={combinedVariants}
            transition={{ duration, delay: delay + i * characterDelay, ease: "easeOut" }}
            className={cn("inline-block", className)}
            style={{ width: char.trim() === "" ? "0.25em" : "auto" }}
          >
            {char}
          </motion.span>
        ))}
      </span>
    );
  }

  return (
    <motion.span
      initial="hidden"
      animate="visible"
      variants={combinedVariants}
      transition={{ duration, delay, ease: "easeOut" }}
      className={cn("inline-block", className)}
    >
      {text}
    </motion.span>
  );
}
