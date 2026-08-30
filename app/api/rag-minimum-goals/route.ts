import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { approvedTierResponse } from "@/lib/ai/serverAccess";
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
import { normalizeAhovoksMinimumGoalResult } from "@/lib/rag/ahovoksMinimumGoals";
import {
  MINIMUM_GOALS_TOP_N,
  rankMinimumGoalResults,
} from "@/lib/rag/minimumGoalRanking";
import { resultMatchesEducationLevel } from "@/lib/rag/educationLevel";
import type {
  CurriculumSearchResult,
  EducationLevelFilter,
  TargetGroupSearchContext,
} from "@/types";

const EDUCATION_LEVELS = new Set<EducationLevelFilter>([
  "ALL",
  "KLEUTER",
  "LAGER",
  "SECUNDAIR",
]);

function hasMinimumGoal(
  result: CurriculumSearchResult,
): result is CurriculumSearchResult & {
  gelinktMinimumdoel: NonNullable<CurriculumSearchResult["gelinktMinimumdoel"]>;
} {
  return Boolean(result.gelinktMinimumdoel?.tekst);
}

function toAhovoksCandidates(
  results: Array<CurriculumSearchResult & { score?: number }>,
): Array<CurriculumSearchResult & { score: number }> {
  return results
    .map((result) => {
      const normalized = normalizeAhovoksMinimumGoalResult(result);
      if (!normalized) {
        return null;
      }
      return {
        ...normalized,
        score: result.score ?? 0,
      };
    })
    .filter(
      (item): item is CurriculumSearchResult & { score: number } => item !== null,
    );
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  const tierDenied = approvedTierResponse(session.tier);
  if (tierDenied) return tierDenied;

  try {
    const body = (await request.json()) as {
      goal?: string;
      educationLevel?: EducationLevelFilter;
      grade?: TargetGroupSearchContext["grade"];
      ageRange?: string;
    };
    const query = body.goal?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Vul eerst een lesdoel in." },
        { status: 400 },
      );
    }

    const educationLevel = body.educationLevel ?? "ALL";
    if (!EDUCATION_LEVELS.has(educationLevel)) {
      return NextResponse.json(
        { error: "Selecteer een geldig onderwijsniveau." },
        { status: 400 },
      );
    }

    const localCandidates = collectMinimumGoalCandidates({
      query,
      educationLevel,
      limit: 50,
    });

    let discoveryCandidates: Array<CurriculumSearchResult & { score: number }> =
      [];
    try {
      const discovery = await searchDiscoveryEngine({
        query,
        network: "ALL",
        pageSize: 16,
      });

      discoveryCandidates = toAhovoksCandidates(
        discovery.hits
          .map((hit) =>
            enrichHitFromCorpus(hit, query, "ALL", educationLevel),
          )
          .filter(
            (item): item is CurriculumSearchResult & { score: number } =>
              item !== null &&
              isStructuredResult(item) &&
              hasMinimumGoal(item) &&
              resultMatchesEducationLevel(item, educationLevel),
          ),
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
      {
        grade: body.grade ?? "",
        ageRange: body.ageRange?.trim() ?? "",
      },
    );

    const goal = merged[0] ?? null;
    const alternatives = merged.slice(1);

    return NextResponse.json({
      data: {
        goal: goal ?? "niet gevonden",
        alternatives,
        corpusNotice:
          merged.length > 0
            ? `Top ${Math.min(merged.length, MINIMUM_GOALS_TOP_N)} decretale minimumdoelen (AHOVOKS) - hoogste match bovenaan.`
            : "Geen passend decretale minimumdoel gevonden. Probeer je lesdoel anders te formuleren.",
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
