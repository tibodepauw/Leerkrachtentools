import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { requireModuleAccess } from "@/lib/auth/moduleRouteGuard";
import { hasAnyAiProvider } from "@/lib/ai/providers";
import { manualExtractionRequestSchema } from "@/lib/ai/inputValidation";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { manualExtractionSchema } from "@/lib/ai/schemas";
import {
  checkServerAiAccess,
  runWithServerAiQuota,
  serverAiAccessDeniedResponse,
} from "@/lib/ai/serverAccess";
import { getUserAiConfig } from "@/lib/ai/userCredentials";
import { publicErrorMessage } from "@/lib/http/clientError";
import { readJsonBody } from "@/lib/http/requestBody";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const moduleDenied = requireModuleAccess(session, "manual-scanner");
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
    const input = manualExtractionRequestSchema.parse(
      await readJsonBody(request, 9_000_000),
    );

    const prompt = input.fileData
      ? `Bestandsnaam: ${input.fileName ?? "handleiding"}

Lees het bijgevoegde document en extraheer uitsluitend gegevens die er expliciet in staan.
Laat velden leeg wanneer informatie ontbreekt. Formuleer ruwe uitgeverijdoelen niet opnieuw.${
          input.content?.trim()
            ? `\n\nAanvullend geplakte tekst:\n${input.content.trim()}`
            : ""
        }`
      : `Geplakte handleidingtekst:\n${input.content?.trim() ?? ""}`;

    const tracked = await runWithServerAiQuota(access, session.id, () =>
      runStructured({
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
      }),
    );
    if (!tracked.ok) {
      return tracked.response;
    }

    return NextResponse.json(tracked.result);
  } catch (error) {
    return NextResponse.json(
      {
        error: publicErrorMessage(error, "Extractie is mislukt."),
      },
      { status: 400 },
    );
  }
}
