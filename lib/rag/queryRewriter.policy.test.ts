import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { getModelCandidates } from "@/lib/ai/providers";
import { getUserAiConfig } from "@/lib/ai/userCredentials";
import { rewriteRagQuery } from "@/lib/rag/queryRewriter";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

vi.mock("@/lib/ai/userCredentials", () => ({
  getUserAiConfig: vi.fn(),
  userAiConfigHasCredentials: (config: { enabled?: boolean; apiKey?: string }) =>
    Boolean(config?.apiKey?.trim()),
}));

vi.mock("@/lib/ai/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/providers")>();
  return {
    ...actual,
    getModelCandidates: vi.fn(),
  };
});

const mockedGenerate = vi.mocked(generateText);
const mockedConfig = vi.mocked(getUserAiConfig);
const mockedCandidates = vi.mocked(getModelCandidates);

describe("RAG rewrite provider policy", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
    mockedConfig.mockReset();
    mockedCandidates.mockReset();
  });

  it("gebruikt de eigen Groq-config en niet de server-Google-key", async () => {
    mockedConfig.mockReturnValue({
      enabled: true,
      provider: "groq",
      apiKey: "gsk_user",
      model: "llama-3.3-70b-versatile",
    });
    mockedCandidates.mockReturnValue([
      { name: "groq", model: {} as never },
    ]);
    mockedGenerate.mockResolvedValue({
      output: { expandedQuery: "tellen tot twintig", disciplineHint: "Wiskunde" },
    } as never);

    const result = await rewriteRagQuery("tellen", { userId: "user-1" });
    expect(result.dispatched).toBe(true);
    expect(result.usedLlm).toBe(true);
    expect(mockedCandidates).toHaveBeenCalledWith(undefined, {
      enabled: true,
      provider: "groq",
      apiKey: "gsk_user",
      model: "llama-3.3-70b-versatile",
    });
    expect(JSON.stringify(mockedCandidates.mock.calls)).not.toContain("google");
  });

  it("valt bij decryptiefout niet terug op serverkeys", async () => {
    mockedConfig.mockReturnValue({
      enabled: true,
      provider: "groq",
      apiKey: "",
      model: "llama-3.3-70b-versatile",
    });
    const result = await rewriteRagQuery("tellen", { userId: "user-1" });
    expect(result.dispatched).toBe(false);
    expect(result.usedLlm).toBe(false);
    expect(mockedCandidates).not.toHaveBeenCalled();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("houdt dispatched true als de call start en daarna faalt", async () => {
    mockedConfig.mockReturnValue(null);
    mockedCandidates.mockReturnValue([{ name: "groq", model: {} as never }]);
    mockedGenerate.mockRejectedValue(new Error("timeout"));
    const result = await rewriteRagQuery("tellen", { userId: "user-1" });
    expect(result.dispatched).toBe(true);
    expect(result.usedLlm).toBe(true);
  });
});
