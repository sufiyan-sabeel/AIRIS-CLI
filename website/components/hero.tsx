"use client";

import { motion } from "motion/react";
import { ArrowDown, Copy, Check } from "lucide-react";
import { useState } from "react";

const installCmd = "curl -fsSL https://airis-dev.netlify.app/install.sh | sh";

export function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(installCmd);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = installCmd;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16 grid-bg">
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--color-bg)]" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
        {/* Version badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-1.5 text-xs text-[var(--color-text-muted)]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
          v0.79.3 · MIT License
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-4xl font-bold tracking-tight text-[var(--color-text)] sm:text-5xl md:text-6xl lg:text-7xl"
        >
          <span className="block">AIRIS</span>
          <span className="mt-1 block text-3xl font-normal text-[var(--color-text-secondary)] sm:text-4xl md:text-5xl">
            AI Coding Agent in Your Terminal
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mx-auto mt-6 max-w-2xl text-base text-[var(--color-text-secondary)] sm:text-lg"
        >
          Artificial Intelligence Responsive Integrated System. A local-first
          AI coding agent that reads code, executes commands, edits files, and
          manages sessions — all from your terminal.
        </motion.p>

        {/* Install command */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mx-auto mt-8 max-w-xl"
        >
          <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1">
            <code className="flex-1 overflow-x-auto px-4 py-2.5 font-mono text-sm text-[var(--color-text)]">
              <span className="text-[var(--color-success)]">$</span>{" "}
              {installCmd}
            </code>
            <button
              onClick={handleCopy}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]"
              aria-label={copied ? "Copied" : "Copy install command"}
            >
              {copied ? (
                <Check size={16} className="text-[var(--color-success)]" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Requires Node.js 22.19+ · Works on Linux, macOS, Windows (WSL), Android
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#install"
            className="rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-muted)]"
          >
            Get Started
          </a>
          <a
            href="https://github.com/sufiyan-sabeel/AIRIS-CLI"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            View on GitHub
          </a>
        </motion.div>

        {/* Brand pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-3"
        >
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
            Brand: KageOS
          </span>
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
            Built by Umaiz Sufiyan
          </span>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-16"
        >
          <a
            href="#features"
            className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
            aria-label="Scroll to features"
          >
            Explore features
            <motion.span
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowDown size={14} />
            </motion.span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
