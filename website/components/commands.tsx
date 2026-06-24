"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { commands, commandCategories } from "@/data/commands";
import { SectionHeader } from "./section-header";

export function Commands() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    return commands.filter((cmd) => {
      const matchesCategory =
        category === "all" || cmd.category === category;
      const matchesSearch =
        search === "" ||
        cmd.command.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  return (
    <section id="commands" className="py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeader
          label="Reference"
          title="CLI Commands"
          description="Complete command reference for AIRIS CLI."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          {/* Search */}
          <div className="relative mb-6">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search commands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)]"
              aria-label="Search commands"
            />
          </div>

          {/* Category filter */}
          <div className="mb-6 flex flex-wrap gap-2">
            {commandCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === cat.id
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Commands list */}
          <div className="space-y-2">
            {filtered.map((cmd, i) => (
              <motion.div
                key={cmd.command}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 transition-colors hover:border-[var(--color-text-muted)]"
              >
                <code className="flex-shrink-0 font-mono text-sm text-[var(--color-accent)]">
                  {cmd.command}
                </code>
                <span className="text-right text-sm text-[var(--color-text-secondary)]">
                  {cmd.description}
                </span>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                No commands match your search.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
