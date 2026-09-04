import { describe, expect, it, vi } from "vitest";
import { POST as postCurriculum } from "@/app/api/rag-curriculum/route";
import { searchLocalCorpus } from "@/lib/rag/curriculumCorpus";
import {
  isMathDomain,
  isTechDomain,
  tokenizeCurriculumQuery,
} from "@/lib/rag/curriculumQueryTokens";
import { searchDiscoveryEngine } from "@/lib/rag/discoveryEngine";
import type { CurriculumSearchResult } from "@/types";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({
    id: "search-quality-user",
    email: "admin@example.com",
    displayName: "Search Quality",
    tier: "admin",
    marketingOptIn: false,
    profileImageUrl: null,
    pinnedModules: [],
    expiresAt: Date.now() + 60_000,
  }),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
}));

vi.mock("@/lib/ai/serverAccess", () => ({
  approvedTierResponse: () => null,
}));

vi.mock("@/lib/auth/moduleRouteGuard", () => ({
  requireModuleAccess: () => null,
}));

vi.mock("@/lib/rag/discoveryEngine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rag/discoveryEngine")>();
  return {
    ...actual,
    searchDiscoveryEngine: vi.fn(async () =>
      actual.emptyDiscoveryResponse("timeout"),
    ),
  };
});

function topResults(
  query: string,
  network: "ZILL" | "ALL" = "ZILL",
): Array<CurriculumSearchResult & { score: number }> {
  return searchLocalCorpus({
    query,
    network,
    educationLevel: "BASISONDERWIJS",
    limit: 3,
  });
}

describe("RAG zoekkwaliteit", () => {
  it("plaatst maaltafel-zoekopdrachten als Wiskunde/WD in de top 3", () => {
    const query =
      "De leerlingen kunnen de maaltafels van 4 en 8 vlot opzeggen en toepassen in eenvoudige vraagstukken";
    const tokens = tokenizeCurriculumQuery(query);
    expect(tokens.has("toepassen")).toBe(false);
    expect(tokens.has("eenvoudige")).toBe(false);

    const results = topResults(query);
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(
      results.every((result) =>
        isMathDomain(result.discipline, result.code, result.subdomein),
      ),
    ).toBe(true);
    expect(results.some((result) => result.code.startsWith("WD"))).toBe(true);
  });

  it("plaatst brug-bouw-zoekopdrachten als Techniek/OWte bovenaan", () => {
    const query =
      "De kinderen bouwen in groepjes een stevige brug met krantenpapier en tape die een gewicht van 1 kilo kan dragen";
    const results = topResults(query);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(
      isTechDomain(
        results[0]!.discipline,
        results[0]!.code,
        results[0]!.subdomein,
      ),
    ).toBe(true);
    expect(results[0]?.code.startsWith("OWte")).toBe(true);
  });

  it("stuurt slordige invoer altijd naar Discovery Engine", async () => {
    const query = "tikkertje spele me bal en mikken op pionnekes over de lijn";
    const response = await postCurriculum(
      new Request("http://localhost/api/rag-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: query,
          network: "ALL",
          educationLevel: "BASISONDERWIJS",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(searchDiscoveryEngine)).toHaveBeenCalled();
    const sent = vi.mocked(searchDiscoveryEngine).mock.calls.at(-1)?.[0];
    expect(sent?.query).toBe(query);
  });

  it("vangt een Discovery Engine time-out af met HTTP 200", async () => {
    const response = await postCurriculum(
      new Request("http://localhost/api/rag-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "tikkertje spele me bal en mikken op pionnekes over de lijn",
          network: "ALL",
          educationLevel: "BASISONDERWIJS",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      error?: string;
      data?: { corpusNotice?: string; goal?: unknown };
    };
    expect(body.error).toBeUndefined();
    expect(body.data?.corpusNotice).toMatch(/niet op tijd|niet beschikbaar/i);
  });

  it("vangt een Discovery Engine fetch-fout af zonder HTTP 500", async () => {
    vi.mocked(searchDiscoveryEngine).mockRejectedValueOnce(
      new Error("Failed to fetch"),
    );

    const response = await postCurriculum(
      new Request("http://localhost/api/rag-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "tikkertje spele me bal en mikken op pionnekes over de lijn",
          network: "ALL",
          educationLevel: "BASISONDERWIJS",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      error?: string;
      data?: { corpusNotice?: string };
    };
    expect(body.error).toBeUndefined();
    expect(body.data?.corpusNotice).toMatch(/niet beschikbaar|niet op tijd/i);
  });
});
