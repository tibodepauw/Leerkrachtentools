import {
  createAnalysisHandler,
  stringArray,
  text,
} from "@/lib/ai/handler";
import { mockAlignment } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { alignmentSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: alignmentSchema,
  system: prompts.alignment,
  buildPrompt: (input) =>
    `Lesdoelen:\n${stringArray(input, "goals").join("\n")}\n\nLesopbouw:\n${text(input, "content")}`,
  buildMock: (input) => mockAlignment(stringArray(input, "goals")),
});
