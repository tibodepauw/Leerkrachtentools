import { UNKNOWN_SOURCE_METADATA } from "@/lib/rag/outputLimit";
import { searchLocalCorpus } from "@/lib/rag/curriculumCorpus";
import { collectMinimumGoalCandidates } from "@/lib/rag/minimumGoalCandidates";
import { rankMinimumGoalResults } from "@/lib/rag/minimumGoalRanking";
import { runProCurriculumAnalysis } from "@/lib/rag/runProCurriculumAnalysis";
import { CURRICULUM_PRO_RETRIEVAL_N } from "@/lib/rag/selectProCurriculumGoals";
import type { CurriculumSearchResult } from "@/types";
import {
  CURRICULUM_MATCH_LIMIT_DEFAULT,
  CURRICULUM_MATCH_LIMIT_MAX,
} from "@/lib/b2b/schemas";
import {
  resolveMatchSearchTarget,
  type PublisherLevel,
  type PublisherNetwork,
} from "@/lib/b2b/publisherNetwork";

export const CURRICULUM_MATCH_RESULT_KEYS = [
  "code",
  "text",
  "network",
  "score",
  "didactic_note",
] as const;

export type CurriculumMatchResult = {
  code: string;
  text: string;
  network: string;
  score: number;
  didactic_note?: string;
};

const CITATION_TEXT_MAX = 500;

function citationText(result: CurriculumSearchResult) {
  const minimum = result.gelinktMinimumdoel?.tekst?.trim();
  const core = (minimum || result.titel.trim()).replace(/\s+/g, " ").trim();
  const paragraph = core.split(/\n{2,}/)[0]?.trim() || core;
  if (paragraph.length <= CITATION_TEXT_MAX) return paragraph;
  return `${paragraph.slice(0, CITATION_TEXT_MAX - 3).trimEnd()}...`;
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
  const text = citationText(result);
  if (!code || !text) return null;
  const note = result.proWhy?.trim();
  return {
    code,
    text,
    network: result.netwerk || "ALL",
    score: Number(result.score ?? 0),
    ...(note ? { didactic_note: note } : {}),
  };
}

function clampMatchLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return CURRICULUM_MATCH_LIMIT_DEFAULT;
  }
  return Math.min(
    CURRICULUM_MATCH_LIMIT_MAX,
    Math.max(1, Math.trunc(limit)),
  );
}

export type CurriculumMatchPayload = {
  results: CurriculumMatchResult[];
  requestedMode: "snel" | "pro";
  executedMode: "snel" | "pro";
  proFallback: boolean;
  sourceMetadata: { version: null; status: "ONBEKEND"; notice: string };
};

export async function matchCurriculumGoals({
  query,
  network,
  level,
  grade,
  mode,
  orgId,
  limit,
  signal,
}: {
  query: string;
  network: PublisherNetwork;
  level: PublisherLevel;
  grade?: string;
  mode: "snel" | "pro";
  orgId: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CurriculumMatchPayload> {
  signal?.throwIfAborted();
  const outputLimit = clampMatchLimit(limit);
  const target = resolveMatchSearchTarget(network, level);
  const retrievalLimit =
    mode === "pro"
      ? Math.max(CURRICULUM_PRO_RETRIEVAL_N, outputLimit)
      : outputLimit;

  let retrieved: Array<CurriculumSearchResult & { score?: number }> =
    target.kind === "minimum-goals"
      ? rankMinimumGoalResults(
          query,
          collectMinimumGoalCandidates({
            query,
            educationLevel: target.educationLevel,
            limit: Math.max(retrievalLimit, 50),
          }),
          retrievalLimit,
          {
            grade: "",
            educationLevel: target.educationLevel,
          },
        )
      : searchLocalCorpus({
          query,
          network: target.network,
          educationLevel: target.educationLevel,
          limit: retrievalLimit,
        });

  let executedMode: "snel" | "pro" = "snel";
  let proFallback = false;

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
      budget: { kind: "org", orgId },
      signal,
      kind: target.kind === "minimum-goals" ? "minimumdoel" : "leerplandoel",
    });
    retrieved = analysis.merged;
    executedMode = analysis.proFallback ? "snel" : "pro";
    proFallback = analysis.proFallback;
  }

  signal?.throwIfAborted();
  const results = retrieved
    .map((result) => toCurriculumMatchResult(result))
    .filter((result): result is CurriculumMatchResult => result !== null)
    .slice(0, outputLimit);

  return {
    results,
    sourceMetadata: UNKNOWN_SOURCE_METADATA,
    requestedMode: mode,
    executedMode,
    proFallback: mode === "pro" ? proFallback : false,
  };
}
