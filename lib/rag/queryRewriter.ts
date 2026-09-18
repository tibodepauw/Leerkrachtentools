import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { getModelCandidates } from "@/lib/ai/providers";
import {
  getUserAiConfig,
  userAiConfigHasCredentials,
} from "@/lib/ai/userCredentials";
import { recordSecurityEvent } from "@/lib/security/events";
import { reserveExternalCall } from "@/lib/ai/externalBudget";

const rewriteSchema = z.object({
  expandedQuery: z.string(),
  disciplineHint: z.string(),
});

export type QueryRewriteResult = z.infer<typeof rewriteSchema> & {
  usedLlm: boolean;
  dispatched: boolean;
};

const REWRITE_SYSTEM_PROMPT =
  "Herschrijf de zoekopdracht van de leerkracht naar een verrijkte zoekterm voor RAG-retrieval in Vlaamse leerplannen. Bepaal de discipline/vak en onderwijssynoniemen. Geef enkel een JSON-object terug: { expandedQuery: string, disciplineHint: string }.";

function localRewrite(query: string): QueryRewriteResult {
  return {
    expandedQuery: query,
    disciplineHint: "",
    usedLlm: false,
    dispatched: false,
  };
}

export async function rewriteRagQuery(
  query: string,
  options: { userId?: string; requestId?: string; signal?: AbortSignal } = {},
): Promise<QueryRewriteResult> {
  options.signal?.throwIfAborted();
  let userAiConfig = null;
  if (options.userId) {
    userAiConfig = getUserAiConfig(options.userId);
    if (userAiConfig?.enabled && !userAiConfigHasCredentials(userAiConfig)) {
      recordSecurityEvent({
        kind: "rag_rewrite_skipped",
        requestId: options.requestId ?? "rag-rewrite",
        detail: "credential_error",
      });
      return localRewrite(query);
    }
  }

  const candidates = getModelCandidates(undefined, userAiConfig);
  const candidate = candidates[0];
  if (!candidate) {
    recordSecurityEvent({
      kind: "rag_rewrite_skipped",
      requestId: options.requestId ?? "rag-rewrite",
      detail: "no_provider",
    });
    return localRewrite(query);
  }

  if (!userAiConfig?.enabled && !reserveExternalCall("server-ai")) return localRewrite(query);
  try {
    const result = await generateText({
      model: candidate.model,
      system: REWRITE_SYSTEM_PROMPT,
      prompt: query,
      output: Output.object({ schema: rewriteSchema }),
      maxOutputTokens: 256,
      temperature: 0.1,
      maxRetries: 0,
      abortSignal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(5_000)]) : AbortSignal.timeout(5_000),
    });

    const parsed = rewriteSchema.parse(result.output);
    recordSecurityEvent({
      kind: "rag_rewrite_ok",
      requestId: options.requestId ?? "rag-rewrite",
      detail: candidate.name,
    });
    return {
      expandedQuery: parsed.expandedQuery.trim() || query,
      disciplineHint: parsed.disciplineHint.trim(),
      usedLlm: true,
      dispatched: true,
    };
  } catch {
    recordSecurityEvent({
      kind: "rag_rewrite_failed",
      requestId: options.requestId ?? "rag-rewrite",
      detail: candidate.name,
    });
    return {
      expandedQuery: query,
      disciplineHint: "",
      usedLlm: true,
      dispatched: true,
    };
  }
}

export function buildSearchQueryFromRewrite(
  originalQuery: string,
  rewrite: QueryRewriteResult,
): string {
  const expanded = rewrite.expandedQuery.trim() || originalQuery;
  const hint = rewrite.disciplineHint.trim();
  return hint ? `${expanded} ${hint}`.trim() : expanded;
}

export async function resolveRagSearchQuery(
  query: string,
  enableLlmQueryRewriting: boolean,
  options: { userId?: string; requestId?: string; signal?: AbortSignal } = {},
): Promise<{
  searchQuery: string;
  rewrite: QueryRewriteResult | null;
}> {
  if (!enableLlmQueryRewriting) {
    return { searchQuery: query, rewrite: null };
  }

  const rewrite = await rewriteRagQuery(query, options);
  return {
    searchQuery: buildSearchQueryFromRewrite(query, rewrite),
    rewrite,
  };
}
