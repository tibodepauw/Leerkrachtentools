"use client";

import { useState } from "react";

export interface AnalysisResponse<T> {
  data: T;
  provider: string;
  fallbackErrors: string[];
}

export function useAnalysis<T>() {
  const [result, setResult] = useState<AnalysisResponse<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(url: string, body: Record<string, unknown>) {
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
      setResult(payload);
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

  return { analyze, result, setResult, loading, error };
}
