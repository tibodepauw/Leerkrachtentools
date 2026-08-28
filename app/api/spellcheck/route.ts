import { createAnalysisHandler, text } from "@/lib/ai/handler";
import { mockSpellcheck } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { spellcheckSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: spellcheckSchema,
  system: prompts.spellcheck,
  buildPrompt: (input) => `Lesvoorbereidingstekst:\n${text(input, "content")}`,
  buildMock: (input) => mockSpellcheck(text(input, "content")),
  preferredProvider: "google",
  requireAi: true,
});
