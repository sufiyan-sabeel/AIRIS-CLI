"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { installMethods } from "@/lib/site";
import { cn } from "@/lib/utils";

export function InstallMethods() {
  return (
    <Tabs defaultValue={installMethods[0].id} className="w-full">
      <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        {installMethods.map((m) => (
          <TabsTrigger
            key={m.id}
            value={m.id}
            className="border border-border bg-card/50 data-[state=active]:border-primary/50 data-[state=active]:bg-primary/10"
          >
            {m.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {installMethods.map((m) => (
        <TabsContent key={m.id} value={m.id} className="mt-5">
          <div className="rounded-2xl border border-border bg-card/60 p-5 glass">
            <p className="mb-4 text-sm text-muted-foreground">{m.description}</p>
            <div className="space-y-3">
              {m.commands.map((cmd, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border bg-[#0a0d16] px-3 py-2.5 font-mono text-[13px]",
                    cmd.includes("\n") && "whitespace-pre-wrap"
                  )}
                >
                  <code className="flex-1 text-foreground/90">{cmd}</code>
                  <CopyButton value={cmd} />
                </div>
              ))}
            </div>
            {m.note && (
              <p className="mt-3 font-mono text-xs text-accent">{m.note}</p>
            )}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
