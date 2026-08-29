import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { searchDiscoveryEngine } from "@/lib/rag/discoveryEngine";
import {
  enrichHitFromCorpus,
  isStructuredResult,
} from "@/lib/rag/curriculumCorpus";
import {
  collectMinimumGoalCandidates,
  mergeMinimumGoalCandidatePools,
  sanitizeMinimumGoalForResponse,
} from "@/lib/rag/minimumGoalCandidates";
import {
  MINIMUM_GOALS_TOP_N,
  rankMinimumGoalResults,
} from "@/lib/rag/minimumGoalRanking";
import type { CurriculumSearchResult } from "@/types";

function hasMinimumGoal(
  result: CurriculumSearchResult,
): result is CurriculumSearchResult & {
  gelinktMinimumdoel: NonNullable<CurriculumSearchResult["gelinktMinimumdoel"]>;
} {
  return Boolean(result.gelinktMinimumdoel?.tekst);
}

export async function POST(request: Request) {
  if (!sessionFromRequest(request)) return unauthorizedResponse();

  try {
    const body = (await request.json()) as { goal?: string };
    const query = body.goal?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Vul eerst een lesdoel in." },
        { status: 400 },
      );
    }

    const localCandidates = collectMinimumGoalCandidates({ query, limit: 50 });

    let discoveryCandidates: Array<CurriculumSearchResult & { score: number }> =
      [];
    try {
      const discovery = await searchDiscoveryEngine({
        query,
        network: "ALL",
        pageSize: 16,
      });

      discoveryCandidates = discovery.hits
        .map((hit) => enrichHitFromCorpus(hit, query, "ALL"))
        .filter(
          (item): item is CurriculumSearchResult & { score: number } =>
            item !== null && isStructuredResult(item) && hasMinimumGoal(item),
        );
    } catch {
      discoveryCandidates = [];
    }

    const candidatePool = mergeMinimumGoalCandidatePools(
      [localCandidates, discoveryCandidates],
      50,
    );

    const merged = rankMinimumGoalResults(
      query,
      candidatePool.filter(hasMinimumGoal).map(sanitizeMinimumGoalForResponse),
      MINIMUM_GOALS_TOP_N,
    );

    const goal = merged[0] ?? null;
    const alternatives = merged.slice(1);

    return NextResponse.json({
      data: {
        goal: goal ?? "niet gevonden",
        alternatives,
        corpusNotice:
          merged.length > 0
            ? `Top ${Math.min(merged.length, MINIMUM_GOALS_TOP_N)} bestpassende Vlaamse minimumdoelen — hoogste match bovenaan.`
            : "Geen passend minimumdoel gevonden. Probeer je lesdoel anders te formuleren.",
        retrievalMode: "minimum-goals-hybrid",
      },
      provider: "jsonl-corpus+discovery-engine",
      fallbackErrors: [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Minimumdoelenzoekopdracht mislukt.",
      },
      { status: 500 },
    );
  }
}
