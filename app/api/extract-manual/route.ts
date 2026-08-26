import { createAnalysisHandler, text } from "@/lib/ai/handler";
import { mockManualExtraction } from "@/lib/ai/mocks";
import { prompts } from "@/lib/ai/prompts";
import { manualExtractionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export const POST = createAnalysisHandler({
  schema: manualExtractionSchema,
  system: prompts.manual,
  buildPrompt: (input) =>
    `Bestandsnaam: ${text(input, "fileName")}\n\nUitgelezen of geplakte inhoud:\n${text(input, "content")}`,
  buildMock: () => mockManualExtraction,
});
