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

export async function runProCurriculumAnalysis({
  query,
  retrieved,
  lesson,
  userId,
  tier,
  kind = "leerplandoel",
  fallbackLimit = CURRICULUM_TOP_N,
}: {
  query: string;
  retrieved: CurriculumSearchResult[];
  lesson: ProLessonContext;
  userId: string;
  tier: string;
  kind?: ProCurriculumKind;
  fallbackLimit?: number;
}): Promise<ProCurriculumAnalysisResult> {
  if (retrieved.length === 0) {
    return {
      merged: [],
      provider: "jsonl-corpus+discovery-engine",
      corpusNotice: "",
      proFallback: false,
    };
  }

  try {
    const userAiConfig = getUserAiConfig(userId);
    if (!hasAnyAiProvider(userAiConfig)) {
      return fallbackResult(retrieved, PRO_FALLBACK_NOTICES.noProvider, fallbackLimit);
    }

    const access = checkServerAiAccess({ userId, tier, userAiConfig });
    if (!access.allowed) {
      const notice =
        access.status === 429
          ? PRO_FALLBACK_NOTICES.quota
          : withProFallbackSentence(access.message);
      return fallbackResult(retrieved, notice, fallbackLimit);
    }

    const tracked = await runWithServerAiQuota(access, userId, () =>
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
      }),
    );

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
    console.error("[rag-curriculum:pro]", error);
    return fallbackResult(retrieved, PRO_FALLBACK_NOTICES.aiError, fallbackLimit);
  }
}
