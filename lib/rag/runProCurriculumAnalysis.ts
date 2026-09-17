import { hasAnyAiProvider } from "@/lib/ai/providers";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { proCurriculumPicksSchema } from "@/lib/ai/schemas";
import {
  checkServerAiAccess,
  runWithServerAiQuota,
} from "@/lib/ai/serverAccess";
import { getUserAiConfig } from "@/lib/ai/userCredentials";
import { CURRICULUM_TOP_N } from "@/lib/rag/curriculumCorpus";
import {
  buildProCurriculumPrompt,
  groundProPicks,
  PRO_FALLBACK_NOTICES,
  withProFallbackSentence,
  type ProCurriculumKind,
  type ProLessonContext,
} from "@/lib/rag/selectProCurriculumGoals";
import type { CurriculumSearchResult } from "@/types";

export type ProCurriculumAnalysisResult = {
  merged: CurriculumSearchResult[];
  provider: string;
  corpusNotice: string;
  proFallback: boolean;
};

function fallbackResult(
  retrieved: CurriculumSearchResult[],
  notice: string,
  fallbackLimit: number,
): ProCurriculumAnalysisResult {
  return {
    merged: retrieved.slice(0, fallbackLimit),
    provider: "jsonl-corpus+discovery-engine",
    corpusNotice: notice,
    proFallback: true,
  };
}

export type ProCurriculumBudget =
  | { kind: "user"; userId: string; tier: string }
  | { kind: "org"; orgId: string };

export async function runProCurriculumAnalysis({
  query,
  retrieved,
  lesson,
  budget,
  kind = "leerplandoel",
  fallbackLimit = CURRICULUM_TOP_N,
  signal,
}: {
  query: string;
  retrieved: CurriculumSearchResult[];
  lesson: ProLessonContext;
  budget: ProCurriculumBudget;
  kind?: ProCurriculumKind;
  fallbackLimit?: number;
  signal?: AbortSignal;
}): Promise<ProCurriculumAnalysisResult> {
  signal?.throwIfAborted();
  if (retrieved.length === 0) {
    return {
      merged: [],
      provider: "jsonl-corpus+discovery-engine",
      corpusNotice: "",
      proFallback: false,
    };
  }

  try {
    const userId = budget.kind === "user" ? budget.userId : undefined;
    const userAiConfig = userId ? getUserAiConfig(userId) : null;
    if (!hasAnyAiProvider(userAiConfig)) {
      return fallbackResult(retrieved, PRO_FALLBACK_NOTICES.noProvider, fallbackLimit);
    }

    const runAnalysis = () =>
      runStructured({
        schema: proCurriculumPicksSchema,
        system: prompts.curriculumPro,
        prompt: buildProCurriculumPrompt({ query, retrieved, lesson, kind }),
        mock: {
          picks: [
            {
              code: "UNUSED",
              why: "unused",
              lessonPhase: "Verwerking",
            },
          ],
        },
        allowLocalMock: false,
        userAiConfig,
        maxOutputTokens: 1200,
        abortSignal: signal,
      });

    let tracked:
      | { ok: true; result: Awaited<ReturnType<typeof runAnalysis>> }
      | { ok: false };

    if (budget.kind === "org") {
      try {
        tracked = { ok: true, result: await runAnalysis() };
      } catch (error) {
        signal?.throwIfAborted();
        console.error("[rag-curriculum:pro]", error);
        return fallbackResult(retrieved, PRO_FALLBACK_NOTICES.aiError, fallbackLimit);
      }
    } else {
      const access = checkServerAiAccess({
        userId: budget.userId,
        tier: budget.tier,
        userAiConfig,
      });
      if (!access.allowed) {
        const notice =
          access.status === 429
            ? PRO_FALLBACK_NOTICES.quota
            : withProFallbackSentence(access.message);
        return fallbackResult(retrieved, notice, fallbackLimit);
      }

      tracked = await runWithServerAiQuota(access, budget.userId, runAnalysis);
    }

    if (!tracked.ok) {
      return fallbackResult(retrieved, PRO_FALLBACK_NOTICES.quota, fallbackLimit);
    }

    const grounded = groundProPicks(retrieved, tracked.result.data.picks);
    if (grounded.length === 0) {
      return fallbackResult(retrieved, PRO_FALLBACK_NOTICES.ungrounded, fallbackLimit);
    }

    const count = grounded.length;
    const noun =
      kind === "minimumdoel"
        ? `minimumdoel${count === 1 ? "" : "en"}`
        : `leerplandoel${count === 1 ? "" : "en"}`;
    return {
      merged: grounded,
      provider: `jsonl-corpus+discovery-engine+${tracked.result.provider}`,
      corpusNotice: `${count} beargumenteerde ${noun} uit de officiële corpus, gekozen bij je lesactiviteit.`,
      proFallback: false,
    };
  } catch (error) {
    signal?.throwIfAborted();
    console.error("[rag-curriculum:pro]", error);
    return fallbackResult(retrieved, PRO_FALLBACK_NOTICES.aiError, fallbackLimit);
  }
}
