import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isVisualTheme, parseVisualTheme } from "@/lib/ui/visualTheme";

describe("visualTheme", () => {
  it("kent alleen classic en huisstijl", () => {
    expect(isVisualTheme("classic")).toBe(true);
    expect(isVisualTheme("huisstijl")).toBe(true);
    expect(isVisualTheme("dark")).toBe(false);
  });

  it("valt terug op classic bij onbekende waarden", () => {
    expect(parseVisualTheme(null)).toBe("classic");
    expect(parseVisualTheme("nope")).toBe("classic");
    expect(parseVisualTheme("huisstijl")).toBe("huisstijl");
  });
});

describe("huisstijl overlay", () => {
  const css = readFileSync("app/globals.css", "utf8");

  it("zet geen position relative op alle body-kinderen", () => {
    expect(css).not.toMatch(
      /body\s*>\s*\*:not\(\.visual-theme-toggle\)/,
    );
    expect(css).toMatch(/\.lt-app \{/);
  });

  it("houdt de testversie-toggle onder dialogs", () => {
    expect(css).toMatch(/\.visual-theme-toggle \{[\s\S]*?z-index:\s*40;/);
  });
});

describe("dialogs", () => {
  it("centreert kaders met inset in plaats van translate", () => {
    const dialog = readFileSync("components/ui/dialog.tsx", "utf8");
    expect(dialog).toMatch(/inset-4/);
    expect(dialog).not.toMatch(/top-1\/2 left-1\/2/);
  });
});
