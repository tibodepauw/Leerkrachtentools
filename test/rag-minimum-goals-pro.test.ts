import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postMinimumGoals } from "@/app/api/rag-minimum-goals/route";
import { runStructured } from "@/lib/ai/router";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { collectMinimumGoalCandidates } from "@/lib/rag/minimumGoalCandidates";
import { PRO_FALLBACK_NOTICES } from "@/lib/rag/selectProCurriculumGoals";
import { absoluteAppUrl } from "@/lib/http/appUrl";
import type { CurriculumSearchResult } from "@/types";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({
    id: "pro-minimum-user",
    email: "admin@example.com",
    displayName: "Pro Minimum",
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
  checkServerAiAccess: () => ({ allowed: true, usesServerQuota: false }),
  runWithServerAiQuota: async (
    _access: unknown,
    _userId: string,
    run: () => Promise<unknown>,
  ) => ({ ok: true, result: await run() }),
}));

vi.mock("@/lib/auth/moduleRouteGuard", () => ({
  requireModuleAccess: () => null,
}));

vi.mock("@/lib/ai/userCredentials", () => ({
  getUserAiConfig: () => null,
}));

vi.mock("@/lib/ai/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/providers")>();
  return {
    ...actual,
    hasAnyAiProvider: vi.fn(() => true),
  };
});

vi.mock("@/lib/ai/router", () => ({
  runStructured: vi.fn(),
}));

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

vi.mock("@/lib/rag/minimumGoalCandidates", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/rag/minimumGoalCandidates")>();
  return {
    ...actual,
    collectMinimumGoalCandidates: vi.fn(),
  };
});

const QUERY = "De leerlingen tellen tot 20 met blokjes";

function minimumGoal(
  code: string,
  tekst: string,
  score: number,
): CurriculumSearchResult & { score: number } {
  return {
    code: "",
    discipline: "Wiskunde",
    subdomein: "Getallen",
    titel: "",
    toelichting: "",
    leerjaarRoute: "4de leerjaar",
    gelinktMinimumdoel: {
      code,
      tekst,
      type: "Te bereiken minimumdoelen op populatieniveau",
    },
    netwerk: "AHOVOKS",
    bronUrl: "https://example.test",
    score,
  };
}

const CANDIDATES = [
  minimumGoal("06.12", "De leerlingen tellen tot 20.", 0.9),
  minimumGoal("06.13", "De leerlingen splitsen tot 10.", 0.8),
  minimumGoal("09.06", "De leerlingen rekenen tot 100.", 0.7),
];

function requestBody(searchMode: "snel" | "pro") {
  return {
    goal: QUERY,
    educationLevel: "BASISONDERWIJS",
    searchMode,
    topic: "Tellen",
    learningArea: "Wiskunde",
    phases: [{ name: "Verwerking", text: "Blokjes tellen" }],
  };
}

async function postSearch(searchMode: "snel" | "pro", signal?: AbortSignal) {
  return postMinimumGoals(
    new Request(absoluteAppUrl("/api/rag-minimum-goals"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(searchMode)),
      signal,
    }),
  );
}

describe("RAG minimumdoelen Pro-modus", () => {
  it("forwards client cancellation to the Pro provider", async () => {
    const controller = new AbortController();
    vi.mocked(runStructured).mockImplementationOnce(async () => {
      controller.abort();
      throw new Error("synthetic cancellation");
    });
    await postSearch("pro", controller.signal);
    expect(runStructured).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runStructured).mock.calls[0][0].abortSignal?.aborted).toBe(true);
  });
  beforeEach(() => {
    vi.mocked(hasAnyAiProvider).mockReturnValue(true);
    vi.mocked(runStructured).mockReset();
    vi.mocked(collectMinimumGoalCandidates).mockReturnValue(CANDIDATES);
  });

  it("roept geen AI aan in de Snel-modus", async () => {
    const response = await postSearch("snel");
    expect(response.status).toBe(200);
    expect(vi.mocked(runStructured)).not.toHaveBeenCalled();
    const body = (await response.json()) as {
      data?: { searchMode?: string; proFallback?: boolean };
    };
    expect(body.data?.searchMode ?? "snel").toBe("snel");
  });

  it("valt bij een AI-fout elegant terug op snelle zoekkaarten", async () => {
    vi.mocked(runStructured).mockRejectedValueOnce(
      new Error("Google Generative AI: 429"),
    );

    const response = await postSearch("pro");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      error?: string;
      results?: CurriculumSearchResult[];
      data?: {
        corpusNotice?: string;
        searchMode?: string;
        proFallback?: boolean;
        goal?: CurriculumSearchResult | "niet gevonden";
      };
    };

    expect(body.error).toBeUndefined();
    expect(body.data?.searchMode).toBe("pro");
    expect(body.data?.proFallback).toBe(true);
    expect(body.data?.corpusNotice).toBe(PRO_FALLBACK_NOTICES.aiError);
    expect(body.results?.length).toBeGreaterThan(0);
    expect(body.data?.goal).not.toBe("niet gevonden");
  });

  it("valt terug op Snel als er geen AI-provider is", async () => {
    vi.mocked(hasAnyAiProvider).mockReturnValueOnce(false);

    const response = await postSearch("pro");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data?: { corpusNotice?: string; proFallback?: boolean };
      results?: CurriculumSearchResult[];
    };
    expect(body.data?.proFallback).toBe(true);
    expect(body.data?.corpusNotice).toBe(PRO_FALLBACK_NOTICES.noProvider);
    expect(body.results?.length).toBeGreaterThan(0);
    expect(vi.mocked(runStructured)).not.toHaveBeenCalled();
  });

  it("houdt alleen grounded officiële minimumdoelcodes over", async () => {
    vi.mocked(runStructured).mockResolvedValueOnce({
      provider: "google",
      fallbackErrors: [],
      data: {
        picks: [
          {
            code: "06.12",
            why: "De les blijft tot 20.",
            lessonPhase: "Verwerking",
          },
          {
            code: "VERZONNEN.99",
            why: "Dit doel bestaat niet.",
            lessonPhase: "Instap",
          },
          {
            code: "06.13",
            why: "Splitsen past bij de blokjes.",
            lessonPhase: "Instructie",
          },
        ],
      },
    });

    const response = await postSearch("pro");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data?: {
        proFallback?: boolean;
        goal?: CurriculumSearchResult | "niet gevonden";
        alternatives?: CurriculumSearchResult[];
      };
      results?: CurriculumSearchResult[];
    };

    expect(body.data?.proFallback).toBe(false);
    const codes = (body.results ?? []).map(
      (item) => item.gelinktMinimumdoel?.code,
    );
    expect(codes).toEqual(["06.12", "06.13"]);
    expect(body.results?.[0]?.proWhy).toContain("tot 20");
    expect(body.results?.[0]?.proLessonPhase).toBe("Verwerking");
  });
});
