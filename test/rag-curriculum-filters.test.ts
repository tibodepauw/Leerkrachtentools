import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/rag-curriculum/route";
import { searchLocalCorpus } from "@/lib/rag/curriculumCorpus";
import type { CurriculumSearchResult } from "@/types";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({ id: "curriculum-filters", tier: "admin" }),
  unauthorizedResponse: () => new Response(null, { status: 401 }),
}));
vi.mock("@/lib/auth/moduleRouteGuard", () => ({ requireModuleAccess: () => null }));
vi.mock("@/lib/ai/serverAccess", () => ({ approvedTierResponse: () => null }));
vi.mock("@/lib/rag/ragQueryAccess", () => ({
  resolveTrackedRagSearchQuery: async ({ query }: { query: string }) => ({ searchQuery: query, rewrite: null }),
}));
vi.mock("@/lib/rag/discoveryEngine", () => ({
  searchDiscoveryEngine: async () => ({ hits: [] }),
}));
vi.mock("@/lib/rag/curriculumCorpus", async (original) => ({
  ...await original<typeof import("@/lib/rag/curriculumCorpus")>(),
  searchLocalCorpus: vi.fn(),
}));
vi.mock("@/lib/rag/runProCurriculumAnalysis", () => ({
  runProCurriculumAnalysis: async ({ retrieved }: { retrieved: CurriculumSearchResult[] }) => ({
    merged: retrieved,
    corpusNotice: "Synthetische analyse",
    provider: "mock",
    proFallback: false,
  }),
}));

function candidate(code: string, leerjaarRoute: string, score: number): CurriculumSearchResult & { score: number } {
  return {
    code, leerjaarRoute, score,
    titel: "De leerlingen kunnen getallen vergelijken.",
    netwerk: "GO", verrijking: "corpus", discipline: "Wiskunde",
    subdomein: "Getallen", toelichting: "", bronUrl: "", gelinktMinimumdoel: null,
  };
}

describe("Curriculumroute met de filters uit het zoekscherm", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["snel", "pro"])("rangschikt geselecteerde graad en finaliteit hoger in %s", async (searchMode) => {
    vi.mocked(searchLocalCorpus).mockReturnValue([
      candidate("OTHER", "1ste graad, arbeidsmarktfinaliteit", 0.6),
      candidate("FINALITY", "1ste graad, doorstroomfinaliteit", 0.59),
      candidate("GRADE", "3de graad, arbeidsmarktfinaliteit", 0.58),
      candidate("BOTH", "3de graad, doorstroomfinaliteit", 0.57),
    ]);

    const search = async (filters: Record<string, string>) => {
      const response = await POST(new Request("http://localhost/api/rag-curriculum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal: "Getallen vergelijken", network: "GO", educationLevel: "SECUNDAIR", searchMode,
          secondaryGrade: "all", secondaryFinality: "all", ...filters,
        }),
      }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.error).toBeUndefined();
      return body.results.map((item: CurriculumSearchResult) => item.code);
    };

    expect((await search({ domainDetail: "all", domainFinality: "all" }))[0]).toBe("OTHER");
    expect((await search({ domainDetail: "3de_graad", domainFinality: "all" }))[0]).toBe("GRADE");
    expect((await search({ domainDetail: "all", domainFinality: "doorstroom" }))[0]).toBe("FINALITY");
    expect((await search({ domainDetail: "3de_graad", domainFinality: "doorstroom" }))[0]).toBe("BOTH");
  });
});
