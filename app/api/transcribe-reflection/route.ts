import {
  createAnalysisHandler,
  stringArray,
  text,
} from "@/lib/ai/handler";
import { mockReflection } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { reflectionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: reflectionSchema,
  system: prompts.reflection,
  buildPrompt: (input) =>
    `Lesdoelen:\n${stringArray(input, "goals").join("\n")}\n\nTranscript en eerdere antwoorden:\n${text(input, "content")}`,
  buildMock: (input) => mockReflection(stringArray(input, "goals")),
});
