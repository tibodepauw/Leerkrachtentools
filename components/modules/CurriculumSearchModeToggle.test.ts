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
    expect(source).not.toContain("Directe catalogus");
    expect(source).not.toContain("Didactische assistent");
  });

  it("schuift de metallic pill met left, niet met translateX", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const toggle = css.slice(css.indexOf(".search-mode-toggle {"));

    expect(toggle).toMatch(/overflow:\s*hidden/);
    expect(toggle).toMatch(
      /\.search-mode-toggle\[data-mode="pro"\] \.search-mode-toggle__thumb \{\s*left:\s*50%;/,
    );
    expect(toggle).not.toMatch(/translateX\(100%\)/);
    expect(toggle).toMatch(
      /background:\s*linear-gradient\(180deg, var\(--gl-btn-from\) 0%, var\(--gl-btn-to\) 100%\)/,
    );
  });
});
