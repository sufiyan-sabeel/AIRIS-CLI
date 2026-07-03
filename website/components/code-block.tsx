import { CopyButton } from "@/components/copy-button";

export function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="terminal-glow shine-card overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 text-zinc-100 shadow-sm dark:bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6 sm:text-sm sm:leading-7"><code data-language={language}>{code}</code></pre>
    </div>
  );
}
