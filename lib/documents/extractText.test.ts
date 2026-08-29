import { describe, expect, it } from "vitest";
import {
  isSupportedLessonDocument,
  lessonDocumentExtension,
} from "@/lib/documents/supportedFormats";
import { extractDocumentText } from "@/lib/documents/extractText";

describe("lesson document formats", () => {
  it("herkent gangbare extensies", () => {
    expect(isSupportedLessonDocument("les.docx")).toBe(true);
    expect(isSupportedLessonDocument("les.pdf")).toBe(true);
    expect(isSupportedLessonDocument("les.odt")).toBe(true);
    expect(isSupportedLessonDocument("font.otf")).toBe(false);
    expect(lessonDocumentExtension("mijn.les.docx")).toBe("docx");
  });

  it("leest platte tekstbestanden", async () => {
    const text = await extractDocumentText(
      Buffer.from("Instap \u2014 5 min\nInstructie \u2014 15 min", "utf8"),
      "les.txt",
    );
    expect(text).toContain("Instap");
  });
});
