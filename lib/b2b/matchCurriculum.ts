import { searchLocalCorpus } from "@/lib/rag/curriculumCorpus";
import { collectMinimumGoalCandidates } from "@/lib/rag/minimumGoalCandidates";
import {
  MINIMUM_GOALS_TOP_N,
  rankMinimumGoalResults,
} from "@/lib/rag/minimumGoalRanking";
import { runProCurriculumAnalysis } from "@/lib/rag/runProCurriculumAnalysis";
import { CURRICULUM_PRO_RETRIEVAL_N } from "@/lib/rag/selectProCurriculumGoals";
import type { CurriculumSearchResult } from "@/types";
import {
  resolveMatchSearchTarget,
  type PublisherLevel,
  type PublisherNetwork,
} from "@/lib/b2b/publisherNetwork";

export type CurriculumMatchResult = {
  code: string;
  text: string;
  network: string;
  score: number;
  didactic_note?: string;
};

function resultText(result: CurriculumSearchResult) {
  const minimum = result.gelinktMinimumdoel?.tekst?.trim();
  if (minimum) return minimum;
  return result.titel.trim() || result.toelichting.trim();
}

function resultCode(result: CurriculumSearchResult) {
  return (
    result.gelinktMinimumdoel?.code?.trim() ||
    result.code.trim() ||
    result.gelinktMinimumdoel?.rawCode?.trim() ||
    ""
  );
}

export function toCurriculumMatchResult(
  result: CurriculumSearchResult & { score?: number },
): CurriculumMatchResult | null {
  const code = resultCode(result);
  const text = resultText(result);
  if (!code || !text) return null;
  const note = (result.proWhy || result.toelichting || "").trim();
  return {
    code,
    text,
    network: result.netwerk || "ALL",
    score: Number(result.score ?? 0),
    ...(note ? { didactic_note: note } : {}),
  };
}

export async function matchCurriculumGoals({
  query,
  network,
  level,
  grade,
  mode,
  orgId,
}: {
  query: string;
  network: PublisherNetwork;
  level: PublisherLevel;
  grade?: string;
  mode: "snel" | "pro";
  orgId: string;
}): Promise<CurriculumMatchResult[]> {
  const target = resolveMatchSearchTarget(network, level);
  const limit = mode === "pro" ? CURRICULUM_PRO_RETRIEVAL_N : 8;

  let retrieved: Array<CurriculumSearchResult & { score?: number }> =
    target.kind === "minimum-goals"
      ? rankMinimumGoalResults(
          query,
          collectMinimumGoalCandidates({
            query,
            educationLevel: target.educationLevel,
            limit: Math.max(limit, 50),
          }),
          mode === "pro" ? limit : MINIMUM_GOALS_TOP_N,
          {
            grade: "",
            educationLevel: target.educationLevel,
          },
        )
      : searchLocalCorpus({
          query,
          network: target.network,
          educationLevel: target.educationLevel,
          limit,
        });

  if (mode === "pro" && retrieved.length > 0) {
    const analysis = await runProCurriculumAnalysis({
      query,
      retrieved,
      lesson: {
        topic: query,
        learningArea: "",
        grade: grade ?? "",
        ageRange: "",
        phases: [],
      },
      userId: `b2b:${orgId}`,
      tier: "partner",
      kind: target.kind === "minimum-goals" ? "minimumdoel" : "leerplandoel",
    });
    retrieved = analysis.merged;
  }

  return retrieved
    .map((result) => toCurriculumMatchResult(result))
    .filter((result): result is CurriculumMatchResult => result !== null);
}
