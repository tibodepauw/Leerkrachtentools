import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { reflectionSchema } from "@/lib/ai/schemas";
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
    const input = (await request.json()) as {
      goals?: string[];
      content?: string;
      audioData?: string;
      mediaType?: string;
    };
    const goals = Array.isArray(input.goals) ? input.goals : [];

    if (!input.content?.trim() && !input.audioData) {
      return NextResponse.json(
        { error: "Voeg tekst, antwoorden of een opname toe." },
        { status: 400 },
      );
    }

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
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Reflectie is mislukt.",
      },
      { status: 400 },
    );
  }
}
