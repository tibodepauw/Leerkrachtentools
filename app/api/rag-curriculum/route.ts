import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { searchDiscoveryEngine } from "@/lib/rag/discoveryEngine";
import {
  CURRICULUM_TOP_N,
  enrichHitFromCorpus,
  isStructuredResult,
  mergeCurriculumResults,
  sanitizeStructuredResult,
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
        { error: "Selecteer een geldig onderwijsnet." },
        { status: 400 },
      );
    }

    const localCandidates = searchLocalCorpus({
      query,
      network,
      limit: CURRICULUM_TOP_N,
    });

    let discoveryCandidates: Array<CurriculumSearchResult & { score: number }> =
      [];
    try {
      const discovery = await searchDiscoveryEngine({
        query,
        network,
        pageSize: 16,
      });

      discoveryCandidates = discovery.hits
        .map((hit) => enrichHitFromCorpus(hit, query, network))
        .filter(
          (item): item is CurriculumSearchResult & { score: number } =>
            item !== null && isStructuredResult(item),
        );
    } catch {
      discoveryCandidates = [];
    }

    const merged = mergeCurriculumResults(
      [localCandidates, discoveryCandidates].map((pool) =>
        pool.filter(isStructuredResult).map(sanitizeStructuredResult),
      ),
      CURRICULUM_TOP_N,
    );

    const goal = merged[0] ?? null;
    const alternatives = merged.slice(1);

    return NextResponse.json({
      data: {
        goal: goal ?? "niet gevonden",
        alternatives,
        corpusNotice:
          merged.length > 0
            ? `${merged.length} officiële leerplandoel${merged.length === 1 ? "" : "en"} uit ${network === "ALL" ? "alle netwerken" : network}.`
            : "Geen match in de officiële doelencorpus. Probeer een andere formulering of selecteer een ander netwerk.",
        retrievalMode: "curriculum-hybrid",
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
