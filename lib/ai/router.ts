import { generateText, Output } from "ai";
import type { z } from "zod";
import {
  cloudflareCredentials,
  getModelCandidates,
  hasCloudflare,
} from "@/lib/ai/providers";
import type { ProviderName } from "@/lib/ai/providers";
import type { UserAiConfig } from "@/lib/ai/userCredentials";
import { EXTERNAL_API_TIMEOUT_MS } from "@/lib/http/externalTimeout";
import { readExternalJson } from "@/lib/http/externalJson";

export interface StructuredRequest<T> {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  mock: T;
  preferredProvider?: ProviderName;
  allowLocalMock?: boolean;
  file?: {
    data: string | Uint8Array;
    mediaType: string;
    filename?: string;
  };
  maxOutputTokens?: number;
  userAiConfig?: UserAiConfig | null;
  abortSignal?: AbortSignal;
}

export interface StructuredResult<T> {
  data: T;
  provider: ProviderName | "local";
  fallbackErrors: string[];
}

function jsonFromText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? text);
}

async function callCloudflare<T>({
  schema,
  system,
  prompt,
  userAiConfig,
  abortSignal,
}: StructuredRequest<T>, timeoutMs: number): Promise<T> {
  const { accountId: account, token, model } = cloudflareCredentials(
    userAiConfig,
  );
  if (!account || !token) throw new Error("Cloudflare is niet geconfigureerd");
  const signal = abortSignal ? AbortSignal.any([abortSignal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
    {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `${system}\nAntwoord uitsluitend met geldig JSON.`,
          },
          { role: "user", content: prompt },
        ],
      }),
      signal,
    },
  );
  if (!response.ok) {
    if (response.body) void response.body.cancel().catch(() => {});
    throw new Error(`Cloudflare HTTP ${response.status}`);
  }
  const body = (await readExternalJson(response, signal)) as {
    result?: { response?: string };
  };
  return schema.parse(jsonFromText(body.result?.response ?? ""));
}

export async function runStructured<T>(
  request: StructuredRequest<T>,
): Promise<StructuredResult<T>> {
  request.abortSignal?.throwIfAborted();
  const deadline = Date.now() + 45_000;
  let attempts = 0;

  const candidates = getModelCandidates(
    request.preferredProvider,
    request.userAiConfig,
  );
  if (request.file) {
    candidates.sort((left, right) =>
      left.name === "google" ? -1 : right.name === "google" ? 1 : 0,
    );
  }

  for (const candidate of candidates.slice(0, 2)) {
    request.abortSignal?.throwIfAborted();
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      attempts += 1;
      const result = await generateText({
        model: candidate.model,
        system: request.system,
        ...(request.file
          ? {
              messages: [
                {
                  role: "user" as const,
                  content: [
                    { type: "text" as const, text: request.prompt },
                    {
                      type: "file" as const,
                      data: request.file.data,
                      mediaType: request.file.mediaType,
                      filename: request.file.filename,
                    },
                  ],
                },
              ],
            }
          : { prompt: request.prompt }),
        output: Output.object({ schema: request.schema }),
        maxOutputTokens: Math.min(request.maxOutputTokens ?? 2400, 4096),
        temperature: 0.2,
        maxRetries: 0,
        abortSignal: request.abortSignal
          ? AbortSignal.any([
              request.abortSignal,
              AbortSignal.timeout(Math.min(EXTERNAL_API_TIMEOUT_MS, remaining)),
            ])
          : AbortSignal.timeout(Math.min(EXTERNAL_API_TIMEOUT_MS, remaining)),
      });
      return {
        data: request.schema.parse(result.output),
        provider: candidate.name,
        fallbackErrors: [],
      };
    } catch {
      request.abortSignal?.throwIfAborted();
    }
  }

  if (
    attempts < 2 &&
    Date.now() < deadline &&
    hasCloudflare(request.userAiConfig)
  ) {
    try {
      attempts += 1;
      return {
        data: await callCloudflare(
          request,
          Math.min(EXTERNAL_API_TIMEOUT_MS, deadline - Date.now()),
        ),
        provider: "cloudflare",
        fallbackErrors: [],
      };
    } catch {
      request.abortSignal?.throwIfAborted();
    }
  }

  if (request.allowLocalMock === false) {
    throw new Error(
      attempts > 0
        ? "Geen AI-provider beschikbaar. Probeer het later opnieuw."
        : "Geen AI-provider geconfigureerd. Voeg GOOGLE_GENERATIVE_AI_API_KEY toe.",
    );
  }

  return { data: request.mock, provider: "local", fallbackErrors: [] };
}
