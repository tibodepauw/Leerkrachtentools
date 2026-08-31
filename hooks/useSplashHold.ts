"use client";

import { useEffect, useState } from "react";
import { markSplashComplete, shouldShowSplash } from "@/lib/loading/splashSession";

/** Gather animation + stagger ≈ 2.4s */
export const SPLASH_MIN_MS = 2500;

export function useSplashHold(enabled: boolean) {
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      setFinished(true);
      return;
    }

    if (!shouldShowSplash()) {
      setActive(false);
      setFinished(true);
      return;
    }

    setActive(true);
    setFinished(false);

    const timer = window.setTimeout(() => {
      markSplashComplete();
      setActive(false);
      setFinished(true);
    }, SPLASH_MIN_MS);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  return { splashActive: active, splashFinished: finished };
}
