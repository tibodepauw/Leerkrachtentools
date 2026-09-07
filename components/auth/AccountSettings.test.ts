import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AccountSettings.tsx", import.meta.url),
  "utf8",
);

describe("AccountSettings privacy copy", () => {
  it("reset PostHog bij logout en beschrijft retentie bij verwijderen", () => {
    expect(source).toContain("resetPostHogIdentity");
    expect(source).toContain("openstaande logincodes");
    expect(source).toContain("dagelijkse AI-budget");
  });
});
