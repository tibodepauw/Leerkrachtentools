import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { requireModuleAccess } from "@/lib/auth/moduleRouteGuard";
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
  runWithServerAiQuota,
  serverAiAccessDeniedResponse,
} from "@/lib/ai/serverAccess";
import { getUserAiConfig } from "@/lib/ai/userCredentials";
import { publicErrorMessage } from "@/lib/http/clientError";
import {
  dialoguePromptForStyle,
  formatDialogueInstruction,
} from "@/lib/ai/writingStyle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const moduleDenied = requireModuleAccess(session, "dialogue-formatter");
  if (moduleDenied) return moduleDenied;

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

    const tracked = await runWithServerAiQuota(access, session.id, () =>
      runStructured({
        schema: dialogueSchema,
        system: dialoguePromptForStyle(input.style),
        prompt: formatDialogueInstruction(input.style, input.content),
        mock: { formatted: "", interventions: 0 },
        preferredProvider: "google",
        allowLocalMock: false,
        userAiConfig,
      }),
    );
    if (!tracked.ok) {
      return tracked.response;
    }
    const result = tracked.result;

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

    return NextResponse.json({
      ...result,
      data: { ...result.data, formatted },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: publicErrorMessage(error, "Formattering is mislukt."),
      },
      { status: 400 },
    );
  }
}
