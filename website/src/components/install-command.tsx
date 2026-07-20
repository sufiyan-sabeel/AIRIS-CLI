import { Terminal } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { siteConfig } from "@/lib/site";

export function InstallCommand({
  command = `curl -fsSL ${siteConfig.installUrl} | bash`,
  className,
}: {
  command?: string;
  className?: string;
}) {
  return (
    <div
      className={`group relative flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3.5 font-mono text-sm shadow-inner glass ${
        className ?? ""
      }`}
    >
      <Terminal className="h-4 w-4 shrink-0 text-accent" />
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-foreground/90 scrollbar-thin">
        <span className="select-none text-emerald-400">$ </span>
        {command}
      </code>
      <CopyButton value={command} className="shrink-0" />
    </div>
  );
}
