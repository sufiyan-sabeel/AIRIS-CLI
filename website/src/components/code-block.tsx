import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
  className?: string;
}

export function CodeBlock({ code, lang, filename, className }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-[#0a0d16] shadow-lg",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          {filename && (
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {filename}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lang && (
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
              {lang}
            </span>
          )}
          <CopyButton value={code} />
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed scrollbar-thin">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}
