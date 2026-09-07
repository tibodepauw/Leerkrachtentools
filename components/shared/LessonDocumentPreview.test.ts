import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./LessonDocumentPreview.tsx", import.meta.url),
  "utf8",
);

describe("LessonDocumentPreview", () => {
  it("schakelt altChunks uit en markeert lesinhoud als no-capture", () => {
    expect(source).toContain("renderAltChunks: false");
    expect(source).toContain("ph-no-capture");
  });
});
