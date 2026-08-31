"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppLoadingScreen } from "@/components/shared/AppLoadingScreen";
import { MinimalLoadingScreen } from "@/components/shared/MinimalLoadingScreen";
import { initSplashSession } from "@/lib/loading/splashSession";
import { useLoadingPresentation } from "@/hooks/useLoadingPresentation";
import { useSplashHold } from "@/hooks/useSplashHold";

interface LoadingGateProps {
  loading: boolean;
  /** splash = wordmark (first site load); quick = delay then spinner only if slow */
  intent?: "splash" | "quick" | "auto";
  label?: string;
  children: ReactNode;
}

/** SSR-safe placeholder: must match server + first client paint. */
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

  const wantsAutoSplash = intent === "auto" || intent === "splash";
  const { splashActive, splashFinished } = useSplashHold(
    mounted && wantsAutoSplash,
  );

  const quickPhase = useLoadingPresentation(
    mounted && splashFinished && !splashActive ? loading : false,
  );

  if (!mounted) {
    return <LoadingPlaceholder />;
  }

  if (splashActive) {
    return <AppLoadingScreen label={label} />;
  }

  if (quickPhase === "hidden") {
    return <LoadingPlaceholder />;
  }

  if (quickPhase === "minimal") {
    return <MinimalLoadingScreen label={label} />;
  }

  return children;
}
