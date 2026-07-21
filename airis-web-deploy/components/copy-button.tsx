"use client";

import { useState, useCallback, useEffect } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setShowToast(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setShowToast(false), 2200);
    } catch {}
  }, [value]);

  // Close toast on Escape
  useEffect(() => {
    if (!showToast) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowToast(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showToast]);

  return (
    <>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-400" />
            <span className="text-emerald-400">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            <span>Copy</span>
          </>
        )}
      </button>
      {showToast && (
        <div
          className="copy-toast"
          role="status"
          aria-live="polite"
        >
          <Check className="mr-1.5 inline h-3.5 w-3.5 text-emerald-400" />
          Copied to clipboard
        </div>
      )}
    </>
  );
}
