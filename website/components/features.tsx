"use client";

import { motion } from "motion/react";
import { features } from "@/data/features";
import { SectionHeader } from "./section-header";

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          label="Features"
          title="Everything You Need"
          description="Built for developers who want AI assistance directly in their terminal."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 transition-colors hover:border-[var(--color-text-muted)]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-bg)] text-[var(--color-accent)]">
                <feature.icon size={20} />
              </div>
              <h3 className="mb-2 text-base font-semibold text-[var(--color-text)]">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
