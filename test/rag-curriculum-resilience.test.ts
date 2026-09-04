import { describe, expect, it, vi } from "vitest";
import { POST as postCurriculum } from "@/app/api/rag-curriculum/route";
import { readJsonBody } from "@/lib/http/requestBody";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({
    id: "resilience-user",
    email: "admin@example.com",
    displayName: "Resilience",
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

vi.mock("@/lib/http/requestBody", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/requestBody")>();
  return {
    ...actual,
    readJsonBody: vi.fn(actual.readJsonBody),
  };
});

vi.mock("@/lib/rag/discoveryEngine", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/rag/discoveryEngine")>();
  return {
    ...actual,
    searchDiscoveryEngine: vi.fn(async () =>
      actual.emptyDiscoveryResponse("empty"),
    ),
  };
});

describe("RAG curriculum route-robuustheid", () => {
  it("geeft HTTP 200 met lege results en error bij een onverwachte route-fout", async () => {
    vi.mocked(readJsonBody).mockRejectedValueOnce(
      new Error("onverwachte parsefout"),
    );

    const response = await postCurriculum(
      new Request("http://localhost/api/rag-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "maaltafels van 4",
          network: "ALL",
          educationLevel: "BASISONDERWIJS",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      error?: string;
      results?: unknown[];
      data?: { goal?: unknown };
    };
    expect(body.results).toEqual([]);
    expect(body.error).toMatch(/onderbroken|opnieuw/i);
    expect(body.data?.goal).toBe("niet gevonden");
  });
});
