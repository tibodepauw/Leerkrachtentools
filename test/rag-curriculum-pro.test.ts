import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postCurriculum } from "@/app/api/rag-curriculum/route";
import { runStructured } from "@/lib/ai/router";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { absoluteAppUrl } from "@/lib/http/appUrl";
import { searchLocalCorpus } from "@/lib/rag/curriculumCorpus";
import { PRO_FALLBACK_NOTICES } from "@/lib/rag/selectProCurriculumGoals";
import type { CurriculumSearchResult } from "@/types";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({
    id: "pro-search-user",
    email: "admin@example.com",
    displayName: "Pro Search",
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

const QUERY =
  "De leerlingen kunnen de maaltafels van 4 en 8 vlot opzeggen en toepassen in eenvoudige vraagstukken";

function requestBody(searchMode: "snel" | "pro") {
  return {
    goal: QUERY,
    network: "ALL",
    educationLevel: "BASISONDERWIJS",
    searchMode,
    topic: "Maaltafels",
    learningArea: "Wiskunde",
    phases: [
      { name: "Instap", text: "Korte oefening" },
      { name: "Verwerking", text: "Vraagstukken in duo" },
    ],
  };
}

async function postSearch(searchMode: "snel" | "pro", signal?: AbortSignal) {
  return postCurriculum(
    new Request(absoluteAppUrl("/api/rag-curriculum"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(searchMode)),
      signal,
    }),
  );
}

describe("RAG curriculum Pro-modus", () => {
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

  it("houdt alleen grounded officiële codes over uit de AI-selectie", async () => {
    const local = searchLocalCorpus({
      query: QUERY,
      network: "ALL",
      educationLevel: "BASISONDERWIJS",
      limit: 5,
    });
    expect(local.length).toBeGreaterThan(0);
    const official = local[0]!;

    vi.mocked(runStructured).mockResolvedValueOnce({
      data: {
        picks: [
          {
            code: "VERZONNEN.00",
            why: "Dit doel bestaat niet in de corpus.",
            lessonPhase: "Instap",
          },
          {
            code: official.code,
            why: "Dit doel dekt het vlot opzeggen van maaltafels.",
            lessonPhase: "Verwerking",
          },
        ],
      },
      provider: "google",
      fallbackErrors: [],
    });

    const response = await postSearch("pro");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results?: CurriculumSearchResult[];
      data?: {
        proFallback?: boolean;
        goal?: CurriculumSearchResult | "niet gevonden";
      };
    };

    expect(body.data?.proFallback).toBe(false);
    expect(body.results?.every((item) => item.code !== "VERZONNEN.00")).toBe(
      true,
    );
    expect(body.results?.some((item) => item.code === official.code)).toBe(true);
    if (body.data?.goal !== "niet gevonden") {
      expect(body.data?.goal?.titel).toBe(official.titel);
      expect(body.data?.goal?.proWhy).toMatch(/maaltafels/i);
      expect(body.data?.goal?.proLessonPhase).toBe("Verwerking");
    }
  });
});
