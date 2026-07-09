import { CopyButton } from "@/components/copy-button";

export function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-zinc-950 text-zinc-100 shadow-sm dark:bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 font-mono">{language}</span>
          <CopyButton value={code} />
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6 sm:text-sm sm:leading-7"><code data-language={language}>{code}</code></pre>
    </div>
  );
}
