import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { networkBadgeLabel } from "@/lib/rag/curriculumDisplay";
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
import type {
  CurriculumNetworkFilter,
  CurriculumSearchResult,
  TargetGroupSearchContext,
} from "@/types";

const NETWORKS = new Set<CurriculumNetworkFilter>([
  "ALL",
  "OPSTAP",
  "OVSG",
  "GO_NIEUW",
  "ZILL",
  "GO",
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
  options?: {
    excludeNetwork?: CurriculumNetworkFilter;
    targetGroup?: TargetGroupSearchContext;
  },
): Promise<CurriculumSearchPayload> {
  const localCandidates = searchLocalCorpus({
    query,
    network,
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
  });

  if (options?.excludeNetwork) {
    merged = merged.filter(
      (item) => item.netwerk !== options.excludeNetwork,
    );
  }

  const networkLabel =
    network === "ALL" ? "alle netwerken" : networkBadgeLabel(network);

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
  if (!sessionFromRequest(request)) return unauthorizedResponse();

  try {
    const body = (await request.json()) as {
      goal?: string;
      network?: CurriculumNetworkFilter;
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

    const network = body.network ?? "ALL";
    if (!NETWORKS.has(network)) {
      return NextResponse.json(
        { error: "Selecteer een geldig onderwijsnet." },
        { status: 400 },
      );
    }

    const targetGroup: TargetGroupSearchContext = {
      grade: body.grade ?? "",
      ageRange: body.ageRange?.trim() ?? "",
    };

    let searchResult = await runCurriculumSearch(query, network, { targetGroup });
    let networkFallbackNotice: string | undefined;

    if (searchResult.merged.length === 0 && network !== "ALL") {
      const fallback = await runCurriculumSearch(query, "ALL", {
        excludeNetwork: network,
        targetGroup,
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
