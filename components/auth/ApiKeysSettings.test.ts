import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ApiKeysSettings", () => {
  it("laadt de modellijst automatisch en houdt de dropdown hoog genoeg", () => {
    const source = readFileSync("components/auth/ApiKeysSettings.tsx", "utf8");
    expect(source).toContain("loadProviderModels");
    expect(source).toContain("silent: true");
    expect(source).toContain('className="max-h-72"');
    expect(source).toContain("pickPreferredModelId");
  });
});
