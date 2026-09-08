import { describe, expect, it } from "vitest";
import {
  BinaryUploadError,
  decodeBoundedBase64,
  looksLikeUrlString,
} from "@/lib/ai/binaryUpload";
import { manualExtractionRequestSchema } from "@/lib/ai/inputValidation";

describe("begrensde AI-bestandsuploads", () => {
  it("herkent URL-strings", () => {
    expect(looksLikeUrlString("https://files.example/manual.pdf")).toBe(true);
    expect(looksLikeUrlString("http://example.com/a")).toBe(true);
    expect(looksLikeUrlString("//cdn.example/file")).toBe(true);
    expect(looksLikeUrlString("aGVsbG8=")).toBe(false);
  });

  it("weigert URL-strings als uploadveld", () => {
    expect(() =>
      decodeBoundedBase64("https://files.example/manual.pdf"),
    ).toThrow(BinaryUploadError);
    expect(() =>
      manualExtractionRequestSchema.parse({
        fileData: "https://files.example/manual.pdf",
        mediaType: "application/pdf",
      }),
    ).toThrow();
  });

  it("decodeert geldige kleine base64 binnen de bytegrens", () => {
    const bytes = decodeBoundedBase64(Buffer.from("%PDF-1.4 hi").toString("base64"));
    expect(Buffer.from(bytes).toString("utf8")).toContain("%PDF-1.4");
  });

  it("weigert ongeldige base64", () => {
    expect(() => decodeBoundedBase64("$$$$")).toThrow(BinaryUploadError);
  });
});
