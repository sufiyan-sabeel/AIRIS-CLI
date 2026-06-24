"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Copy, Check } from "lucide-react";
import { SectionHeader } from "./section-header";

const tabs = [
  {
    id: "curl",
    label: "curl",
    command: "curl -fsSL https://airis-dev.netlify.app/install.sh | sh",
  },
  {
    id: "npm",
    label: "npm",
    command: "npm install -g @sufiyan-sabeel/airis-cli",
  },
  {
    id: "pnpm",
    label: "pnpm",
    command: "pnpm add -g @sufiyan-sabeel/airis-cli",
  },
  {
    id: "bun",
    label: "bun",
    command: "bun add -g @sufiyan-sabeel/airis-cli",
  },
];

export function InstallCommand() {
  const [activeTab, setActiveTab] = useState("curl");
  const [copied, setCopied] = useState(false);

  const activeCmd = tabs.find((t) => t.id === activeTab)?.command ?? "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCmd);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = activeCmd;
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
    <section id="install" className="py-24 sm:py-32 grid-bg">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeader
          label="Install"
          title="Get Started in Seconds"
          description="One command, zero configuration."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-[var(--color-bg)] text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Command box */}
          <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1">
            <code className="flex-1 overflow-x-auto px-4 py-3 font-mono text-sm text-[var(--color-text)]">
              <span className="text-[var(--color-success)]">$</span>{" "}
              {activeCmd}
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

          <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
            Requires Node.js 22.19+ · Works on Linux, macOS, Windows (WSL), Android (Termux)
          </p>
        </motion.div>
      </div>
    </section>
  );
}
