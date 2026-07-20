"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/env";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    const base = `${BASE_PATH}/sw.js`;
    const onLoad = () => {
      navigator.serviceWorker.register(base).catch(() => {
        /* registration is best-effort */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
