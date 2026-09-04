import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { requireModuleAccess } from "@/lib/auth/moduleRouteGuard";
import type { ModuleId } from "@/types";
import { analysisRequestSchema } from "@/lib/ai/inputValidation";
import { runStructured } from "@/lib/ai/router";
import type { ProviderName } from "@/lib/ai/providers";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import {
  checkServerAiAccess,
  runWithServerAiQuota,
  serverAiAccessDeniedResponse,
} from "@/lib/ai/serverAccess";
import { publicErrorMessage } from "@/lib/http/clientError";
import { getUserAiConfig } from "@/lib/ai/userCredentials";
import { readJsonBody } from "@/lib/http/requestBody";

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
  moduleId,
}: {
  schema: z.ZodType<T>;
  inputSchema?: z.ZodType<InputRecord>;
  system: string;
  buildPrompt: (input: InputRecord) => string;
  buildMock: (input: InputRecord) => T;
  preferredProvider?: ProviderName;
  requireAi?: boolean;
  maxOutputTokens?: number;
  moduleId: ModuleId;
}) {
  return async function POST(request: Request) {
    const session = sessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const moduleDenied = requireModuleAccess(session, moduleId);
    if (moduleDenied) return moduleDenied;

    try {
      const input = inputSchema.parse(
        await readJsonBody(request, 1_000_000),
      ) as InputRecord;
      const userAiConfig = getUserAiConfig(session.id);
      const access = checkServerAiAccess({
        userId: session.id,
        tier: session.tier,
        userAiConfig,
      });
      if (!access.allowed) {
        return serverAiAccessDeniedResponse(access);
      }

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

      const tracked = await runWithServerAiQuota(access, session.id, () =>
        runStructured({
          schema,
          system,
          prompt: buildPrompt(input),
          mock: buildMock(input),
          preferredProvider: preferred,
          allowLocalMock: !requireAi,
          userAiConfig,
          maxOutputTokens,
        }),
      );
      if (!tracked.ok) {
        return tracked.response;
      }
      return NextResponse.json(tracked.result);
    } catch (error) {
      return NextResponse.json(
        {
          error: publicErrorMessage(error, "De analyse kon niet worden uitgevoerd."),
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
