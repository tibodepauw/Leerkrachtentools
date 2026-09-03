import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getGoogleModelId } from "@/lib/ai/googleModel";

const rewriteSchema = z.object({
  expandedQuery: z.string(),
  disciplineHint: z.string(),
});

export type QueryRewriteResult = z.infer<typeof rewriteSchema> & {
  usedLlm: boolean;
};

const REWRITE_SYSTEM_PROMPT =
  "Herschrijf de zoekopdracht van de leerkracht naar een verrijkte zoekterm voor RAG-retrieval in Vlaamse leerplannen. Bepaal de discipline/vak en onderwijssynoniemen. Geef enkel een JSON-object terug: { expandedQuery: string, disciplineHint: string }.";

export async function rewriteRagQuery(query: string): Promise<QueryRewriteResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey?.trim()) {
    return { expandedQuery: query, disciplineHint: "", usedLlm: false };
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const model = google(getGoogleModelId());

  try {
    const result = await generateText({
      model,
      system: REWRITE_SYSTEM_PROMPT,
      prompt: query,
      output: Output.object({ schema: rewriteSchema }),
      maxOutputTokens: 256,
      temperature: 0.1,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(5_000),
    });

    const parsed = rewriteSchema.parse(result.output);
    return {
      expandedQuery: parsed.expandedQuery.trim() || query,
      disciplineHint: parsed.disciplineHint.trim(),
      usedLlm: true,
    };
  } catch {
    return { expandedQuery: query, disciplineHint: "", usedLlm: false };
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
): Promise<{
  searchQuery: string;
  rewrite: QueryRewriteResult | null;
}> {
  if (!enableLlmQueryRewriting) {
    return { searchQuery: query, rewrite: null };
  }

  const rewrite = await rewriteRagQuery(query);
  return {
    searchQuery: buildSearchQueryFromRewrite(query, rewrite),
    rewrite,
  };
}
