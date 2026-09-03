import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const button = readFileSync(
  new URL("./BusySearchButton.tsx", import.meta.url),
  "utf8",
);
const view = readFileSync(
  new URL("../modules/CurriculumRagView.tsx", import.meta.url),
  "utf8",
);

describe("BusySearchButton", () => {
  it("kondigt de zoekstatus toegankelijk aan", () => {
    expect(button).toContain("aria-busy={visualBusy}");
    expect(button).toContain('aria-live="polite"');
    expect(button).toContain('aria-hidden="true"');
    expect(button).toContain("curriculum-search-spinner");
    expect(button).not.toContain("Loader2");
    expect(button).not.toContain("animate-spin");
  });
});

describe("CurriculumRagView zoekactie", () => {
  it("wisselt naar een processtatus tijdens het zoeken", () => {
    expect(view).toContain('busyAction: "Leerplandoelen zoeken..."');
    expect(view).toContain("BusySearchButton");
    expect(view).toContain('action: "Zoek leerplandoel"');
  });
});
