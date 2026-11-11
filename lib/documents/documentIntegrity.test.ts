import { expect, it } from "vitest";
import JSZip from "jszip";
import { performance } from "node:perf_hooks";
import { __testables, exportLessonDocument, generateGenericLessonDocx, sanitizeDownloadFileName } from "./exportLessonDocument";
import { assertSafeZipPath, extractDocumentText } from "./extractionCore";
import { decodeXmlText } from "./xmlText";
import { manualScannerMediaType, isManualScannerFile, MANUAL_SCANNER_MAX_BYTES } from "./supportedFormats";
import { MAX_DECODED_UPLOAD_BYTES, MAX_ENCODED_UPLOAD_CHARS } from "@/lib/ai/binaryUpload";
import type { LessonExportPayload } from "@/types";

const lesson: LessonExportPayload = { topic: "$& $$ $` <onderwerp>", learningArea: "Taal & spel", component: "taal", targetGroup: "L3", materials: [], goals: [{ id: "D1", text: "$& blijft letterlijk", taxonomy: "MC" }], totalMinutes: 50, educationNetwork: "ZILL", lessonPreparation: "Regel 1\nRegel 2\f\u0002" };
const paragraph = (parts: string[]) => `<w:p>${parts.map((text) => `<w:r><w:t>${text}</w:t></w:r>`).join("")}</w:p>`;
const text = (xml: string) => decodeXmlText(xml.replace(/<[^<>]+>/g, ""));

it("patches split Word labels and values exactly once and keeps dollar sequences literal", () => {
  for (const parts of [["Leergebied: ", "Wis", "kunde"], ["Leer", "gebied: ", "Oud"]]) {
    const patched = __testables.patchDocumentXml(paragraph(parts), lesson);
    expect(text(patched)).toBe("Leergebied: Taal & spel");
    expect(patched).toContain("<w:t>Leer");
  }
  const patched = __testables.patchDocumentXml(paragraph(["Lesonderwerp: oud"]), lesson);
  expect(text(patched)).toBe(`Lesonderwerp: ${lesson.topic}`);
  expect(patched).not.toContain("<onderwerp>");
});
it("preserves exactly one entity layer in form blobs", () => {
  const source = paragraph(["Lesvoorbereidingsformulier Taal &amp; spel LESDOEL 1 (MC): oud Gekoppeld aan minimumdoel: 1"]);
  const patched = __testables.patchDocumentXml(source, lesson);
  expect(patched).toContain("Taal &amp; spel");
  expect(patched).not.toContain("&amp;amp;");
  expect(text(patched)).toContain("$& blijft letterlijk");
});
it("rejects one megabyte of unmatched paragraph openings within a bounded time", () => {
  const start = performance.now();
  expect(() => __testables.patchDocumentXml("<w:p".repeat(250000), lesson)).toThrow();
  expect(performance.now() - start).toBeLessThan(1000);
});
it("retains newlines and removes XML controls in a generated Word document", async () => {
  const zip = await JSZip.loadAsync(await generateGenericLessonDocx(lesson));
  const xml = await zip.file("word/document.xml")!.async("string");
  expect(xml).toContain("Regel 1</w:t></w:r></w:p><w:p><w:r><w:t xml:space=\"preserve\">Regel 2");
  expect(xml).not.toMatch(/[\u0002\f]/);
  expect(text(xml)).toContain(lesson.topic);
});
it("does not claim a source form was patched when no export fields are recognizable", async () => {
  const zip = new JSZip(); zip.file("word/document.xml", paragraph(["Een vrij document"]));
  await expect(exportLessonDocument(lesson, await zip.generateAsync({ type: "nodebuffer" }), "bron.docx")).rejects.toThrow("herkenbare");
});
it("keeps filenames valid in HTTP headers for Unicode case-folding edge cases", () => {
  for (const name of ["ſchool.docx", "KlasŸ.docx", "日本語.docx"]) {
    const safe = sanitizeDownloadFileName(name);
    expect(safe).toMatch(/^[\x20-\x7e]+$/);
    expect(() => new Response(null, { headers: { "Content-Disposition": `attachment; filename="${safe}"` } })).not.toThrow();
  }
});
it("decodes RTF accented characters, unicode fallbacks and escaped braces", async () => {
  const rtf = String.raw`{\rtf1\ansi caf\'e9 ge\u239?ntegreerd \{goed\} \uc2\u233??}`;
  expect(await extractDocumentText(Buffer.from(rtf), "les.rtf")).toBe("café geïntegreerd {goed} é");
});
it("decodes ODT entities exactly once and accepts dots inside safe ZIP segments", async () => {
  const zip = new JSZip(); zip.file("content.xml", "<text:p>&amp;lt; &quot; &apos; &amp;</text:p>");
  expect(await extractDocumentText(await zip.generateAsync({ type: "nodebuffer" }), "les.odt")).toBe('&lt; " \' &');
  expect(() => assertSafeZipPath("word/a..b.xml")).not.toThrow();
  for (const path of ["word/../bad", "../bad", "C:/bad"]) expect(() => assertSafeZipPath(path)).toThrow();
});
it("uses one scanner upload limit and sends text extensions with a supported MIME type", () => {
  expect(MANUAL_SCANNER_MAX_BYTES).toBe(MAX_DECODED_UPLOAD_BYTES);
  expect(MAX_ENCODED_UPLOAD_CHARS).toBe(4 * Math.ceil(MANUAL_SCANNER_MAX_BYTES / 3));
  for (const name of ["les.md", "les.csv", "les.TXT"]) expect(manualScannerMediaType({ name, type: "application/octet-stream" })).toBe("text/plain");
  for (const name of ["foto.heic", "foto.bmp", "foto.svg"]) expect(isManualScannerFile({ name, type: "image/anything" })).toBe(false);
});
