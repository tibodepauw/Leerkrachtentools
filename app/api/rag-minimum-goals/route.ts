import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { requireModuleAccess } from "@/lib/auth/moduleRouteGuard";
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
import { publicErrorMessage } from "@/lib/http/clientError";
import { resolveTrackedRagSearchQuery } from "@/lib/rag/ragQueryAccess";
import { readJsonBody } from "@/lib/http/requestBody";
import { withRequestConcurrency } from "@/lib/http/rateLimit";
import { isValidRagTargetContext } from "@/lib/rag/requestValidation";
import { runProCurriculumAnalysis } from "@/lib/rag/runProCurriculumAnalysis";
import {
  CURRICULUM_PRO_RETRIEVAL_N,
  parseCurriculumSearchMode,
  parseProLessonContext,
} from "@/lib/rag/selectProCurriculumGoals";
import type {
  CurriculumSearchResult,
  EducationLevelFilter,
  TargetGroupSearchContext,
} from "@/types";

const EDUCATION_LEVELS = new Set<EducationLevelFilter>([
  "ALL",
  "BASISONDERWIJS",
  "KLEUTER",
  "LAGER",
  "SECUNDAIR",
  "BUBAO",
  "BUSO",
  "OKAN",
  "DKO",
  "VOLWASSENEN",
  "HOGER",
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
  const moduleDenied = requireModuleAccess(session, "minimum-goals");
  if (moduleDenied) return moduleDenied;

  try {
    const body = (await readJsonBody(request, 64_000)) as {
      goal?: string;
      educationLevel?: EducationLevelFilter;
      grade?: TargetGroupSearchContext["grade"];
      ageRange?: string;
      secondaryGrade?: TargetGroupSearchContext["secondaryGrade"];
      secondaryFinality?: TargetGroupSearchContext["secondaryFinality"];
      domainDetail?: TargetGroupSearchContext["domainDetail"];
      domainFinality?: TargetGroupSearchContext["domainFinality"];
      enableLlmQueryRewriting?: boolean;
      searchMode?: "snel" | "pro" | string;
      topic?: string;
      learningArea?: string;
      phases?: unknown;
    };
    const query = body.goal?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Vul eerst een lesdoel in." },
        { status: 400 },
      );
    }
    if (query.length > 10_000) {
      return NextResponse.json(
        { error: "Het lesdoel is te lang." },
        { status: 400 },
      );
    }
    if (!isValidRagTargetContext(body)) {
      return NextResponse.json(
        { error: "De doelgroepfilters bevatten ongeldige waarden." },
        { status: 400 },
      );
    }

    const educationLevel = body.educationLevel ?? "BASISONDERWIJS";
    if (!EDUCATION_LEVELS.has(educationLevel)) {
      return NextResponse.json(
        { error: "Selecteer een geldig onderwijsniveau." },
        { status: 400 },
      );
    }

    const searchMode = parseCurriculumSearchMode(body.searchMode);
    const topN =
      searchMode === "pro" ? CURRICULUM_PRO_RETRIEVAL_N : MINIMUM_GOALS_TOP_N;
    const lessonContext = parseProLessonContext({
      topic: body.topic,
      learningArea: body.learningArea,
      grade: body.grade,
      ageRange: body.ageRange,
      phases: body.phases,
    });

    const { searchQuery, rewrite } = await resolveTrackedRagSearchQuery({
      query,
      enableLlmQueryRewriting: body.enableLlmQueryRewriting === true,
      userId: session.id,
      tier: session.tier,
    });

    const localCandidates = collectMinimumGoalCandidates({
      query: searchQuery,
      educationLevel,
      limit: 50,
    });

    let discoveryCandidates: Array<CurriculumSearchResult & { score: number }> =
      [];
    try {
      const discovery = await withRequestConcurrency({
        scope: "rag-search",
        subject: session.id,
        limit: 2,
        task: () =>
          searchDiscoveryEngine({
            query: searchQuery,
            network: "ALL",
            pageSize: 16,
          }),
      });

      discoveryCandidates = toAhovoksCandidates(
        discovery.hits
          .map((hit) =>
            enrichHitFromCorpus(hit, searchQuery, "ALL", educationLevel),
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
      searchQuery,
      candidatePool.filter(hasMinimumGoal).map(sanitizeMinimumGoalForResponse),
      topN,
      {
        grade: body.grade ?? "",
        ageRange: body.ageRange?.trim() ?? "",
        secondaryGrade: body.secondaryGrade ?? "all",
        secondaryFinality: body.secondaryFinality ?? "all",
        domainDetail: body.domainDetail ?? "all",
        domainFinality: body.domainFinality ?? "all",
        educationLevel,
      },
    );

    let ranked = merged;
    let corpusNotice =
      ranked.length > 0
        ? `Top ${Math.min(ranked.length, MINIMUM_GOALS_TOP_N)} minimumdoelen - hoogste match bovenaan.`
        : "Geen passend minimumdoel gevonden. Probeer je lesdoel anders te formuleren.";
    let proFallback = false;
    let provider = "jsonl-corpus+discovery-engine";

    if (searchMode === "pro" && ranked.length > 0) {
      try {
        const pro = await runProCurriculumAnalysis({
          query,
          retrieved: ranked,
          lesson: lessonContext,
          userId: session.id,
          tier: session.tier,
          kind: "minimumdoel",
          fallbackLimit: MINIMUM_GOALS_TOP_N,
        });
        ranked = pro.merged;
        corpusNotice = pro.corpusNotice || corpusNotice;
        proFallback = pro.proFallback;
        provider = pro.provider;
      } catch {
        ranked = ranked.slice(0, MINIMUM_GOALS_TOP_N);
        corpusNotice =
          "De didactische analyse is niet gelukt. Dit zijn de snelle zoekkaarten.";
        proFallback = true;
      }
    }

    const goal = ranked[0] ?? null;
    const alternatives = ranked.slice(1);

    return NextResponse.json({
      data: {
        goal: goal ?? "niet gevonden",
        alternatives,
        corpusNotice,
        retrievalMode: "minimum-goals-hybrid",
        queryRewrite: rewrite,
        searchMode,
        proFallback,
      },
      results: ranked,
      corpusNotice,
      provider,
      fallbackErrors: [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: publicErrorMessage(
          error,
          "Minimumdoelenzoekopdracht mislukt.",
        ),
      },
      { status: 500 },
    );
  }
}
