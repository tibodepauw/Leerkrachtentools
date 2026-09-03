import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AuthScreen.tsx", import.meta.url), "utf8");

describe("AuthScreen markup", () => {
  it("nest geen button rond een checkbox", () => {
    expect(source).not.toMatch(/<button[\s\S]*?<Checkbox/);
  });

  it("zet Toestemming in sentence case zonder uppercase tracking", () => {
    expect(source).toContain("Toestemming");
    expect(source).not.toMatch(/Toestemming[\s\S]{0,80}uppercase/);
    expect(source).not.toMatch(/uppercase tracking-\[0\.14em\]/);
  });
});
