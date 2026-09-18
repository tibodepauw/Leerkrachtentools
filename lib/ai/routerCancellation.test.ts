import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), cloudflare: false, single: false }));
vi.mock("ai", () => ({ generateText: mocks.generate, Output: { object: (value: unknown) => value } }));
vi.mock("@/lib/ai/providers", () => ({
  getModelCandidates: () => mocks.cloudflare ? [] : [{ name: "groq", model: "first" }, { name: "google", model: "second" }].slice(0, mocks.single ? 1 : 2),
  hasCloudflare: () => mocks.cloudflare,
  cloudflareCredentials: () => ({ accountId: "test", token: "synthetic", model: "test" }),
}));
import { runStructured } from "@/lib/ai/router";
import { publicErrorMessage } from "@/lib/http/clientError";

afterEach(() => { mocks.generate.mockReset(); mocks.cloudflare = false; mocks.single = false; vi.unstubAllGlobals(); });

describe("AI cancellation", () => {
  it("never exposes provider-supplied error details to the caller", async () => {
    mocks.single = true;
    mocks.generate.mockRejectedValue(new Error("synthetic-private-provider-detail"));
    const error = await runStructured({ schema: z.object({ ok: z.boolean() }), system: "test", prompt: "test", mock: { ok: true }, allowLocalMock: false }).then(() => null, error => error);
    expect(error).toBeInstanceOf(Error);
    expect(publicErrorMessage(error, "fallback")).not.toContain("synthetic-private-provider-detail");
  });
  it("bounds Cloudflare responses and refuses redirects", async () => {
    mocks.cloudflare = true;
    const fetcher = vi.fn().mockResolvedValue(new Response(" ".repeat(1_048_577)));
    vi.stubGlobal("fetch", fetcher);
    await expect(runStructured({ schema: z.object({ ok: z.boolean() }), system: "test", prompt: "test", mock: { ok: true }, allowLocalMock: false })).rejects.toThrow("Geen AI-provider beschikbaar");
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });
  it("does not try the second provider or return a mock after caller abort", async () => {
    const controller = new AbortController();
    mocks.generate.mockImplementation(async () => {
      controller.abort(new Error("caller cancelled"));
      throw new Error("provider cancelled");
    });
    await expect(runStructured({ schema: z.object({ ok: z.boolean() }), system: "test", prompt: "test", mock: { ok: true }, abortSignal: controller.signal })).rejects.toThrow("caller cancelled");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("passes external cancellation through Cloudflare fetch", async () => {
    mocks.cloudflare = true;
    const controller = new AbortController();
    let providerSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, init) => {
      providerSignal = init.signal;
      return new Promise((_resolve, reject) => providerSignal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    }));
    const result = runStructured({ schema: z.object({ ok: z.boolean() }), system: "test", prompt: "test", mock: { ok: true }, abortSignal: controller.signal });
    controller.abort(new Error("stop cloudflare"));
    await expect(result).rejects.toThrow("stop cloudflare");
    expect(providerSignal?.aborted).toBe(true);
  });
});
