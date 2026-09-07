import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  isSupportedLessonDocument,
  lessonDocumentExtension,
} from "@/lib/documents/supportedFormats";
import {
  assertSafeZipArchive,
  extractDocumentText,
  MAX_ARCHIVE_ENTRY_BYTES,
  readZipEntryBounded,
  sanitizeZipArchive,
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

  it("stopt bij echte uitgepakte bytes, ook bij vervalste ZIP-metadata", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "x".repeat(1_000));
    const original = await zip.generateAsync({ type: "nodebuffer" });
    const loaded = await JSZip.loadAsync(original);
    await expect(
      readZipEntryBounded(loaded.files["word/document.xml"]!, 100, Date.now(), 5_000),
    ).rejects.toThrow("te groot");

    const oversized = new JSZip();
    oversized.file("pad.bin", Buffer.alloc(MAX_ARCHIVE_ENTRY_BYTES + 1, 65));
    const honest = await oversized.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    await expect(sanitizeZipArchive(honest)).rejects.toThrow("te groot");

    const forged = patchZipUncompressedSizes(honest, 1);
    await expect(sanitizeZipArchive(forged)).rejects.toThrow("te groot");
  });

  it("weigert padtraversals en leest een begrensde ODT", async () => {
    const evil = new JSZip();
    evil.file("../secret.txt", "nope");
    await expect(
      sanitizeZipArchive(await evil.generateAsync({ type: "nodebuffer" })),
    ).rejects.toThrow("ongeldig pad");

    const odt = new JSZip();
    odt.file(
      "content.xml",
      "<office:document-content><text:p>Instap met blokken</text:p></office:document-content>",
    );
    const text = await extractDocumentText(
      await odt.generateAsync({ type: "nodebuffer" }),
      "les.odt",
    );
    expect(text).toContain("Instap met blokken");
  });
});

function patchZipUncompressedSizes(buffer: Buffer, size: number) {
  const out = Buffer.from(buffer);
  const encoded = Buffer.alloc(4);
  encoded.writeUInt32LE(size);
  for (let index = 0; index < out.length - 30; index += 1) {
    if (
      out[index] === 0x50 &&
      out[index + 1] === 0x4b &&
      out[index + 2] === 0x03 &&
      out[index + 3] === 0x04
    ) {
      encoded.copy(out, index + 22);
    }
    if (
      out[index] === 0x50 &&
      out[index + 1] === 0x4b &&
      out[index + 2] === 0x01 &&
      out[index + 3] === 0x02
    ) {
      encoded.copy(out, index + 24);
    }
  }
  return out;
}
