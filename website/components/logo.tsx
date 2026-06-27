import { cn } from "@/lib/utils";

export function AirisLogo({ className, large = false }: { className?: string; large?: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)} aria-label="AIRIS CLI">
      <div className={cn("relative grid place-items-center rounded-2xl border border-border bg-foreground text-background shadow-sm", large ? "h-16 w-16" : "h-10 w-10")}>
        <span className={cn("font-mono font-bold tracking-tighter", large ? "text-xl" : "text-sm")}>AI</span>
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-blue-400" />
      </div>
      <div>
        <div className={cn("font-semibold tracking-[-0.03em]", large ? "text-3xl" : "text-base")}>AIRIS CLI</div>
        {large ? <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">KageOS</div> : null}
      </div>
    </div>
  );
}
