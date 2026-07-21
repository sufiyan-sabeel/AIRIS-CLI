"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";
import AIRISLogo from "@/components/logo/AIRISLogo";
import MagicRings from "@/components/magic-rings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InstallCommand } from "@/components/install-command";
import { TypingAnimation } from "@/components/magicui/typing-animation";
import { siteConfig } from "@/lib/site";

const stats = [
  { label: "AI providers", value: "20+" },
  { label: "Node version", value: "22.19+" },
  { label: "License", value: "MIT" },
  { label: "Platforms", value: "5" },
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { animate: anim, stagger } = await import("animejs");
        if (!anim || cancelled || !sectionRef.current) return;

        // Logo float-in
        const logo = sectionRef.current.querySelector(".hero-logo");
        if (logo) {
          anim(logo, {
            scale: [0.5, 1],
            opacity: [0, 1],
            duration: 1000,
            ease: "outBack(1.7)",
          });
        }

        // Heading stagger
        const headings = sectionRef.current.querySelectorAll(".hero-heading");
        if (headings.length) {
          anim(Array.from(headings), {
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 800,
            delay: stagger(120),
            ease: "outExpo",
          });
        }

        // Stats pop
        const stats = sectionRef.current.querySelectorAll(".hero-stat");
        if (stats.length) {
          anim(Array.from(stats), {
            scale: [0.8, 1],
            opacity: [0, 1],
            duration: 500,
            delay: stagger(100, { start: 800 }),
            ease: "outBack(1.4)",
          });
        }
      } catch {
        // animejs not loaded
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      {/* Magic Rings background */}
      <MagicRings className="absolute inset-0 z-0" ringCount={6} speed={0.25} />

      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="container relative z-10 flex flex-col items-center text-center">
        {/* AIRIS Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="hero-logo"
        >
          <AIRISLogo size={80} glow float />
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 hero-heading"
        >
          <Badge variant="accent" className="gap-1.5 px-3 py-1 text-xs">
            <Terminal className="h-3 w-3" />
            Open-source terminal AI agent
          </Badge>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl hero-heading"
        >
          The AI coding agent that lives in your{" "}
          <span className="text-gradient">terminal</span>
        </motion.h1>

        {/* Typing terminal */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-3 h-7 font-mono text-sm text-accent sm:text-base hero-heading"
        >
          <TypingAnimation
            text={[
              'airis -p "summarize this repo"',
              'airis ship start "add auth"',
              "airis --list-models",
              "airis doctor",
            ]}
          />
        </motion.p>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-5 max-w-2xl text-pretty text-muted-foreground sm:text-lg hero-heading"
        >
          {siteConfig.fullName}. Code, automate, and reason over your projects
          from a shell — on your laptop, over SSH, inside containers, or on
          Android with Termux.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3 hero-heading"
        >
          <Button asChild variant="gradient" size="lg">
            <Link href="/install">
              <Terminal className="h-4 w-4" />
              Get started
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={siteConfig.repo} target="_blank" rel="noopener noreferrer">
              {/* GitHub icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Star on GitHub
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </motion.div>

        {/* Install command */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-8 w-full max-w-xl"
        >
          <InstallCommand />
        </motion.div>

        {/* Stats */}
        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="hero-stat rounded-xl border border-border/70 bg-card/40 px-4 py-3 glass"
            >
              <dt className="text-2xl font-semibold text-gradient">{s.value}</dt>
              <dd className="text-xs text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
