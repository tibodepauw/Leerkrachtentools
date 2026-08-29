import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import {
  searchDiscoveryEngine,
} from "@/lib/rag/discoveryEngine";
import {
  enrichHitFromCorpus,
  isStructuredResult,
  sanitizeStructuredResult,
  searchLocalCorpus,
} from "@/lib/rag/curriculumCorpus";
import type { CurriculumNetworkFilter, CurriculumSearchResult } from "@/types";

const NETWORKS = new Set<Exclude<CurriculumNetworkFilter, "ALL">>([
  "OPSTAP",
  "OVSG",
  "GO_NIEUW",
  "ZILL",
  "GO",
]);

function dedupeResults(
  results: Array<CurriculumSearchResult & { score?: number }>,
): Array<CurriculumSearchResult & { score?: number }> {
  const seen = new Map<string, CurriculumSearchResult & { score?: number }>();
  for (const result of results) {
    const key = [
      result.code,
      result.titel,
      result.netwerk,
      result.bronTitel,
      result.sourceUri,
    ].join("|");
    const existing = seen.get(key);
    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      seen.set(key, result);
    }
  }
  return [...seen.values()];
}

export async function POST(request: Request) {
  if (!sessionFromRequest(request)) return unauthorizedResponse();

  try {
    const body = (await request.json()) as {
      goal?: string;
      network?: CurriculumNetworkFilter;
    };

    const query = body.goal?.trim();
    if (!query) {
      return NextResponse.json(
        { error: "Vul eerst een lesdoel in." },
        { status: 400 },
      );
    }

    const network = body.network;
    if (!network || network === "ALL" || !NETWORKS.has(network)) {
      return NextResponse.json(
        { error: "Selecteer een geldig onderwijsnet." },
        { status: 400 },
      );
    }

    const discovery = await searchDiscoveryEngine({
      query,
      network,
      pageSize: 12,
    });

    const enrichedFromDiscovery = discovery.hits
      .map((hit) => enrichHitFromCorpus(hit, query, network))
      .filter(
        (item): item is CurriculumSearchResult & { score: number } =>
          item !== null && isStructuredResult(item),
      );

    const ranked =
      enrichedFromDiscovery.length > 0
        ? enrichedFromDiscovery
        : searchLocalCorpus({
            query,
            network,
            limit: 6,
          });

    const merged = dedupeResults(
      [...ranked]
        .filter(isStructuredResult)
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
        .slice(0, 6)
        .map(sanitizeStructuredResult),
    );

    const goal = merged[0] ?? null;
    const alternatives = merged.slice(1);

    return NextResponse.json({
      data: {
        goal: goal ?? "niet gevonden",
        alternatives,
        corpusNotice:
          merged.length > 0
            ? `${merged.length} officiële doel${merged.length === 1 ? "" : "en"} uit de gestructureerde corpus.`
            : "Geen match in de officiële doelencorpus. Probeer een andere formulering of een ander netwerk.",
        retrievalMode: "discovery-engine",
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
            : "Doelenzoekopdracht mislukt.",
      },
      { status: 500 },
    );
  }
}
