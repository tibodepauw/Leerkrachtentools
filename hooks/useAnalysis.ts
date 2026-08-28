"use client";

import { useCallback, useState } from "react";

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
    setLoading(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as
        | AnalysisResponse<T>
        | { error?: string };
      if (response.status === 401) {
        window.location.reload();
        throw new Error("Je sessie is verlopen.");
      }
      if (!response.ok || !("data" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "De analyse is mislukt.",
        );
      }
      setLatestResult(payload);
      if (cacheKey) {
        setResultCache((cache) => ({ ...cache, [cacheKey]: payload }));
      }
      return payload;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "De analyse is mislukt.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  const result =
    scopeKey !== undefined ? (resultCache[scopeKey] ?? null) : latestResult;

  return { analyze, result, setResult, loading, error };
}
