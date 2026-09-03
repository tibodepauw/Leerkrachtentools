import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app group layout", () => {
  it("houdt accountopslag vast tussen home en instellingen", () => {
    const layout = readFileSync("app/(app)/layout.tsx", "utf8");
    const settings = readFileSync("app/(app)/settings/page.tsx", "utf8");
    const home = readFileSync("app/(app)/page.tsx", "utf8");
    const dashboard = readFileSync("components/Dashboard.tsx", "utf8");

    expect(layout).toContain("UserStorageScope");
    expect(settings).not.toContain("UserStorageScope");
    expect(home).not.toContain("UserStorageScope");
    expect(dashboard).not.toContain("UserStorageScope");
  });
});
