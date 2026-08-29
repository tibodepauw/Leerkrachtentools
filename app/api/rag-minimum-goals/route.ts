import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { searchDiscoveryEngine } from "@/lib/rag/discoveryEngine";
import {
  enrichHitFromCorpus,
  isStructuredResult,
  sanitizeStructuredResult,
  searchMinimumGoals,
} from "@/lib/rag/curriculumCorpus";
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

    const discovery = await searchDiscoveryEngine({
      query,
      network: "ALL",
      pageSize: 16,
    });

    const enrichedFromDiscovery = discovery.hits
      .map((hit) => enrichHitFromCorpus(hit, query, "ALL"))
      .filter(
        (item): item is CurriculumSearchResult & { score: number } =>
          item !== null && isStructuredResult(item) && hasMinimumGoal(item),
      );

    const ranked =
      enrichedFromDiscovery.length > 0
        ? enrichedFromDiscovery
        : searchMinimumGoals({ query, limit: 12 });

    const merged = rankMinimumGoalResults(
      query,
      [...ranked].filter(hasMinimumGoal).map(sanitizeStructuredResult),
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
            ? `Top ${merged.length} bestpassende Vlaamse minimumdoel${merged.length === 1 ? "" : "en"} — hoogste match bovenaan.`
            : "Geen passend minimumdoel gevonden. Probeer je lesdoel anders te formuleren.",
        retrievalMode: "minimum-goals",
      },
      provider: "google-discovery-engine",
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
