import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { runProcessJob, workerEntry } from "@/lib/workers/processJob";
import type { DocumentResult } from "./parserWorker";
import type { LessonExportPayload } from "@/types";

// Draait de gebouwde worker (workers/document.cjs, via `npm run build:workers`).
const job = (input: unknown) =>
  runProcessJob<DocumentResult>(workerEntry("document"), input, { timeoutMs: 8000 });

const lesson: LessonExportPayload = {
  topic: "ſchool K Ÿ",
  learningArea: "Wiskunde",
  component: "meten",
  targetGroup: "L2",
  materials: [],
  goals: [],
  totalMinutes: 50,
  educationNetwork: "ZILL",
  lessonPreparation: "Regel 1\nRegel 2",
};

describe("gebruikersmeldingen uit de geïsoleerde documentworker", () => {
  it("geeft de specifieke melding bij te veel tekst door", async () => {
    const result = await job({
      operation: "extract",
      fileName: "lang.txt",
      bytes: Buffer.from("a".repeat(500_001)).toString("base64"),
    });
    expect(result).toEqual({
      error: "Het document bevat te veel tekst (maximaal 500000 tekens). Upload een korter document.",
    });
  });

  it("meldt een onherkenbaar bronformulier in plaats van een gepatchte export", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Vrije tekst</w:t></w:r></w:p></w:body></w:document>");
    const result = await job({
      operation: "export",
      lesson,
      fileName: "bron.docx",
      bytes: (await zip.generateAsync({ type: "nodebuffer" })).toString("base64"),
    });
    expect(result.error).toContain("geen herkenbare exportvelden");
    expect(result.exportMode).toBeUndefined();
  });

  it("houdt interne fouten generiek", async () => {
    const result = await job({ operation: "extract", fileName: "kapot.docx", bytes: Buffer.from("PK geen zip").toString("base64") });
    expect(result).toEqual({ error: "Het document kon niet veilig worden ingelezen." });
  });

  it("levert een gegenereerde export met een headerveilige bestandsnaam", async () => {
    const result = await job({ operation: "export", lesson });
    expect(result.exportMode).toBe("generated");
    expect(result.fileName).toMatch(/^[A-Za-z0-9_.() -]+\.docx$/);
    expect(() => new Headers({ "Content-Disposition": `attachment; filename="${result.fileName}"` })).not.toThrow();
    const xml = await (await JSZip.loadAsync(Buffer.from(result.bytes!, "base64"))).file("word/document.xml")!.async("string");
    expect(xml).toContain("Regel 1</w:t></w:r></w:p><w:p><w:r><w:t xml:space=\"preserve\">Regel 2");
  });
});
