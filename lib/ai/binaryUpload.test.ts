import { describe, expect, it } from "vitest";
import { buildSync } from "esbuild";
import { execFileSync } from "node:child_process";
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

  it("houdt URL- en paddingcontrole begrensd in een apart proces", () => {
    // Synchronous regressions cannot hang the test runner: OS process deadline,
    // bounded heap, synthetic input and no provider credentials.
    const bundle = buildSync({
      stdin: { resolveDir: process.cwd(), contents: `
        import assert from 'node:assert/strict';
        import { decodeBoundedBase64, looksLikeUrlString, BinaryUploadError } from './lib/ai/binaryUpload';
        const encoded = 'QUFB'.repeat(2 * 1024 * 1024);
        assert.equal(looksLikeUrlString(encoded), false);
        assert.equal(decodeBoundedBase64(encoded).length, 6 * 1024 * 1024);
        assert.throws(() => decodeBoundedBase64(encoded + 'QUFB'), /te groot/);
        assert.equal(looksLikeUrlString(encoded + '://x'), true);
        for (const input of ['AAAA' + '='.repeat(1000000) + 'A', 'AAAA' + '='.repeat(1000000), 'Zg=', 'Zg===', 'Zh==']) {
          assert.throws(() => decodeBoundedBase64(input), BinaryUploadError);
        }
        for (const input of ['Zg==', 'Zg', 'Zg==\\n']) assert.equal(Buffer.from(decodeBoundedBase64(input)).toString(), 'f');
        console.log('bounded');
      ` },
      bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
    });
    expect(execFileSync(process.execPath, ["--max-old-space-size=96", "-e", bundle.outputFiles[0].text], {
      cwd: process.cwd(), env: { NODE_ENV: "test" }, timeout: 3000, maxBuffer: 4096, encoding: "utf8",
    }).trim()).toBe("bounded");
  });
});
