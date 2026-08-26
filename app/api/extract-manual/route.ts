import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { mockManualExtraction } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { manualExtractionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sessionFromRequest(request)) return unauthorizedResponse();
  try {
    const input = (await request.json()) as {
      fileName?: string;
      content?: string;
      fileData?: string;
      mediaType?: string;
    };
    const result = await runStructured({
      schema: manualExtractionSchema,
      system: prompts.manual,
      prompt: `Bestandsnaam: ${input.fileName ?? ""}\n\nUitgelezen of geplakte inhoud:\n${input.content ?? ""}`,
      mock: mockManualExtraction,
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
