import { describe, expect, it } from "vitest";
import {
  mimeTypeFromFileName,
  previewModeFromFileName,
} from "@/lib/documents/preview";

describe("document preview helpers", () => {
  it("maps common lesson document extensions to mime types", () => {
    expect(mimeTypeFromFileName("les.pdf")).toBe("application/pdf");
    expect(mimeTypeFromFileName("les.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mimeTypeFromFileName("les.txt")).toBe("text/plain");
  });

  it("chooses the correct preview mode", () => {
    expect(previewModeFromFileName("les.pdf")).toBe("pdf");
    expect(previewModeFromFileName("les.docx")).toBe("docx");
    expect(previewModeFromFileName("les.txt")).toBe("text");
    expect(previewModeFromFileName("les.doc")).toBe("unsupported");
  });
});
