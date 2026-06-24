"use client";

import { motion } from "motion/react";
import { providers } from "@/data/providers";
import { SectionHeader } from "./section-header";
import { Wifi, WifiOff } from "lucide-react";

export function Providers() {
  return (
    <section className="py-24 sm:py-32 grid-bg">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeader
          label="Providers"
          title="25+ AI Providers"
          description="Use any provider. Set the environment variable, start coding."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {providers.map((provider, i) => (
            <motion.div
              key={provider.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {provider.local ? (
                  <WifiOff size={16} className="text-[var(--color-success)]" />
                ) : (
                  <Wifi size={16} className="text-[var(--color-accent)]" />
                )}
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {provider.name}
                </span>
              </div>
              <code className="text-xs text-[var(--color-text-muted)]">
                {provider.envVar}
              </code>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 text-center text-sm text-[var(--color-text-muted)]"
        >
          And more via OpenRouter, Together AI, Fireworks, Cerebras, xAI, NVIDIA,
          Cloudflare, and others.
        </motion.p>
      </div>
    </section>
  );
}
