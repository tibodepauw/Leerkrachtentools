import { createAnalysisHandler, text } from "@/lib/ai/handler";
import { mockFullAudit } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { fullAuditSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: fullAuditSchema,
  system: prompts.fullAudit,
  buildPrompt: (input) => `Concept-lesvoorbereiding:\n${text(input, "content")}`,
  buildMock: () => mockFullAudit,
  preferredProvider: "google",
  requireAi: true,
  moduleId: "full-audit",
});
