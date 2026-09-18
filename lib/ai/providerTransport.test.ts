import { afterEach, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { getModelCandidates, type ProviderName } from "./providers";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(["google", "groq", "cerebras", "sambanova"] as const)("forces redirect rejection through the real %s SDK for user and server keys", async (provider) => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"error":"synthetic"}', { status: 400, headers: { "content-type": "application/json" } })));
  vi.stubGlobal("fetch", fetcher);
  const names: Record<string, string> = { google: "GOOGLE_GENERATIVE_AI_API_KEY", groq: "GROQ_API_KEY", cerebras: "CEREBRAS_API_KEY", sambanova: "SAMBANOVA_API_KEY" };
  for (const name of Object.values(names)) vi.stubEnv(name, "");
  vi.stubEnv(names[provider], "synthetic-server-key");
  for (const config of [null, { enabled: true, provider: provider as ProviderName, apiKey: "synthetic-own-key", model: "synthetic-model" }]) {
    const candidate = getModelCandidates(provider, config)[0];
    await expect(generateText({ model: candidate.model, prompt: "synthetic", maxRetries: 0 })).rejects.toThrow();
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [, init] of fetcher.mock.calls) expect(init.redirect).toBe("error");
});
