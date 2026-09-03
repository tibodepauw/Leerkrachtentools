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
