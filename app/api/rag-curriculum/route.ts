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
import { isPovCorpusAvailable } from "@/lib/rag/corpusLevelCache";
import {
  CURRICULUM_TOP_N,
  isStructuredResult,
  mergeCurriculumResults,
  resolveDiscoveryCandidates,
  sanitizeStructuredResult,
  searchLocalCorpus,
} from "@/lib/rag/curriculumCorpus";
import { applyTargetGroupRanking } from "@/lib/rag/targetGroupBonus";
import { applyMultiIntentDiversity } from "@/lib/rag/curriculumQueryTokens";
import { resolveTrackedRagSearchQuery } from "@/lib/rag/ragQueryAccess";
import { readJsonBody } from "@/lib/http/requestBody";
import { withRequestConcurrency } from "@/lib/http/rateLimit";
import { isValidRagTargetContext } from "@/lib/rag/requestValidation";
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
  "GO_OUD",
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

const INTERRUPTED_NOTICE =
  "De zoekopdracht is onderbroken. Probeer het opnieuw of formuleer het lesdoel anders.";

type CurriculumSearchPayload = {
  merged: Array<CurriculumSearchResult & { score?: number }>;
  retrievalMode: "curriculum-hybrid" | "semantic-fallback" | "network-fallback";
  corpusNotice: string;
  networkFallbackNotice?: string;
};

function parseNetwork(value: unknown): CurriculumNetworkFilter | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "GOOUD") return "GO_OUD";
  if (normalized === "GONIEUW") return "GO_NIEUW";
  if (NETWORKS.has(normalized as CurriculumNetworkFilter)) {
    return normalized as CurriculumNetworkFilter;
  }
  return null;
}

function parseEducationLevel(value: unknown): EducationLevelFilter | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (EDUCATION_LEVELS.has(normalized as EducationLevelFilter)) {
    return normalized as EducationLevelFilter;
  }
  return null;
}

function curriculumSearchResponse({
  merged,
  corpusNotice,
  retrievalMode,
  networkFallbackNotice,
  queryRewrite = null,
}: {
  merged: Array<CurriculumSearchResult & { score?: number }>;
  corpusNotice: string;
  retrievalMode: CurriculumSearchPayload["retrievalMode"];
  networkFallbackNotice?: string;
  queryRewrite?: unknown;
}) {
  const alternatives = merged.slice(1);
  return NextResponse.json({
    data: {
      goal: merged[0] ?? "niet gevonden",
      alternatives,
      corpusNotice,
      networkFallbackNotice,
      retrievalMode,
      queryRewrite,
    },
    results: merged,
    corpusNotice,
    provider: "jsonl-corpus+discovery-engine",
    fallbackErrors: [],
  });
}

function discoveryFallbackNotice(
  timedOut: boolean,
  failed: boolean,
  hasLocalResults: boolean,
): string | undefined {
  if (!timedOut && !failed) {
    return undefined;
  }
  if (timedOut) {
    return hasLocalResults
      ? "De semantische zoekdienst reageerde niet op tijd. Dit zijn de lokale treffers."
      : "De semantische zoekdienst reageerde niet op tijd en er zijn geen lokale treffers.";
  }
  return hasLocalResults
    ? "De semantische zoekdienst is tijdelijk niet beschikbaar. Dit zijn de lokale treffers."
    : "De semantische zoekdienst is tijdelijk niet beschikbaar en er zijn geen lokale treffers.";
}

function searchLocalSafely(
  query: string,
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter,
): Array<CurriculumSearchResult & { score: number }> {
  try {
    return searchLocalCorpus({
      query,
      network,
      educationLevel,
      limit: CURRICULUM_TOP_N,
    });
  } catch (error) {
    console.error("[rag-curriculum:local]", error);
    return [];
  }
}

