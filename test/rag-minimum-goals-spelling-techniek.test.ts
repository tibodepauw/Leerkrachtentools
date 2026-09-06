import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postMinimumGoals } from "@/app/api/rag-minimum-goals/route";
import { runStructured } from "@/lib/ai/router";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import type { CurriculumSearchResult } from "@/types";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({
    id: "spelling-techniek-user",
    email: "admin@example.com",
    displayName: "Spelling Techniek",
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

const SPELLING_QUERY =
  "De leerlingen passen de regels van de open en gesloten lettergreep toe bij het schrijven van woorden met dubbele medeklinkers";
const TOOL_QUERY =
  "De leerlingen gebruiken een handzaag en schuurpapier op een veilige manier om een houten fotokadertje te maken";

function resultCodes(results: CurriculumSearchResult[] | undefined): string[] {
  return (results ?? [])
    .map((item) => item.gelinktMinimumdoel?.code ?? "")
    .filter(Boolean);
}

async function postSearch(query: string, searchMode: "snel" | "pro") {
  return postMinimumGoals(
    new Request("http://localhost/api/rag-minimum-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: query,
        educationLevel: "BASISONDERWIJS",
        searchMode,
      }),
    }),
  );
}

describe("Minimumdoelen spelling en techniek", () => {
  beforeEach(() => {
    vi.mocked(hasAnyAiProvider).mockReturnValue(true);
    vi.mocked(runStructured).mockReset();
  });

  it("vindt 1.2.5 in Snel voor spelling van open en gesloten lettergrepen", async () => {
    const response = await postSearch(SPELLING_QUERY, "snel");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results?: CurriculumSearchResult[];
      data?: { goal?: CurriculumSearchResult | "niet gevonden" };
    };
    expect(body.data?.goal).not.toBe("niet gevonden");
    expect(resultCodes(body.results)).toContain("1.2.5");
  });

  it("vindt 3.7.2 of 3.7.3 in Snel voor handzaag en schuurpapier", async () => {
    const response = await postSearch(TOOL_QUERY, "snel");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results?: CurriculumSearchResult[];
      data?: { goal?: CurriculumSearchResult | "niet gevonden" };
    };
    expect(body.data?.goal).not.toBe("niet gevonden");
    const codes = resultCodes(body.results);
    expect(codes.some((code) => code === "3.7.2" || code === "3.7.3")).toBe(
      true,
    );
  });

  it("houdt spellingdoel 1.2.5 in Pro na grounding", async () => {
    vi.mocked(runStructured).mockResolvedValueOnce({
      provider: "google",
      fallbackErrors: [],
      data: {
        picks: [
          {
            code: "1.2.5",
            why: "De les oefent open en gesloten lettergrepen.",
            lessonPhase: "Verwerking",
          },
        ],
      },
    });

    const response = await postSearch(SPELLING_QUERY, "pro");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results?: CurriculumSearchResult[];
      data?: {
        proFallback?: boolean;
        goal?: CurriculumSearchResult | "niet gevonden";
      };
    };
    expect(body.data?.goal).not.toBe("niet gevonden");
    expect(body.data?.proFallback).toBe(false);
    expect(resultCodes(body.results)).toContain("1.2.5");
  });

  it("houdt W&T-gereedschap in Pro na grounding", async () => {
    vi.mocked(runStructured).mockResolvedValueOnce({
      provider: "google",
      fallbackErrors: [],
      data: {
        picks: [
          {
            code: "3.7.2",
            why: "De les gebruikt handzaag en schuurpapier als basisgereedschap.",
            lessonPhase: "Verwerking",
          },
        ],
      },
    });

    const response = await postSearch(TOOL_QUERY, "pro");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results?: CurriculumSearchResult[];
      data?: {
        proFallback?: boolean;
        goal?: CurriculumSearchResult | "niet gevonden";
      };
    };
    expect(body.data?.goal).not.toBe("niet gevonden");
    expect(body.data?.proFallback).toBe(false);
    const codes = resultCodes(body.results);
    expect(codes.some((code) => code === "3.7.2" || code === "3.7.3")).toBe(
      true,
    );
  });
});
