import { NextResponse } from "next/server";
import type { z } from "zod";
import { runStructured } from "@/lib/ai/router";
import type { ProviderName } from "@/lib/ai/providers";

type InputRecord = Record<string, unknown>;

const providerNames = new Set([
  "google",
  "groq",
  "cerebras",
  "sambanova",
  "cloudflare",
]);

export function createAnalysisHandler<T>({
  schema,
  system,
  buildPrompt,
  buildMock,
}: {
  schema: z.ZodType<T>;
  system: string;
  buildPrompt: (input: InputRecord) => string;
  buildMock: (input: InputRecord) => T;
}) {
  return async function POST(request: Request) {
    try {
      const input = (await request.json()) as InputRecord;
      const preferred =
        typeof input.provider === "string" &&
        providerNames.has(input.provider)
          ? (input.provider as ProviderName)
          : undefined;
      const result = await runStructured({
        schema,
        system,
        prompt: buildPrompt(input),
        mock: buildMock(input),
        preferredProvider: preferred,
      });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "De analyse kon niet worden uitgevoerd.",
        },
        { status: 400 },
      );
    }
  };
}

export function text(input: InputRecord, key: string) {
  return typeof input[key] === "string" ? input[key] : "";
}

export function stringArray(input: InputRecord, key: string) {
  return Array.isArray(input[key])
    ? (input[key] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : [];
}
