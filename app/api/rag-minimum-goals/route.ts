import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { searchDiscoveryEngine } from "@/lib/rag/discoveryEngine";
import {
  dedupeByMinimumGoalCode,
  enrichHitFromCorpus,
  isStructuredResult,
  sanitizeStructuredResult,
  searchMinimumGoals,
} from "@/lib/rag/curriculumCorpus";
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

    const merged = dedupeByMinimumGoalCode(
      [...ranked]
        .filter(hasMinimumGoal)
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
        .map(sanitizeStructuredResult),
      6,
    );

    const goal = merged[0] ?? null;
    const alternatives = merged.slice(1);

    return NextResponse.json({
      data: {
        goal: goal ?? "niet gevonden",
        alternatives,
        corpusNotice:
          merged.length > 0
            ? `${merged.length} bestpassende Vlaamse minimumdoel${merged.length === 1 ? "" : "en"} gevonden op basis van je lesdoel.`
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
