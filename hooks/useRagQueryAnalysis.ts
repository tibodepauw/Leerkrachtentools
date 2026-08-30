"use client";

import { useCallback } from "react";
import { useAnalysis, type AnalysisResponse } from "@/hooks/useAnalysis";
import {
  readRagQueryCache,
  writeRagQueryCache,
  type RagQueryEndpoint,
} from "@/lib/rag/clientQueryCache";
import type { CurriculumNetworkFilter, EducationLevelFilter } from "@/types";

type RagAnalyzeParams = {
  endpoint: RagQueryEndpoint;
  educationLevel: EducationLevelFilter;
  network?: CurriculumNetworkFilter;
  body: Record<string, unknown>;
};

export function useRagQueryAnalysis<T>(scopeKey: string) {
  const { analyze, result, setResult, loading, error } =
    useAnalysis<T>(scopeKey);

  const analyzeRag = useCallback(
    async (params: RagAnalyzeParams): Promise<AnalysisResponse<T> | null> => {
      const query = String(params.body.goal ?? "").trim();
      const network = params.network ?? "-";
      const cached = readRagQueryCache<T>(
        params.endpoint,
        params.educationLevel,
        network,
        query,
      );

      if (cached) {
        const payload: AnalysisResponse<T> = cached;
        setResult(payload);
        return payload;
      }

      const url =
        params.endpoint === "rag-minimum-goals"
          ? "/api/rag-minimum-goals"
          : "/api/rag-curriculum";
      const payload = await analyze(url, params.body);
      if (payload) {
        writeRagQueryCache(
          params.endpoint,
          params.educationLevel,
          network,
          query,
          payload,
        );
      }
      return payload;
    },
    [analyze, setResult],
  );

  return { analyzeRag, result, loading, error };
}
