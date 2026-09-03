import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GLOW_WORDMARK_TEXT } from "@/components/shared/GlowWordmark";

describe("GlowWordmark", () => {
  it("zet Leerkrachtentools als glow-outline wordmark", () => {
    expect(GLOW_WORDMARK_TEXT).toBe("Leerkrachtentools");
  });

  it("houdt de drie huisstijl-lagen", () => {
    const source = readFileSync(new URL("./GlowWordmark.tsx", import.meta.url), "utf8");
    expect(source).toContain("glow-wordmark__base");
    expect(source).toContain("glow-wordmark__shine");
    expect(source).toContain("glow-wordmark__glow");
  });
});
