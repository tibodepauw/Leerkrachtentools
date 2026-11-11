import { beforeEach, expect, it, vi } from "vitest";
import { POST as curriculum } from "@/app/api/rag-curriculum/route";
import { POST as b2b } from "@/app/api/v1/curriculum/match/route";
import { createOrganization, generateApiKey } from "@/lib/api-keys";
import { matchCurriculumGoals } from "@/lib/b2b/matchCurriculum";
import { curriculumMatchBodySchema } from "@/lib/b2b/schemas";
import { POST as minimum } from "@/app/api/rag-minimum-goals/route";
import { searchLocalCorpus } from "@/lib/rag/curriculumCorpus";
import { runProCurriculumAnalysis } from "@/lib/rag/runProCurriculumAnalysis";

const { candidates } = vi.hoisted(() => ({ candidates: Array.from({ length: 10 }, (_, i) => ({
  code: `SYN-${i}`, titel: `De leerlingen kunnen optellen met blokken ${i}.`, netwerk: "OPSTAP" as const, verrijking: "corpus" as const, discipline: "Wiskunde", subdomein: "Getallen", toelichting: "", leerjaarRoute: "", bronUrl: "", score: 100 - i,
  gelinktMinimumdoel: { code: `MD-${i}`, tekst: `De leerlingen kunnen optellen ${i}.`, type: "synthetisch" },
})) }));
vi.mock("@/lib/auth/guard", () => ({ sessionFromRequest: () => ({ id: "limit-user", tier: "admin" }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/auth/moduleRouteGuard", () => ({ requireModuleAccess: () => null }));
vi.mock("@/lib/ai/serverAccess", () => ({ approvedTierResponse: () => null }));
vi.mock("@/lib/rag/ragQueryAccess", () => ({ resolveTrackedRagSearchQuery: async ({ query }: { query: string }) => ({ searchQuery: query, rewrite: null }) }));
vi.mock("@/lib/rag/discoveryEngine", () => ({ searchDiscoveryEngine: async () => ({ hits: [] }) }));
vi.mock("@/lib/rag/curriculumCorpus", async original => ({ ...await original<typeof import("@/lib/rag/curriculumCorpus")>(), searchLocalCorpus: vi.fn(() => candidates) }));
vi.mock("@/lib/rag/minimumGoalCandidates", async original => ({ ...await original<typeof import("@/lib/rag/minimumGoalCandidates")>(), collectMinimumGoalCandidates: () => candidates }));
vi.mock("@/lib/rag/runProCurriculumAnalysis", () => ({ runProCurriculumAnalysis: vi.fn(async () => ({ merged: candidates, corpusNotice: "synthetic", provider: "mock", proFallback: false })) }));
beforeEach(() => vi.clearAllMocks());
const routes = [["curriculum", curriculum], ["minimum", minimum]] as const;
function request(limit: unknown, searchMode = "snel") {
  return new Request("http://localhost/api/rag-curriculum", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal: "De leerlingen kunnen optellen met blokken.", network: "ALL", educationLevel: "BASISONDERWIJS", limit, searchMode }) });
}
it.each(routes)("%s rejects invalid limits before retrieval or provider work", async (_name, post) => {
  for (const limit of [0, 6, 10, 1.5, "2", null, {}, []]) {
    const response = await post(request(limit)); expect(response.status).toBe(400);
    expect(await response.text()).toMatch(/limit/);
  }
  expect(searchLocalCorpus).not.toHaveBeenCalled(); expect(runProCurriculumAnalysis).not.toHaveBeenCalled();
});
it.each(routes)("%s rejects malformed JSON field types through the real route", async (name, post) => {
  const valid = { goal: "De leerlingen kunnen optellen.", network: "ALL", educationLevel: "BASISONDERWIJS" };
  for (const body of [null, [], "doel", { ...valid, goal: null }, { ...valid, goal: {} }, { ...valid, grade: ["l1"] }, { ...valid, phases: [null] }]) {
    const response = await post(new Request(`http://localhost/api/rag-${name}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toEqual(expect.any(String));
    expect(payload.error).not.toMatch(/TypeError|Cannot read|\.trim|is not a function/);
  }
  expect(searchLocalCorpus).not.toHaveBeenCalled();
  expect(runProCurriculumAnalysis).not.toHaveBeenCalled();
});
it.each(routes)("%s honors 1–5 and default 5 in fast, Pro and failed Pro flows", async (_name, post) => {
  for (const mode of ["snel", "pro", "pro-failure"]) {
    for (const limit of [1, 2, 3, 4, 5, undefined]) {
      if (mode === "pro-failure") vi.mocked(runProCurriculumAnalysis).mockRejectedValueOnce(new Error("synthetic provider failure"));
      const response = await post(request(limit, mode === "snel" ? "snel" : "pro")); expect(response.status).toBe(200);
      const payload = await response.json(); expect(payload.results).toHaveLength(limit ?? 5);
      expect(payload.data.alternatives).toHaveLength((limit ?? 5) - 1);
      expect(payload.data.goal.code).toBe(payload.results[0].code);
    }
  }
});

// Keep route validation, verified identity and the real matching calculation;
// replace process dispatch so deterministic retrieval/provider fixtures apply.
vi.mock("@/lib/b2b/worker", () => ({ runB2bJob: async (_task: string, body: unknown, orgId: string, signal: AbortSignal) => {
  const result = await matchCurriculumGoals({ ...curriculumMatchBodySchema.parse(body), orgId, signal });
  return { ...result, count: result.results.length };
} }));
it("B2B honors every valid limit in fast, Pro and provider-fallback matching through the verified route", async () => {
  for (const mode of ["snel", "pro", "pro-fallback"]) {
    const org = createOrganization({ name: "limits", email: "limits@example.test", tier: "enterprise", quota: 100 });
    const key = generateApiKey(org.id, "limits", ["curriculum:match"]);
    for (const limit of [1, 2, 3, 4, 5, undefined]) {
      if (mode === "pro-fallback") vi.mocked(runProCurriculumAnalysis).mockResolvedValueOnce({ merged: candidates, corpusNotice: "synthetic", provider: "mock", proFallback: true });
      const response = await b2b(new Request("http://localhost/api/v1/curriculum/match", { method: "POST", headers: { authorization: `Bearer ${key.token}`, "content-type": "application/json" }, body: JSON.stringify({ query: "De leerlingen kunnen optellen met blokken.", network: "GO", mode: mode === "snel" ? "snel" : "pro", limit }) }));
      expect(response.status).toBe(200); const payload = await response.json();
      expect(payload.results).toHaveLength(limit ?? 5); expect(payload.count).toBe(limit ?? 5);
      expect(payload.sourceMetadata.version).toBeNull();
    }
  }
});
it("B2B rejects invalid limits before retrieval or provider work", async () => {
  const org = createOrganization({ name: "invalid", email: "invalid@example.test", tier: "enterprise", quota: 100 });
  const key = generateApiKey(org.id, "invalid", ["curriculum:match"]);
  for (const limit of [0, 6, 10, 1.5, "2", null, {}, []]) {
    const response = await b2b(new Request("http://localhost/api/v1/curriculum/match", { method: "POST", headers: { authorization: `Bearer ${key.token}`, "content-type": "application/json" }, body: JSON.stringify({ query: "synthetic goal", limit }) }));
    expect(response.status).toBe(400);
  }
  expect(searchLocalCorpus).not.toHaveBeenCalled(); expect(runProCurriculumAnalysis).not.toHaveBeenCalled();
});
