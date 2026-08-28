import { createAnalysisHandler, text } from "@/lib/ai/handler";
import { mockGoalTaxonomy } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { goalTaxonomySchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: goalTaxonomySchema,
  system: prompts.goalTaxonomy,
  buildPrompt: (input) => `Lesdoel:\n${text(input, "goal")}`,
  buildMock: (input) => mockGoalTaxonomy(text(input, "goal")),
});
