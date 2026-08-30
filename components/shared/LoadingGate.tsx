"use client";

import { useEffect, type ReactNode } from "react";
import { AppLoadingScreen } from "@/components/shared/AppLoadingScreen";
import { MinimalLoadingScreen } from "@/components/shared/MinimalLoadingScreen";
import {
  initSplashSession,
} from "@/lib/loading/splashSession";
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
  ensureSplashSession();

  const resolvedIntent =
    intent === "auto" ? resolveLoadingIntent() : intent;

  const phase = useLoadingPresentation(loading, resolvedIntent);

  useEffect(() => {
    ensureSplashSession();
  }, []);

  if (phase === "content") {
    return children;
  }

  if (phase === "hidden") {
    return <div className="min-h-screen bg-black" aria-hidden="true" />;
  }

  if (phase === "minimal") {
    return <MinimalLoadingScreen label={label} />;
  }

  return <AppLoadingScreen label={label} />;
}

export function useInitialSplashIntent(): "splash" | "quick" {
  ensureSplashSession();
  return resolveLoadingIntent();
}
