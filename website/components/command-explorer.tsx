"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { commands, commandCategories } from "@/data/site";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";

export function CommandExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof commandCategories)[number]>("All");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return commands.filter((command) => {
      const inCategory = category === "All" || command.category === category;
      const inQuery = !q || [command.command, command.description, command.usage, command.category].join(" ").toLowerCase().includes(q);
      return inCategory && inQuery;
    });
  }, [query, category]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="relative block">
          <span className="sr-only">Search commands</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands, usage, or category…" className="pl-10" />
        </label>
        <Badge className="justify-center px-4 py-2">{filtered.length} commands</Badge>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Command categories">
        {commandCategories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${category === item ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.map((command, index) => (
          <motion.div
            key={`${command.command}-${command.usage}`}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.015, 0.15) }}
          >
            <Card className="bg-card/70">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-lg bg-secondary px-2 py-1 font-mono text-sm text-foreground">{command.command}</code>
                      <Badge>{command.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{command.description}</p>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Usage:</span> <code className="font-mono">{command.usage}</code></p>
                      <p><span className="text-muted-foreground">Example:</span> <code className="font-mono">{command.examples[0]}</code></p>
                    </div>
                  </div>
                  <CopyButton value={command.examples[0]} label="Copy example" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
