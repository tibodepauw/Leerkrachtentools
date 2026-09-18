import { afterEach, describe, expect, it, vi } from "vitest";
import { listProviderModels } from "@/lib/ai/listModels";

describe("listProviderModels", () => {
  it("refuses malformed or oversized model lists and refuses redirects", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ data: "invalid" })).mockResolvedValueOnce(new Response(" ".repeat(1_048_577)));
    vi.stubGlobal("fetch", fetcher);
    await expect(listProviderModels("groq", { apiKey: "synthetic" })).rejects.toThrow();
    await expect(listProviderModels("groq", { apiKey: "synthetic" })).rejects.toThrow("te groot");
    expect(fetcher.mock.calls.every(([, options]) => options.redirect === "error")).toBe(true);
  });

  it("does not start after caller cancellation", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController(); controller.abort();
    await expect(listProviderModels("google", { apiKey: "synthetic" }, controller.signal)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    const active = new AbortController();
    fetcher.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })));
    const pending = listProviderModels("groq", { apiKey: "synthetic" }, active.signal);
    active.abort(new Error("synthetic disconnect"));
    await expect(pending).rejects.toThrow("synthetic disconnect");
  });

  it("cancels unread error bodies", async () => {
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { status: 429 })));
    await expect(listProviderModels("groq", { apiKey: "synthetic" })).rejects.toThrow("429");
    expect(cancel).toHaveBeenCalledOnce();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("laat alleen Google-modellen met generateContent in de keuzelijst", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({
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
      })),
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
      vi.fn().mockResolvedValue(Response.json({
          data: [
            { id: "llama-3.3-70b-versatile" },
            { id: "whisper-large-v3" },
            { id: "llama-guard-3-8b" },
          ],
      })),
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
