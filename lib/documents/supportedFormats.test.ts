import { describe, expect, it } from "vitest";
import {
  isGeminiDirectManualFile,
  isManualScannerFile,
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
});
