import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-[var(--color-text)]">404</h1>
      <p className="mt-4 text-lg text-[var(--color-text-secondary)]">
        This page could not be found.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-muted)]"
      >
        Back to Home
      </Link>
    </div>
  );
}