async function runCurriculumSearch(
  query: string,
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter,
  options?: {
    excludeNetwork?: CurriculumNetworkFilter;
    targetGroup?: TargetGroupSearchContext;
  },
): Promise<CurriculumSearchPayload> {
  const localCandidates = searchLocalSafely(query, network, educationLevel);

  const semanticFallback = localCandidates.length === 0;
  let discoveryCandidates: Array<CurriculumSearchResult & { score: number }> =
    [];
  let timedOut = false;
  let failed = false;

  try {
    const discovery = await searchDiscoveryEngine({
      query,
      network,
      pageSize: semanticFallback ? 20 : 16,
    });
    timedOut = discovery.timedOut === true;
    failed = discovery.failed === true;

    discoveryCandidates = resolveDiscoveryCandidates({
      hits: discovery.hits,
      query,
      network,
      educationLevel,
      semanticFallback,
    }).filter((item) => semanticFallback || isStructuredResult(item));
  } catch (error) {
    console.error("[rag-curriculum:discovery]", error);
    failed = true;
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

  merged = applyMultiIntentDiversity(query, merged, CURRICULUM_TOP_N);

  if (options?.excludeNetwork) {
    merged = merged.filter((item) => item.netwerk !== options.excludeNetwork);
  }

  const networkLabel =
    network === "ALL" ? "alle leerplannen" : networkBadgeLabel(network);

  let corpusNotice =
    merged.length > 0
      ? `${merged.length} officiële leerplandoel${merged.length === 1 ? "" : "en"} uit ${networkLabel}.`
      : "Geen match in de officiële doelencorpus. Probeer een andere formulering of selecteer een ander netwerk.";

  if (network === "POV" && !isPovCorpusAvailable()) {
    corpusNotice =
      "POV-leerplannen zijn lokaal nog niet opgehaald. Draai `npm run fetch:secundair` om de corpus te laden.";
  }

  if (semanticFallback && merged.length > 0 && !timedOut && !failed) {
    corpusNotice = `${merged.length} semantisch passende leerplandoel${merged.length === 1 ? "" : "en"} via Discovery Engine (geen exacte token-match).`;
  }

  const fallbackNotice = discoveryFallbackNotice(
    timedOut,
    failed,
    localCandidates.length > 0,
  );
  if (fallbackNotice) {
    corpusNotice = fallbackNotice;
  }

  return {
    merged,
    retrievalMode: semanticFallback ? "semantic-fallback" : "curriculum-hybrid",
    corpusNotice,
  };
}

export async function POST(request: Request) {
  try {
    const session = sessionFromRequest(request);
    if (!session) return unauthorizedResponse();
    const tierDenied = approvedTierResponse(session.tier);
    if (tierDenied) return tierDenied;
    const moduleDenied = requireModuleAccess(session, "curriculum-rag");
    if (moduleDenied) return moduleDenied;

    let body: {
      goal?: string;
      query?: string;
      network?: CurriculumNetworkFilter | string;
      curriculum?: string;
      educationLevel?: EducationLevelFilter | string;
      level?: string;
      grade?: TargetGroupSearchContext["grade"];
      ageRange?: string;
      secondaryGrade?: TargetGroupSearchContext["secondaryGrade"];
      secondaryFinality?: TargetGroupSearchContext["secondaryFinality"];
      domainDetail?: TargetGroupSearchContext["domainDetail"];
      domainFinality?: TargetGroupSearchContext["domainFinality"];
      enableLlmQueryRewriting?: boolean;
    };

    try {
      body = (await readJsonBody(request, 64_000)) as typeof body;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Ongeldige JSON." },
          { status: 400 },
        );
      }
      throw error;
    }

    const query = String(body.goal ?? body.query ?? "").trim();
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

    const requestedNetwork =
      parseNetwork(body.network) ?? parseNetwork(body.curriculum) ?? "ALL";
    if (!NETWORKS.has(requestedNetwork)) {
      return NextResponse.json(
        { error: "Selecteer een geldig onderwijsnet." },
        { status: 400 },
      );
    }

    const educationLevel =
      parseEducationLevel(body.educationLevel) ??
      parseEducationLevel(body.level) ??
      "BASISONDERWIJS";
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

    let searchQuery = query;
    let rewrite = null;
    try {
      const resolved = await resolveTrackedRagSearchQuery({
        query,
        enableLlmQueryRewriting: body.enableLlmQueryRewriting === true,
        userId: session.id,
        tier: session.tier,
      });
      searchQuery = resolved.searchQuery;
      rewrite = resolved.rewrite;
    } catch (error) {
      console.error("[rag-curriculum:rewrite]", error);
    }

    let searchResult: CurriculumSearchPayload;
    try {
      searchResult = await withRequestConcurrency({
        scope: "rag-search",
        subject: session.id,
        limit: 2,
        task: () =>
          runCurriculumSearch(searchQuery, network, educationLevel, {
            targetGroup,
          }),
      });
    } catch (error) {
      console.error("[rag-curriculum:search]", error);
      const local = searchLocalSafely(searchQuery, network, educationLevel);
      return curriculumSearchResponse({
        merged: local,
        corpusNotice:
          local.length > 0
            ? discoveryFallbackNotice(false, true, true) ?? INTERRUPTED_NOTICE
            : INTERRUPTED_NOTICE,
        retrievalMode: local.length > 0 ? "curriculum-hybrid" : "semantic-fallback",
        queryRewrite: rewrite,
      });
    }

    let networkFallbackNotice: string | undefined;

    if (
      searchResult.merged.length === 0 &&
      network !== "ALL" &&
      !isAhovoksDomainLevel(educationLevel)
    ) {
      try {
        const fallback = await withRequestConcurrency({
          scope: "rag-search",
          subject: session.id,
          limit: 2,
          task: () =>
            runCurriculumSearch(searchQuery, "ALL", educationLevel, {
              excludeNetwork: network,
              targetGroup,
            }),
        });

        if (fallback.merged.length > 0) {
          searchResult = {
            ...fallback,
            retrievalMode: "network-fallback",
            networkFallbackNotice: undefined,
          };
          networkFallbackNotice = `Geen exacte match binnen ${networkBadgeLabel(network)}, hier zijn de beste doelen uit andere netwerken (bv. Op.stap / OVSG):`;
          searchResult.corpusNotice = `${fallback.merged.length} leerplandoel${fallback.merged.length === 1 ? "" : "en"} uit andere netwerken.`;
        }
      } catch (error) {
        console.error("[rag-curriculum:network-fallback]", error);
      }
    }

    return curriculumSearchResponse({
      ...searchResult,
      networkFallbackNotice,
      queryRewrite: rewrite,
    });
  } catch (error) {
    console.error("[rag-curriculum]", error);
    return curriculumSearchResponse({
      merged: [],
      corpusNotice: INTERRUPTED_NOTICE,
      retrievalMode: "semantic-fallback",
    });
  }
}
