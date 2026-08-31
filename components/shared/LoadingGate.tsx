"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppLoadingScreen } from "@/components/shared/AppLoadingScreen";
import { MinimalLoadingScreen } from "@/components/shared/MinimalLoadingScreen";
import { initSplashSession } from "@/lib/loading/splashSession";
import {
  resolveLoadingIntent,
  useLoadingPresentation,
} from "@/hooks/useLoadingPresentation";

interface LoadingGateProps {
  loading: boolean;
  /** splash = wordmark (first site load); quick = delay then spinner only if slow */
  intent?: "splash" | "quick" | "auto";
  label?: string;
  children: ReactNode;
}

/** SSR-safe placeholder — must match server + first client paint. */
function LoadingPlaceholder() {
  return <div className="min-h-screen bg-black" aria-hidden="true" />;
}

let splashSessionInitialized = false;

function ensureSplashSession() {
  if (splashSessionInitialized || typeof window === "undefined") return;
  splashSessionInitialized = true;
  initSplashSession();
}

export function LoadingGate({
  loading,
  intent = "auto",
  label,
  children,
}: LoadingGateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    ensureSplashSession();
    setMounted(true);
  }, []);

  // Keep first client render identical to SSR (always "quick" for auto).
  const resolvedIntent =
    intent === "auto" ? (mounted ? resolveLoadingIntent() : "quick") : intent;

  const phase = useLoadingPresentation(loading, resolvedIntent);

  if (phase === "content") {
    return children;
  }

  if (!mounted) {
    return <LoadingPlaceholder />;
  }

  if (phase === "hidden") {
    return <LoadingPlaceholder />;
  }

  if (phase === "minimal") {
    return <MinimalLoadingScreen label={label} />;
  }

  return <AppLoadingScreen label={label} />;
}
