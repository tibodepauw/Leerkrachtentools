import { afterEach, expect, it, vi } from "vitest";
import { generateText, Output } from "ai";
import { z } from "zod";
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

it.each(["google", "groq", "cerebras", "sambanova"] as const)("parses structured output through the real %s SDK with an output cap", async (provider) => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(provider === "google" ? {
    candidates: [{ content: { role: "model", parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 },
  } : {
    id: "synthetic-id", object: "chat.completion", created: 1, model: "synthetic-model",
    choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }],
    usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
  }));
  vi.stubGlobal("fetch", fetcher);
  const model = getModelCandidates(provider, { enabled: true, provider, apiKey: "synthetic-own-key", model: "synthetic-model" })[0].model;
  const signal = new AbortController().signal;
  const result = await generateText({ model, prompt: "synthetic", output: Output.object({ schema: z.object({ ok: z.boolean() }) }), maxOutputTokens: 42, maxRetries: 0, abortSignal: signal });
  expect(result.output).toEqual({ ok: true });
  expect(fetcher).toHaveBeenCalledOnce();
  const init = fetcher.mock.calls[0][1]!;
  const body = JSON.parse(String(init.body));
  expect(body.generationConfig?.maxOutputTokens ?? body.max_completion_tokens ?? body.max_tokens).toBe(42);
  expect(init.redirect).toBe("error");
  expect(init.signal).toBeInstanceOf(AbortSignal);
});
