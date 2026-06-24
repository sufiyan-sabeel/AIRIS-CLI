"use client";

import { motion } from "motion/react";
import { SectionHeader } from "./section-header";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

const steps = [
  {
    phase: "Request",
    description: "Accepts your task description",
  },
  {
    phase: "Contract",
    description: "Generates a mission contract with acceptance criteria",
  },
  {
    phase: "Approval",
    description: "You review and approve the contract",
  },
  {
    phase: "Planning",
    description: "Creates a TODO list for tracking",
  },
  {
    phase: "Implementation",
    description: "Code changes (manual or AI-assisted)",
  },
  {
    phase: "Formatting",
    description: "Runs linters and type checks",
  },
  {
    phase: "Testing",
    description: "Executes build and test suites",
  },
  {
    phase: "Verification",
    description: "Evidence-backed acceptance criterion checks",
  },
  {
    phase: "Proof",
    description: "Generates a proof report under .airis/evidence/",
  },
  {
    phase: "Commit",
    description: "Optional commit or PR with your permission",
  },
];

const shipCmd = 'airis ship start "Build a notes application with CRUD"';

export function Workflow() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shipCmd);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shipCmd;
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
    <section className="py-24 sm:py-32 grid-bg">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeader
          label="Workflow"
          title="airis ship"
          description="Full-lifecycle development workflow from request to proof."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          {/* Command */}
          <div className="mb-8 flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1">
            <code className="flex-1 overflow-x-auto px-4 py-3 font-mono text-sm text-[var(--color-text)]">
              <span className="text-[var(--color-success)]">$</span> {shipCmd}
            </code>
            <button
              onClick={handleCopy}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]"
              aria-label={copied ? "Copied" : "Copy command"}
            >
              {copied ? (
                <Check size={16} className="text-[var(--color-success)]" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--color-border)]" />
            <div className="space-y-4">
              {steps.map((step, i) => (
                <motion.div
                  key={step.phase}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="relative flex items-start gap-4 pl-4"
                >
                  <div className="relative z-10 mt-1 flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-bg)]">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                  </div>
                  <div className="pb-4">
                    <h4 className="text-sm font-semibold text-[var(--color-text)]">
                      {step.phase}
                    </h4>
                    <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
