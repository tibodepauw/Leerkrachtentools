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
  searchLocalCorpus,
} from "@/lib/rag/curriculumCorpus";
import type { CurriculumNetworkFilter, CurriculumSearchResult } from "@/types";

const NETWORKS = new Set<CurriculumNetworkFilter>([
  "ALL",
  "OPSTAP",
  "OVSG",
  "GO_NIEUW",
  "ZILL",
  "GO",
]);

function dedupeResults(results: CurriculumSearchResult[]): CurriculumSearchResult[] {
  const seen = new Set<string>();
  const unique: CurriculumSearchResult[] = [];
  for (const result of results) {
    const key = [
      result.code,
      result.titel,
      result.netwerk,
      result.leerjaarRoute,
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(result);
  }
  return unique;
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

    const network = body.network ?? "ALL";
    if (!NETWORKS.has(network)) {
      return NextResponse.json(
        { error: "Selecteer een geldig netwerkfilter." },
        { status: 400 },
      );
    }

    const discovery = await searchDiscoveryEngine({
      query,
      network,
      pageSize: 12,
    });

    const enrichedFromDiscovery = discovery.hits
      .map((hit) => enrichHitFromCorpus(hit, query))
      .filter(
        (item): item is CurriculumSearchResult & { score: number } =>
          item !== null,
      );

    const localFallback = searchLocalCorpus({
      query,
      network,
      limit: 6,
    });

    const merged = dedupeResults(
      [...enrichedFromDiscovery, ...localFallback]
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
        .slice(0, 6),
    );

    const goal =
      merged[0] ??
      null;
    const alternatives = merged.slice(1);

    return NextResponse.json({
      data: {
        goal: goal ?? "niet gevonden",
        alternatives,
        summary: discovery.summaryText,
        citations: discovery.citations,
        totalSize: discovery.totalSize,
        corpusNotice:
          "Zoekresultaten komen uit de Google Cloud Discovery Engine-datastore, verrijkt met gestructureerde doelen uit de geïndexeerde corpus. Controleer code en officiële bron vóór indiening.",
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
