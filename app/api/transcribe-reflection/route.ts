import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { reflectionRequestSchema } from "@/lib/ai/inputValidation";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { reflectionSchema } from "@/lib/ai/schemas";
import {
  checkServerAiAccess,
  serverAiAccessDeniedResponse,
  trackServerAiUsageIfNeeded,
} from "@/lib/ai/serverAccess";
import { getUserAiConfig } from "@/lib/ai/userCredentials";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const userAiConfig = getUserAiConfig(session.id);
  const access = checkServerAiAccess({
    userId: session.id,
    tier: session.tier,
    userAiConfig,
  });
  if (!access.allowed) {
    return serverAiAccessDeniedResponse(access);
  }

  if (!hasAnyAiProvider(userAiConfig)) {
    return NextResponse.json(
      {
        error: userAiConfig?.enabled
          ? "Eigen API-keys zijn ingeschakeld maar nog niet volledig ingevuld. Controleer instellingen."
          : "Geen AI-provider geconfigureerd. Zet GOOGLE_GENERATIVE_AI_API_KEY in .env.local of vul eigen API-keys in bij instellingen.",
      },
      { status: 503 },
    );
  }

  try {
    const input = reflectionRequestSchema.parse(await request.json());
    const goals = input.goals ?? [];

    const result = await runStructured({
      schema: reflectionSchema,
      system: prompts.reflection,
      prompt: `Lesdoelen:\n${goals.join("\n")}\n\nTranscript en eerdere antwoorden:\n${input.content?.trim() ?? ""}`,
      mock: {
        goals: [],
        engagement: [],
        teacherIdentity: "",
        followUpQuestions: [],
      },
      preferredProvider: "google",
      allowLocalMock: false,
      userAiConfig,
      file:
        input.audioData && input.mediaType
          ? {
              data: input.audioData,
              mediaType: input.mediaType,
              filename: "reflectie-opname.webm",
            }
          : undefined,
    });
    trackServerAiUsageIfNeeded({
      userId: session.id,
      usesServerQuota: access.usesServerQuota,
      provider: result.provider,
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
              : "Reflectie is mislukt.",
      },
      { status: 400 },
    );
  }
}
