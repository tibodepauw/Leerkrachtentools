import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import {
  enforceThomasMoreDialogue,
  isStrictThomasMoreDialogue,
} from "@/lib/ai/dialogue";
import { formatDialogueRequestSchema } from "@/lib/ai/inputValidation";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { runStructured } from "@/lib/ai/router";
import { dialogueSchema } from "@/lib/ai/schemas";
import {
  checkServerAiAccess,
  serverAiAccessDeniedResponse,
  trackServerAiUsageIfNeeded,
} from "@/lib/ai/serverAccess";
import { getUserAiConfig } from "@/lib/ai/userCredentials";
import {
  dialoguePromptForStyle,
  formatDialogueInstruction,
} from "@/lib/ai/writingStyle";

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
    const input = formatDialogueRequestSchema.parse(await request.json());

    const result = await runStructured({
      schema: dialogueSchema,
      system: dialoguePromptForStyle(input.style),
      prompt: formatDialogueInstruction(input.style, input.content),
      mock: { formatted: "", interventions: 0 },
      preferredProvider: "google",
      allowLocalMock: false,
      userAiConfig,
    });

    const formatted =
      input.style === "thomas-more"
        ? enforceThomasMoreDialogue(result.data.formatted)
        : result.data.formatted.trim();

    if (
      input.style === "thomas-more" &&
      !isStrictThomasMoreDialogue(formatted)
    ) {
      throw new Error("De modeluitvoer kon niet strikt worden gevalideerd.");
    }

    trackServerAiUsageIfNeeded({
      userId: session.id,
      usesServerQuota: access.usesServerQuota,
      provider: result.provider,
    });
    return NextResponse.json({
      ...result,
      data: { ...result.data, formatted },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message ?? "Ongeldige invoer."
            : error instanceof Error
              ? error.message
              : "Formattering is mislukt.",
      },
      { status: 400 },
    );
  }
}
