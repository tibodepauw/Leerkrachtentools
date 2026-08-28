import { generateText, Output } from "ai";
import type { z } from "zod";
import {
  cloudflareCredentials,
  getModelCandidates,
  hasCloudflare,
} from "@/lib/ai/providers";
import type { ProviderName } from "@/lib/ai/providers";
import type { UserAiConfig } from "@/lib/ai/userCredentials";

export interface StructuredRequest<T> {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  mock: T;
  preferredProvider?: ProviderName;
  allowLocalMock?: boolean;
  file?: {
    data: string;
    mediaType: string;
    filename?: string;
  };
  userAiConfig?: UserAiConfig | null;
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
}: StructuredRequest<T>): Promise<T> {
  const { accountId: account, token, model } = cloudflareCredentials(
    userAiConfig,
  );
  if (!account || !token) throw new Error("Cloudflare is niet geconfigureerd");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
    {
      method: "POST",
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
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!response.ok) throw new Error(`Cloudflare HTTP ${response.status}`);
  const body = (await response.json()) as {
    result?: { response?: string };
  };
  return schema.parse(jsonFromText(body.result?.response ?? ""));
}

export async function runStructured<T>(
  request: StructuredRequest<T>,
): Promise<StructuredResult<T>> {
  const errors: string[] = [];

  const candidates = getModelCandidates(
    request.preferredProvider,
    request.userAiConfig,
  );
  if (request.file) {
    candidates.sort((left, right) =>
      left.name === "google" ? -1 : right.name === "google" ? 1 : 0,
    );
  }

  for (const candidate of candidates) {
    try {
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
        maxOutputTokens: 2400,
        temperature: 0.2,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(45_000),
      });
      return {
        data: request.schema.parse(result.output),
        provider: candidate.name,
        fallbackErrors: errors,
      };
    } catch (error) {
      errors.push(
        `${candidate.name}: ${error instanceof Error ? error.message : "onbekende fout"}`,
      );
    }
  }

  if (hasCloudflare(request.userAiConfig)) {
    try {
      return {
        data: await callCloudflare(request),
        provider: "cloudflare",
        fallbackErrors: errors,
      };
    } catch (error) {
      errors.push(
        `cloudflare: ${error instanceof Error ? error.message : "onbekende fout"}`,
      );
    }
  }

  if (request.allowLocalMock === false) {
    throw new Error(
      errors.length
        ? `Geen AI-provider beschikbaar: ${errors.join(" · ")}`
        : "Geen AI-provider geconfigureerd. Voeg GOOGLE_GENERATIVE_AI_API_KEY toe.",
    );
  }

  return { data: request.mock, provider: "local", fallbackErrors: errors };
}
