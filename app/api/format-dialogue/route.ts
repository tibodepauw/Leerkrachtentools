import { NextResponse } from "next/server";
import {
  enforceThomasMoreDialogue,
  isStrictThomasMoreDialogue,
} from "@/lib/ai/dialogue";
import { mockDialogue } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/router";
import { dialogueSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { content?: string };
    const result = await runStructured({
      schema: dialogueSchema,
      system: prompts.dialogue,
      prompt: `Ruwe lesnotities:\n${input.content ?? ""}`,
      mock: mockDialogue,
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
