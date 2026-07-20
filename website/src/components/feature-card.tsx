import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Feature } from "@/lib/site";

export function FeatureCard({ feature, className }: { feature: Feature; className?: string }) {
  const Icon = feature.icon;
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card/60 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_0_36px_-14px_hsl(var(--primary)/0.6)] glass",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-gradient-to-br from-primary/15 to-accent/15 text-accent transition-transform duration-300 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </span>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {feature.tag}
        </Badge>
      </div>
      <h3 className="text-base font-semibold tracking-tight">{feature.title}</h3>
      <p className="text-sm text-muted-foreground">{feature.description}</p>
    </div>
  );
}
