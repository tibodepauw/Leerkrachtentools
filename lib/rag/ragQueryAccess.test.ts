import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTrackedRagSearchQuery } from "@/lib/rag/ragQueryAccess";
import { resolveRagSearchQuery } from "@/lib/rag/queryRewriter";
import {
  releaseServerAiUsage,
  tryReserveServerAiUsage,
} from "@/lib/ai/usageLimits";
import { getUserAiConfig } from "@/lib/ai/userCredentials";

vi.mock("@/lib/rag/queryRewriter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rag/queryRewriter")>();
  return {
    ...actual,
    resolveRagSearchQuery: vi.fn(),
  };
});

vi.mock("@/lib/ai/usageLimits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/usageLimits")>();
  return {
    ...actual,
    tryReserveServerAiUsage: vi.fn(),
    releaseServerAiUsage: vi.fn(),
    usesOwnAiKeys: vi.fn(() => false),
  };
});

vi.mock("@/lib/ai/userCredentials", () => ({
  getUserAiConfig: vi.fn(() => null),
}));

vi.mock("@/lib/auth/tiers", () => ({
  dailyServerAiLimit: () => 40,
}));

const mockedResolve = vi.mocked(resolveRagSearchQuery);
const mockedReserve = vi.mocked(tryReserveServerAiUsage);
const mockedRelease = vi.mocked(releaseServerAiUsage);
const mockedConfig = vi.mocked(getUserAiConfig);

describe("tracked RAG rewrite quota", () => {
  beforeEach(() => {
    mockedResolve.mockReset();
    mockedReserve.mockReset();
    mockedRelease.mockReset();
    mockedConfig.mockReturnValue(null);
  });

  it("geeft de reservering terug als er geen call is gestart", async () => {
    mockedReserve.mockReturnValue({ ok: true, id: 9, used: 0 });
    mockedResolve.mockResolvedValue({
      searchQuery: "tellen",
      rewrite: {
        expandedQuery: "tellen",
        disciplineHint: "",
        usedLlm: false,
        dispatched: false,
      },
    });
    await resolveTrackedRagSearchQuery({
      query: "tellen",
      enableLlmQueryRewriting: true,
      userId: "user-1",
      tier: "student",
    });
    expect(mockedRelease).toHaveBeenCalledWith(9);
  });

  it("houdt de reservering vast na een gestarte maar mislukte call", async () => {
    mockedReserve.mockReturnValue({ ok: true, id: 9, used: 0 });
    mockedResolve.mockResolvedValue({
      searchQuery: "tellen",
      rewrite: {
        expandedQuery: "tellen",
        disciplineHint: "",
        usedLlm: true,
        dispatched: true,
      },
    });
    await resolveTrackedRagSearchQuery({
      query: "tellen",
      enableLlmQueryRewriting: true,
      userId: "user-1",
      tier: "student",
    });
    expect(mockedRelease).not.toHaveBeenCalled();
  });
  it("refunds nothing when an unexpected error makes dispatch uncertain", async () => {
    mockedReserve.mockReturnValue({ ok: true, id: 9, used: 0 });
    mockedResolve.mockRejectedValue(new Error("unexpected failure"));
    await expect(resolveTrackedRagSearchQuery({ query: "test", enableLlmQueryRewriting: true, userId: "user-1", tier: "student" })).rejects.toThrow();
    expect(mockedRelease).not.toHaveBeenCalled();
  });
});
