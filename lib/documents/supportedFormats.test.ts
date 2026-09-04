import { describe, expect, it } from "vitest";
import {
  hasValidLessonDocumentSignature,
  isGeminiDirectManualFile,
  isManualScannerFile,
  LESSON_DOCUMENT_MAX_BYTES,
} from "@/lib/documents/supportedFormats";

describe("manual scanner formats", () => {
  it("accepts lesson documents and images", () => {
    expect(isManualScannerFile({ name: "handleiding.docx", type: "" })).toBe(true);
    expect(isManualScannerFile({ name: "scan.png", type: "image/png" })).toBe(true);
    expect(isManualScannerFile({ name: "notes.pages", type: "" })).toBe(false);
  });

  it("routes office files through text extraction", () => {
    expect(
      isGeminiDirectManualFile({ name: "handleiding.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    ).toBe(false);
    expect(isGeminiDirectManualFile({ name: "handleiding.pdf", type: "application/pdf" })).toBe(true);
    expect(isGeminiDirectManualFile({ name: "foto.jpg", type: "image/jpeg" })).toBe(true);
  });

  it("controleert inhoudssignaturen en hanteert een begrensde upload", () => {
    expect(
      hasValidLessonDocumentSignature(
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
        "les.pdf",
      ),
    ).toBe(true);
    expect(
      hasValidLessonDocumentSignature(
        new TextEncoder().encode("<html>geen pdf</html>"),
        "les.pdf",
      ),
    ).toBe(false);
    expect(LESSON_DOCUMENT_MAX_BYTES).toBe(8 * 1024 * 1024);
  });
});
