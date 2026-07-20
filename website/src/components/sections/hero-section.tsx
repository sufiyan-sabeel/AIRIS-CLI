"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Github, Terminal, Zap } from "lucide-react";
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
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-10 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />

      <div className="container relative flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge
            variant="accent"
            className="gap-1.5 px-3 py-1 text-xs shadow-[0_0_20px_-8px_hsl(var(--accent)/0.8)]"
          >
            <Zap className="h-3 w-3" />
            Open-source terminal AI agent
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
        >
          The AI coding agent that lives in your{" "}
          <span className="text-gradient">terminal</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-3 h-7 font-mono text-sm text-accent sm:text-base"
        >
          <TypingAnimation
            text={[
              "airis -p \"summarize this repo\"",
              "airis ship start \"add auth\"",
              "airis --list-models",
              "airis doctor",
            ]}
          />
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-5 max-w-2xl text-pretty text-muted-foreground sm:text-lg"
        >
          {siteConfig.fullName}. Code, automate, and reason over your projects
          from a shell — on your laptop, over SSH, inside containers, or on
          Android with Termux.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild variant="gradient" size="lg">
            <Link href="/install">
              <Terminal className="h-4 w-4" />
              Get started
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={siteConfig.repo} target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" />
              Star on GitHub
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 w-full max-w-xl"
        >
          <InstallCommand />
        </motion.div>

        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/70 bg-card/40 px-4 py-3 glass"
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
