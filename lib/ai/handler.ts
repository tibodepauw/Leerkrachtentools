import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { analysisRequestSchema } from "@/lib/ai/inputValidation";
import { runStructured } from "@/lib/ai/router";
import type { ProviderName } from "@/lib/ai/providers";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { getUserAiConfig } from "@/lib/ai/userCredentials";

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
  inputSchema = analysisRequestSchema,
  system,
  buildPrompt,
  buildMock,
  preferredProvider,
  requireAi = false,
  maxOutputTokens,
}: {
  schema: z.ZodType<T>;
  inputSchema?: z.ZodType<InputRecord>;
  system: string;
  buildPrompt: (input: InputRecord) => string;
  buildMock: (input: InputRecord) => T;
  preferredProvider?: ProviderName;
  requireAi?: boolean;
  maxOutputTokens?: number;
}) {
  return async function POST(request: Request) {
    const session = sessionFromRequest(request);
    if (!session) return unauthorizedResponse();
    try {
      const input = inputSchema.parse(await request.json()) as InputRecord;
      const userAiConfig = getUserAiConfig(session.id);
      const preferred =
        typeof input.provider === "string" &&
        providerNames.has(input.provider)
          ? (input.provider as ProviderName)
          : preferredProvider;

      if (requireAi && !hasAnyAiProvider(userAiConfig)) {
        return NextResponse.json(
          {
            error: userAiConfig?.enabled
              ? "Eigen API-keys zijn ingeschakeld maar nog niet volledig ingevuld. Controleer instellingen."
              : "Geen AI-provider geconfigureerd. Zet GOOGLE_GENERATIVE_AI_API_KEY in .env.local of vul eigen API-keys in bij instellingen.",
          },
          { status: 503 },
        );
      }

      const result = await runStructured({
        schema,
        system,
        prompt: buildPrompt(input),
        mock: buildMock(input),
        preferredProvider: preferred,
        allowLocalMock: !requireAi,
        userAiConfig,
        maxOutputTokens,
      });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof z.ZodError
              ? error.issues[0]?.message ?? "Ongeldige invoer."
              : error instanceof Error
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
