"use client";
import { captureAnalytics, ANALYTICS_MODULES } from "@/lib/analytics/consent";
import { logSafeError } from "@/lib/security/safeLog";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatClientRequestError } from "@/lib/http/clientError";
import { captureStorageSession } from "@/lib/storage/userStorageScope";

export interface AnalysisResponse<T> {
  data: T;
  provider: string;
  fallbackErrors: string[];
}

export function useAnalysis<T>(scopeKey?: string) {
  const [latestResult, setLatestResult] = useState<AnalysisResponse<T> | null>(
    null,
  );
  const [resultCache, setResultCache] = useState<
    Record<string, AnalysisResponse<T>>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { activeRequest.current?.abort(); requestIdRef.current += 1; }, []);

  const setResult = useCallback(
    (payload: AnalysisResponse<T> | null) => {
      setLatestResult(payload);
      if (scopeKey && payload) {
        setResultCache((cache) => ({ ...cache, [scopeKey]: payload }));
      }
    },
    [scopeKey],
  );

  async function analyze(url: string, body: Record<string, unknown>) {
    const names: Record<string,string> = { "extract-manual": "manual-scanner", "analyze-goals": "goal-optimizer", "classify-goal-taxonomy": "goal-taxonomy", "rag-curriculum": "curriculum-rag", "rag-minimum-goals": "minimum-goals", "format-dialogue": "dialogue-formatter", "spellcheck": "spellcheck", "audit-timing": "timing-check", "audit-alignment": "alignment", "audit-engagement": "engagement", "full-audit": "full-audit", "transcribe-reflection": "voice-reflection" };
    const feature = names[url.slice(5)] ?? "";
    const measure = (event: string) => { if (ANALYTICS_MODULES.has(feature)) captureAnalytics(event, feature); };
    measure("feature_started");
    const session = captureStorageSession();
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const cacheKey = scopeKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.any([session.signal, controller.signal]),
      });
      let payload: AnalysisResponse<T> | { error?: string; corpusNotice?: string };
      try {
        payload = (await response.json()) as
          | AnalysisResponse<T>
          | { error?: string; corpusNotice?: string };
      } catch (parseError) {
        logSafeError("analysis-invalid-json", parseError);
        throw new Error("De server gaf een ongeldig antwoord. Probeer het opnieuw.");
      }
      if (!session.isCurrent() || controller.signal.aborted || requestId !== requestIdRef.current) {
        return null;
      }
      if (response.status === 401) {
        window.location.reload();
        throw new Error("Je sessie is verlopen.");
      }
      if (!response.ok || !("data" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "corpusNotice" in payload && payload.corpusNotice
              ? payload.corpusNotice
              : "De analyse is mislukt.",
        );
      }
      measure("feature_completed");
      setLatestResult(payload);
      if (cacheKey) {
        setResultCache((cache) => ({ ...cache, [cacheKey]: payload }));
      }
      return payload;
    } catch (caught) {
      if (!session.isCurrent() || controller.signal.aborted || requestId !== requestIdRef.current) {
        return null;
      }
      measure("feature_failed");
      setError(formatClientRequestError(caught));
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  const result =
    scopeKey !== undefined ? (resultCache[scopeKey] ?? null) : latestResult;

  return { analyze, result, setResult, loading, error };
}
