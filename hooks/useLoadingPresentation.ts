"use client";

import { useEffect, useRef, useState } from "react";
import { markSplashComplete } from "@/lib/loading/splashSession";

/** Gather animation + stagger ≈ 2.4s */
const SPLASH_MIN_MS = 2500;
/** Skip loader on fast transitions (e.g. instellingen) */
const QUICK_DELAY_MS = 320;

export type LoadingPhase = "content" | "hidden" | "minimal" | "splash";

export function useLoadingPresentation(
  loading: boolean,
  intent: "splash" | "quick",
): LoadingPhase {
  const [phase, setPhase] = useState<LoadingPhase>(() =>
    loading ? (intent === "splash" ? "splash" : "hidden") : "content",
  );
  const splashStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      if (intent === "splash") {
        splashStartedAt.current = Date.now();
        setPhase("splash");
        return;
      }

      setPhase("hidden");
      const delayTimer = window.setTimeout(() => {
        setPhase("minimal");
      }, QUICK_DELAY_MS);
      return () => window.clearTimeout(delayTimer);
    }

    if (intent === "splash") {
      const startedAt = splashStartedAt.current ?? Date.now();
      const remaining = SPLASH_MIN_MS - (Date.now() - startedAt);
      const finish = () => {
        markSplashComplete();
        setPhase("content");
      };

      if (remaining <= 0) {
        finish();
        return;
      }

      setPhase("splash");
      const holdTimer = window.setTimeout(finish, remaining);
      return () => window.clearTimeout(holdTimer);
    }

    setPhase("content");
  }, [intent, loading]);

  return phase;
}

export function resolveLoadingIntent(): "splash" | "quick" {
  if (typeof window === "undefined") return "quick";
  return shouldShowSplashClient() ? "splash" : "quick";
}

function shouldShowSplashClient(): boolean {
  return !sessionStorage.getItem("lt-splash-done");
}
