import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500/70" />
        404 Error
      </span>
      <h1 className="text-6xl font-bold tracking-tight text-foreground">Page not found</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        This page could not be found.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background shadow-sm transition-all hover:bg-foreground/90"
      >
        Back to Home
      </Link>
    </div>
  );
}
