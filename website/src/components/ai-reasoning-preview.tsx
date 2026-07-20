"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BrainCircuit, Check, Search, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
};

const STEPS: Step[] = [
  { icon: Search, label: "Understand the request", detail: "Parsed: “add input validation to the login form”." },
  { icon: FileText, label: "Gather context", detail: "Read src/components/Login.tsx and shared/validators.ts." },
  { icon: BrainCircuit, label: "Reason about the fix", detail: "Edge cases: empty email, malformed token, rate limits." },
  { icon: Sparkles, label: "Plan the change", detail: "Add zod schema, wire onSubmit, keep error copy accessible." },
];

export function AiReasoningPreview({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [done, setDone] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [restartKey, setRestartKey] = React.useState(0);

  const answer =
    "Added a zod schema to Login.tsx, validated on submit, and surfaced accessible error messages. 12 lines changed, 0 regressions.";

  React.useEffect(() => {
    if (reduced) {
      setDone(STEPS.length);
      setTyped(answer);
      return;
    }
    setDone(0);
    setTyped("");
    let step = 0;
    const stepTimer = setInterval(() => {
      step += 1;
      setDone(step);
      if (step >= STEPS.length) clearInterval(stepTimer);
    }, 900);

    return () => clearInterval(stepTimer);
  }, [reduced, restartKey]);

  React.useEffect(() => {
    if (done < STEPS.length || reduced) return;
    let i = 0;
    const typeTimer = setInterval(() => {
      i += 2;
      setTyped(answer.slice(0, i));
      if (i >= answer.length) clearInterval(typeTimer);
    }, 18);
    return () => clearInterval(typeTimer);
  }, [done, reduced]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/70 p-5 shadow-xl glass",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <BrainCircuit className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium">Reasoning trace</span>
        </div>
        <button
          type="button"
          onClick={() => setRestartKey((k) => k + 1)}
          className="rounded-md border border-border/70 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          replay
        </button>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, idx) => {
          const complete = idx < done;
          const active = idx === done - 1 && done < STEPS.length;
          const Icon = step.icon;
          return (
            <motion.li
              key={step.label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: complete ? 1 : 0.35, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  complete
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-border text-muted-foreground"
                )}
              >
                {complete ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    complete ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground/80">{step.detail}</p>
              </div>
              {active && !reduced && (
                <span className="caret ml-auto mt-2" aria-hidden />
              )}
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-medium text-primary">Answer</p>
        <p className="mt-1 text-sm text-foreground/90">
          {typed}
          {done >= STEPS.length && !reduced && typed.length < answer.length && (
            <span className="caret" aria-hidden />
          )}
        </p>
      </div>
    </div>
  );
}
