import { createAnalysisHandler, text } from "@/lib/ai/handler";
import { mockGoalAnalysis } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { goalImprovementSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: goalImprovementSchema,
  system: prompts.goal,
  buildPrompt: (input) => `Ruw lesdoel:\n${text(input, "goal")}`,
  buildMock: (input) => mockGoalAnalysis(text(input, "goal")),
});
