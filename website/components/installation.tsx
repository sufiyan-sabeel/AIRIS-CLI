"use client";

import { motion } from "motion/react";
import { SectionHeader } from "./section-header";

const platforms = [
  {
    title: "Linux",
    code: `curl -fsSL https://airis-dev.netlify.app/install.sh | sh`,
  },
  {
    title: "macOS",
    code: `brew install node
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link`,
  },
  {
    title: "Windows (WSL)",
    code: `# Inside WSL (Ubuntu)
curl -fsSL https://airis-dev.netlify.app/install.sh | sh`,
  },
  {
    title: "Android (Termux)",
    code: `# Install Termux from F-Droid (not Play Store)
pkg update && pkg upgrade
pkg install nodejs git
npm install -g @sufiyan-sabeel/airis-cli`,
  },
  {
    title: "From Source",
    code: `git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link`,
  },
];

export function Installation() {
  return (
    <section id="docs" className="py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeader
          label="Docs"
          title="Installation"
          description="Platform-specific installation instructions."
        />

        <div className="space-y-6">
          {platforms.map((platform, i) => (
            <motion.div
              key={platform.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]"
            >
              <div className="border-b border-[var(--color-border)] px-5 py-3">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {platform.title}
                </h3>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-[var(--color-text-secondary)]">
                <code>{platform.code}</code>
              </pre>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
