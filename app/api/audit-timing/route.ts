import { createAnalysisHandler, text } from "@/lib/ai/handler";
import { mockTimingAdvice } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { timingAdviceSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: timingAdviceSchema,
  system: prompts.timing,
  buildPrompt: (input) =>
    `Totale lestijd: ${text(input, "totalMinutes")} minuten.\nDeterministisch berekende fase-informatie:\n${text(input, "content")}`,
  buildMock: () => mockTimingAdvice,
  preferredProvider: "google",
  requireAi: true,
});
