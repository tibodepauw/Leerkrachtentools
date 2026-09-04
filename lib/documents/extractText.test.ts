import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  isSupportedLessonDocument,
  lessonDocumentExtension,
} from "@/lib/documents/supportedFormats";
import {
  assertSafeZipArchive,
  extractDocumentText,
} from "@/lib/documents/extractText";

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

  it("weigert archieven met te veel onderdelen", async () => {
    const zip = new JSZip();
    for (let index = 0; index < 2_001; index += 1) {
      zip.file(`entry-${index}.txt`, "");
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    await expect(assertSafeZipArchive(buffer)).rejects.toThrow(
      "te veel onderdelen",
    );
  });
});
