"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { detachClientUserStorage } from "@/lib/storage/clientUserSession";
import { subscribeSessionChange } from "@/lib/storage/sessionSync";
import { resetPostHogIdentity } from "@/components/providers/posthog-provider";

export function SessionBoundary({ userId, children }: { userId: string; children: ReactNode }) {
  const [verified, setVerified] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stopped = false;
    let controller: AbortController | undefined;
    const reset = () => {
      if (stopped) return;
      stopped = true;
      setVerified(false);
      controller?.abort();
      detachClientUserStorage();
      resetPostHogIdentity();
      window.location.replace("/");
    };
    const verify = async () => {
      if (stopped) return;
      setVerified(false);
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store", signal: AbortSignal.any([current.signal, AbortSignal.timeout(10_000)]),
        });
        const session = await response.json() as { userId?: string };
        if (stopped || current.signal.aborted) return;
        if (response.status === 401 || (response.ok && session.userId !== userId)) reset();
        else if (response.ok) setVerified(true);
      } catch {
        if (!stopped && !current.signal.aborted) setVerified(false);
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") setVerified(false);
      else void verify();
    };
    const unsubscribe = subscribeSessionChange(reset);
    const hideBeforeHistorySnapshot = () => {
      if (content.current) content.current.hidden = true;
      setVerified(false);
    };
    window.addEventListener("focus", verify);
    window.addEventListener("pageshow", verify);
    window.addEventListener("pagehide", hideBeforeHistorySnapshot);
    document.addEventListener("visibilitychange", visibility);
    void verify();
    return () => {
      stopped = true;
      controller?.abort();
      unsubscribe();
      window.removeEventListener("focus", verify);
      window.removeEventListener("pageshow", verify);
      window.removeEventListener("pagehide", hideBeforeHistorySnapshot);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [userId]);
  return <>
    <div ref={content} hidden={!verified} inert={!verified}>{children}</div>
    {!verified && <p role="status" className="p-6">Sessie controleren… Maak verbinding en keer terug naar dit tabblad.</p>}
  </>;
}
