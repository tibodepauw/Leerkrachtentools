import { afterEach, describe, expect, it, vi } from "vitest";
import { listProviderModels } from "@/lib/ai/listModels";

describe("listProviderModels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("laat alleen Google-modellen met generateContent in de keuzelijst", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "models/gemini-embedding-001",
              displayName: "Embedding",
              supportedGenerationMethods: ["embedContent"],
            },
            {
              name: "models/gemini-3.5-flash-lite",
              displayName: "Gemini 3.5 Flash-Lite",
              supportedGenerationMethods: ["generateContent"],
            },
            {
              name: "models/imagen-4.0-generate",
              displayName: "Imagen",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        }),
      }),
    );

    await expect(
      listProviderModels("google", { apiKey: "test-key" }),
    ).resolves.toEqual([
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
    ]);
  });

  it("filtert Groq whisper en guard-modellen eruit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: "llama-3.3-70b-versatile" },
            { id: "whisper-large-v3" },
            { id: "llama-guard-3-8b" },
          ],
        }),
      }),
    );

    await expect(
      listProviderModels("groq", { apiKey: "test-key" }),
    ).resolves.toEqual([
      { id: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile" },
    ]);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
