import { createAnalysisHandler, text } from "@/lib/ai/handler";
import { mockEngagement } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { engagementSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: engagementSchema,
  system: prompts.engagement,
  buildPrompt: (input) => `Volledige lesvoorbereiding:\n${text(input, "content")}`,
  buildMock: () => mockEngagement,
});
