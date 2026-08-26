import { createAnalysisHandler, text } from "@/lib/ai/handler";
import { mockDialogue } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { dialogueSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: dialogueSchema,
  system: prompts.dialogue,
  buildPrompt: (input) => `Ruwe lesnotities:\n${text(input, "content")}`,
  buildMock: () => mockDialogue,
});
