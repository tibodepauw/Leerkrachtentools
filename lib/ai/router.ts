import { generateText, Output } from "ai";
import type { z } from "zod";
import { getModelCandidates, hasCloudflare } from "@/lib/ai/providers";
import type { ProviderName } from "@/lib/ai/providers";

export interface StructuredRequest<T> {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  mock: T;
  preferredProvider?: ProviderName;
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
}: StructuredRequest<T>): Promise<T> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error("Cloudflare is niet geconfigureerd");

  const model =
    process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";
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

  for (const candidate of getModelCandidates(request.preferredProvider)) {
    try {
      const result = await generateText({
        model: candidate.model,
        system: request.system,
        prompt: request.prompt,
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

  if (hasCloudflare()) {
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

  return { data: request.mock, provider: "local", fallbackErrors: errors };
}
