"use client";

import { useEffect, useRef, useState } from "react";

/** Skip loader on fast client navigations (e.g. instellingen). */
const QUICK_DELAY_MS = 320;

export type LoadingPhase = "content" | "hidden" | "minimal";

export function useLoadingPresentation(loading: boolean): LoadingPhase {
  const [phase, setPhase] = useState<LoadingPhase>(() =>
    loading ? "hidden" : "content",
  );
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!loading) {
      setPhase("content");
      return;
    }

    setPhase("hidden");
    const delayTimer = window.setTimeout(() => {
      if (loadingRef.current) setPhase("minimal");
    }, QUICK_DELAY_MS);

    return () => window.clearTimeout(delayTimer);
  }, [loading]);

  return phase;
}
