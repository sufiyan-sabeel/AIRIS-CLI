import { Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)] text-xs font-black text-white">
                A
              </div>
              <span className="font-bold text-[var(--color-text)]">AIRIS</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Artificial Intelligence Responsive Integrated System
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://github.com/sufiyan-sabeel/AIRIS-CLI"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
            >
              <Github size={14} />
              GitHub
            </a>
            <a
              href="https://github.com/sufiyan-sabeel/AIRIS-CLI/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
            >
              MIT License
            </a>
            <a
              href="https://github.com/sufiyan-sabeel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
            >
              KageOS
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 border-t border-[var(--color-border)] pt-6 text-center">
          <p className="text-xs text-[var(--color-text-muted)]">
            &copy; 2026 Umaiz Sufiyan &middot; Built by Umaiz Sufiyan
          </p>
        </div>
      </div>
    </footer>
  );
}
