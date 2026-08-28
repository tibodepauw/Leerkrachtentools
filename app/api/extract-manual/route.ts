import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { manualExtractionSchema } from "@/lib/ai/schemas";
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
      fileName?: string;
      content?: string;
      fileData?: string;
      mediaType?: string;
    };

    if (!input.fileData && !input.content?.trim()) {
      return NextResponse.json(
        { error: "Upload een handleiding of plak eerst tekst." },
        { status: 400 },
      );
    }

    const prompt = input.fileData
      ? `Bestandsnaam: ${input.fileName ?? "handleiding"}

Lees het bijgevoegde document en extraheer uitsluitend gegevens die er expliciet in staan.
Laat velden leeg wanneer informatie ontbreekt. Formuleer ruwe uitgeverijdoelen niet opnieuw.${
          input.content?.trim()
            ? `\n\nAanvullend geplakte tekst:\n${input.content.trim()}`
            : ""
        }`
      : `Geplakte handleidingtekst:\n${input.content?.trim() ?? ""}`;

    const result = await runStructured({
      schema: manualExtractionSchema,
      system: prompts.manual,
      prompt,
      mock: {
        learningArea: "",
        component: "",
        topic: "",
        targetGroup: "",
        materials: [],
        rawPublisherGoals: [],
      },
      preferredProvider: "google",
      allowLocalMock: false,
      userAiConfig,
      file:
        input.fileData && input.mediaType
          ? {
              data: input.fileData,
              mediaType: input.mediaType,
              filename: input.fileName,
            }
          : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Extractie is mislukt.",
      },
      { status: 400 },
    );
  }
}
