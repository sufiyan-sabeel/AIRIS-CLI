import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto mb-14 max-w-3xl text-center", className)}>
      <span className="section-accent inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3.5 py-1 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500/70" />
        {eyebrow}
      </span>
      <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
        {description}
      </p>
    </div>
  );
}
