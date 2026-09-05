import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CurriculumSearchModeToggle", () => {
  it("gebruikt een huisstijl-pill voor Snel en Pro", () => {
    const source = readFileSync(
      "components/modules/CurriculumSearchModeToggle.tsx",
      "utf8",
    );

    expect(source).toContain('label: "Snel"');
    expect(source).toContain('label: "Pro"');
    expect(source).toContain("search-mode-toggle");
    expect(source).toContain('role="radiogroup"');
    expect(source).toContain("Sparkles");
    expect(source).toContain("Zap");
  });
});
