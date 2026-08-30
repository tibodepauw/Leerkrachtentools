import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { requireModuleAccess } from "@/lib/auth/moduleRouteGuard";
import { approvedTierResponse } from "@/lib/ai/serverAccess";
import { networkBadgeLabel } from "@/lib/rag/curriculumDisplay";
import {
  isAhovoksDomainLevel,
  resolveCurriculumNetwork,
} from "@/lib/lesson/educationLevelPreference";
import { searchDiscoveryEngine } from "@/lib/rag/discoveryEngine";
import {
  CURRICULUM_TOP_N,
  isStructuredResult,
  mergeCurriculumResults,
  resolveDiscoveryCandidates,
  sanitizeStructuredResult,
  searchLocalCorpus,
} from "@/lib/rag/curriculumCorpus";
import { applyTargetGroupRanking } from "@/lib/rag/targetGroupBonus";
import { resolveRagSearchQuery } from "@/lib/rag/queryRewriter";
import type {
  CurriculumNetworkFilter,
  CurriculumSearchResult,
  EducationLevelFilter,
  TargetGroupSearchContext,
} from "@/types";

const NETWORKS = new Set<CurriculumNetworkFilter>([
  "ALL",
  "OPSTAP",
  "OVSG",
  "GO_NIEUW",
  "ZILL",
  "GO",
  "KOV",
  "POV",
]);
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

type CurriculumSearchPayload = {
  merged: Array<CurriculumSearchResult & { score?: number }>;
  retrievalMode: "curriculum-hybrid" | "semantic-fallback" | "network-fallback";
  corpusNotice: string;
  networkFallbackNotice?: string;
};

async function runCurriculumSearch(
  query: string,
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter,
  options?: {
    excludeNetwork?: CurriculumNetworkFilter;
    targetGroup?: TargetGroupSearchContext;
  },
): Promise<CurriculumSearchPayload> {
  const localCandidates = searchLocalCorpus({
    query,
    network,
    educationLevel,
    limit: CURRICULUM_TOP_N,
  });

  const semanticFallback = localCandidates.length === 0;
  let discoveryCandidates: Array<CurriculumSearchResult & { score: number }> =
    [];

  try {
    const discovery = await searchDiscoveryEngine({
      query,
      network,
      pageSize: semanticFallback ? 20 : 16,
    });

    discoveryCandidates = resolveDiscoveryCandidates({
      hits: discovery.hits,
      query,
      network,
      educationLevel,
      semanticFallback,
    }).filter(
      (item) => semanticFallback || isStructuredResult(item),
    );
  } catch {
    discoveryCandidates = [];
  }

  let merged = mergeCurriculumResults(
    [localCandidates, discoveryCandidates].map((pool) =>
      pool
        .filter(
          (item) =>
            semanticFallback ||
            isStructuredResult(item) ||
            item.verrijking === "corpus",
        )
        .map(sanitizeStructuredResult),
    ),
    CURRICULUM_TOP_N,
  );

  merged = applyTargetGroupRanking(merged, {
    grade: options?.targetGroup?.grade,
    ageRange: options?.targetGroup?.ageRange,
    secondaryGrade: options?.targetGroup?.secondaryGrade,
    secondaryFinality: options?.targetGroup?.secondaryFinality,
  });

  if (options?.excludeNetwork) {
    merged = merged.filter(
      (item) => item.netwerk !== options.excludeNetwork,
    );
  }

  const networkLabel =
    network === "ALL" ? "alle leerplannen" : networkBadgeLabel(network);

  let corpusNotice =
    merged.length > 0
      ? `${merged.length} officiële leerplandoel${merged.length === 1 ? "" : "en"} uit ${networkLabel}.`
      : "Geen match in de officiële doelencorpus. Probeer een andere formulering of selecteer een ander netwerk.";

  if (semanticFallback && merged.length > 0) {
    corpusNotice = `${merged.length} semantisch passende leerplandoel${merged.length === 1 ? "" : "en"} via Discovery Engine (geen exacte token-match).`;
  }

  return {
    merged,
    retrievalMode: semanticFallback ? "semantic-fallback" : "curriculum-hybrid",
    corpusNotice,
  };
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  const tierDenied = approvedTierResponse(session.tier);
  if (tierDenied) return tierDenied;
  const moduleDenied = requireModuleAccess(session, "curriculum-rag");
  if (moduleDenied) return moduleDenied;

  try {
    const body = (await request.json()) as {
      goal?: string;
      network?: CurriculumNetworkFilter;
      educationLevel?: EducationLevelFilter;
      grade?: TargetGroupSearchContext["grade"];
      ageRange?: string;
      secondaryGrade?: TargetGroupSearchContext["secondaryGrade"];
      secondaryFinality?: TargetGroupSearchContext["secondaryFinality"];
      domainDetail?: TargetGroupSearchContext["domainDetail"];
      domainFinality?: TargetGroupSearchContext["domainFinality"];
      enableLlmQueryRewriting?: boolean;
    };

    const query = body.goal?.trim();
    if (!query) {
      return NextResponse.json(
        { error: "Vul eerst een lesdoel in." },
        { status: 400 },
      );
    }

    const requestedNetwork = body.network ?? "ALL";
    if (!NETWORKS.has(requestedNetwork)) {
      return NextResponse.json(
        { error: "Selecteer een geldig onderwijsnet." },
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

    const network = resolveCurriculumNetwork(requestedNetwork, educationLevel);

    const targetGroup: TargetGroupSearchContext = {
      grade: body.grade ?? "",
      ageRange: body.ageRange?.trim() ?? "",
      secondaryGrade: body.secondaryGrade ?? "all",
      secondaryFinality: body.secondaryFinality ?? "all",
      domainDetail: body.domainDetail ?? "all",
      domainFinality: body.domainFinality ?? "all",
      educationLevel,
    };

    const { searchQuery, rewrite } = await resolveRagSearchQuery(
      query,
      body.enableLlmQueryRewriting === true,
    );

    let searchResult = await runCurriculumSearch(
      searchQuery,
      network,
      educationLevel,
      { targetGroup },
    );
    let networkFallbackNotice: string | undefined;

    if (
      searchResult.merged.length === 0 &&
      network !== "ALL" &&
      !isAhovoksDomainLevel(educationLevel)
    ) {
      const fallback = await runCurriculumSearch(
        searchQuery,
        "ALL",
        educationLevel,
        {
          excludeNetwork: network,
          targetGroup,
        },
      );

      if (fallback.merged.length > 0) {
        searchResult = {
          ...fallback,
          retrievalMode: "network-fallback",
          networkFallbackNotice: undefined,
        };
        networkFallbackNotice = `Geen exacte match binnen ${networkBadgeLabel(network)}, hier zijn de beste doelen uit andere netwerken (bv. Op.stap / OVSG):`;
        searchResult.corpusNotice = `${fallback.merged.length} leerplandoel${fallback.merged.length === 1 ? "" : "en"} uit andere netwerken.`;
      }
    }

    const goal = searchResult.merged[0] ?? null;
    const alternatives = searchResult.merged.slice(1);

    return NextResponse.json({
      data: {
        goal: goal ?? "niet gevonden",
        alternatives,
        corpusNotice: searchResult.corpusNotice,
        networkFallbackNotice,
        retrievalMode: searchResult.retrievalMode,
        queryRewrite: rewrite,
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
            : "Doelenzoekopdracht mislukt.",
      },
      { status: 500 },
    );
  }
}
