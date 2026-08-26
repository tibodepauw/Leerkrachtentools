import { NextResponse } from "next/server";
import { mockReflection } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { reflectionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      goals?: string[];
      content?: string;
      audioData?: string;
      mediaType?: string;
    };
    const goals = Array.isArray(input.goals) ? input.goals : [];
    const result = await runStructured({
      schema: reflectionSchema,
      system: prompts.reflection,
      prompt: `Lesdoelen:\n${goals.join("\n")}\n\nTranscript en eerdere antwoorden:\n${input.content ?? ""}`,
      mock: mockReflection(goals),
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
