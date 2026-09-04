"use client";

import { useCallback, useRef, useState } from "react";
import { formatClientRequestError } from "@/lib/http/clientError";

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
      });
      let payload: AnalysisResponse<T> | { error?: string; corpusNotice?: string };
      try {
        payload = (await response.json()) as
          | AnalysisResponse<T>
          | { error?: string; corpusNotice?: string };
      } catch (parseError) {
        console.error(`[${url}] ongeldig antwoord`, parseError, {
          status: response.status,
        });
        throw new Error("De server gaf een ongeldig antwoord. Probeer het opnieuw.");
      }
      if (requestId !== requestIdRef.current) {
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
      setLatestResult(payload);
      if (cacheKey) {
        setResultCache((cache) => ({ ...cache, [cacheKey]: payload }));
      }
      return payload;
    } catch (caught) {
      console.error(`[${url}]`, caught);
      if (requestId !== requestIdRef.current) {
        return null;
      }
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
