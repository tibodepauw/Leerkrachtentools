import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { runProcessJob, workerEntry } from "@/lib/workers/processJob";
import type { DocumentResult } from "./parserWorker";

describe("bounded document mutation probes", () => {
  for (const extension of ["docx", "odt", "pdf", "doc", "rtf"]) {
    it(`keeps ${extension} mutations outside the application process`, async () => {
      const zip = new JSZip();
      zip.file(extension === "odt" ? "content.xml" : "word/document.xml", "<document><p>Synthetic fixture</p></document>");
      const seed = ["docx", "odt"].includes(extension)
        ? await zip.generateAsync({ type: "nodebuffer" })
        : extension === "pdf" ? Buffer.from("%PDF-1.7\n1 0 obj << /Length 999999999 /Filter /FlateDecode >> stream\ninvalid\nendstream\nendobj\n%%EOF")
        : extension === "doc" ? Buffer.from("d0cf11e0a1b11ae1".repeat(16), "hex")
        : Buffer.from("{\\rtf1\\ansi test " + "{".repeat(2000));
      const flipped = Buffer.from(seed);
      for (let index = 0; index < flipped.length; index += 17) flipped[index] ^= 0xff;
      const variants = [Buffer.alloc(0), seed.subarray(0, 1), seed.subarray(0, Math.floor(seed.length / 2)), seed.subarray(0, -1), flipped, Buffer.concat([seed, Buffer.alloc(1024, 0xff)])];
      for (const bytes of variants) {
        const result = await runProcessJob<DocumentResult>(workerEntry("document"), { operation: "extract", fileName: `mutation.${extension}`, bytes: bytes.toString("base64") }, { timeoutMs: 8000 });
        expect(Boolean(result.error) || typeof result.text === "string").toBe(true);
        if (result.text !== undefined) expect(result.text.length).toBeLessThanOrEqual(500000);
      }
      // A malformed job must not poison the following job or the parent.
      const recovered = await runProcessJob<DocumentResult>(workerEntry("document"), { operation: "extract", fileName: "recovery.txt", bytes: Buffer.from("recovered").toString("base64") }, { timeoutMs: 8000 });
      expect(recovered).toEqual({ text: "recovered" });
    }, 30000);
  }
});
