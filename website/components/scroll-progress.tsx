"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { useReducedMotion } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 300,
    damping: 30,
    restDelta: 0.001,
  });
  const prefersReduced = useReducedMotion();

  if (prefersReduced) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 shadow-lg shadow-blue-500/25"
      style={{ scaleX }}
    />
  );
}
