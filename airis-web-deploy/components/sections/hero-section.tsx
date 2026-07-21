"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { ArrowRight, Github, Monitor, Terminal } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TerminalDemo } from "@/components/terminal-demo";
import { ParticleField } from "@/components/particle-field";
import { ScrollReveal } from "@/components/scroll-reveal";
import { MagneticButton } from "@/components/magnetic-button";
import { repo } from "@/data/site";

const HeroScene = dynamic(
  () => import("@/components/three/hero-scene").then((m) => ({ default: m.HeroScene })),
  { ssr: false, loading: () => null }
);

const stats = [
  { label: "Creator", value: repo.creator },
  { label: "Version", value: `v${repo.version}` },
  { label: "License", value: repo.license },
  { label: "Node", value: `>=${repo.node}` },
];

export function HeroSection() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({
      x: (e.clientX / window.innerWidth) * 2 - 1,
      y: (e.clientY / window.innerHeight) * 2 - 1,
    });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="hero-gradient relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-16 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
      <div className="bg-grid absolute inset-0 -z-10 opacity-70" aria-hidden />
      <div className="scanline absolute inset-x-0 top-0 -z-10 h-1/2 opacity-20" aria-hidden />

      {/* 3D Hero Scene */}
      <Suspense fallback={null}>
        <HeroScene mouseX={mousePos.x} mouseY={mousePos.y} scrollProgress={scrollProgress} />
      </Suspense>

      {/* Particle field fallback */}
      <ParticleField particleCount={30} connectDistance={120} speed={0.15} />

      {/* Floating orbs */}
      <div className="orb-blue absolute -left-32 -top-32 -z-10 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
      <div className="orb-cyan absolute -right-32 top-16 -z-10 h-96 w-96 rounded-full bg-cyan-500/6 blur-3xl" aria-hidden />
      <div className="orb-blue-slow absolute bottom-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" aria-hidden />
      <div className="orb-pulse absolute left-1/2 top-1/3 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/4 blur-3xl" aria-hidden />

      <div className="mx-auto max-w-7xl">
        <div className="fade-up text-center">
          {/* Eyebrow badge */}
          <div className="mb-6">
            <Badge variant="default" className="gap-1.5 border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {repo.fullName}
            </Badge>
          </div>

          {/* Main headline */}
          <h1 className="mx-auto max-w-5xl text-balance text-responsive-hero font-semibold tracking-[-0.03em] leading-[1.1]">
            AI-Powered{" "}
            <span className="gradient-text">Command-Line</span>
            {" "}Assistant
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-balance text-responsive-body leading-7 text-muted-foreground sm:leading-8">
            An intelligent coding agent that lives in your terminal.
            Built for developers who want AI assistance without leaving the command line.
          </p>

          {/* CTAs */}
          <div className="fade-up fade-up-delay-1 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <MagneticButton asChild>
              <Button asChild size="lg" className="pulse-cta">
                <a href="#installation">
                  Install AIRIS <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </MagneticButton>
            <Button asChild size="lg" variant="outline">
              <a href="#demo">
                <Monitor className="h-4 w-4" /> Watch Demo
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href={repo.url} target="_blank" rel="noreferrer">
                <Github className="h-4 w-4" /> GitHub
              </a>
            </Button>
          </div>
        </div>

        {/* Terminal Preview */}
        <div className="fade-up fade-up-delay-2 mx-auto mt-14 max-w-3xl sm:mt-16">
          <div className="terminal-orbit relative">
            <div className="float-medium absolute -left-2 -top-3 z-10 rounded-full border border-blue-400/20 bg-background/80 px-3 py-1 text-[11px] font-medium shadow-lg backdrop-blur-md sm:-left-3 sm:-top-4 sm:px-3.5 sm:py-1 sm:text-xs">
              <Terminal className="mr-1 inline h-3 w-3" />
              npm global install
            </div>
            <div className="float-slow float-delay absolute -right-2 -bottom-3 z-10 rounded-full border border-cyan-400/20 bg-background/80 px-3 py-1 text-[11px] font-medium shadow-lg backdrop-blur-md sm:-right-2 sm:-bottom-4 sm:px-3.5 sm:py-1 sm:text-xs">
              multi-provider AI
            </div>
            <TerminalDemo />
          </div>
        </div>

        {/* Quick Info */}
        <ScrollReveal delay={0.5} duration={0.5}>
          <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 text-xs sm:gap-4 sm:text-sm md:grid-cols-4">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/40 bg-card/60 p-3 text-center backdrop-blur-sm sm:rounded-2xl sm:p-4"
              >
                <dt className="text-xs text-muted-foreground sm:text-sm">{item.label}</dt>
                <dd className="mt-1 font-semibold tracking-tight text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </ScrollReveal>
      </div>
    </section>
  );
}
