import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import {
  enforceThomasMoreDialogue,
  isStrictThomasMoreDialogue,
} from "@/lib/ai/dialogue";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { dialogueSchema } from "@/lib/ai/schemas";
import { getUserAiConfig } from "@/lib/ai/userCredentials";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const userAiConfig = getUserAiConfig(session.id);
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
    const input = (await request.json()) as { content?: string };
    if (!input.content?.trim()) {
      return NextResponse.json(
        { error: "Plak eerst lesnotities of lesvoorbereidingstekst." },
        { status: 400 },
      );
    }

    const result = await runStructured({
      schema: dialogueSchema,
      system: prompts.dialogue,
      prompt: `Ruwe lesnotities:\n${input.content.trim()}`,
      mock: { formatted: "", interventions: 0 },
      preferredProvider: "google",
      allowLocalMock: false,
      userAiConfig,
    });
    const formatted = enforceThomasMoreDialogue(result.data.formatted);
    if (!isStrictThomasMoreDialogue(formatted)) {
      throw new Error("De modeluitvoer kon niet strikt worden gevalideerd.");
    }
    return NextResponse.json({
      ...result,
      data: { ...result.data, formatted },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Formattering is mislukt.",
      },
      { status: 400 },
    );
  }
}
