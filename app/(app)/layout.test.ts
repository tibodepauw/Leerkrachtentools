import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app group layout", () => {
  it("houdt accountopslag vast tussen home en instellingen", () => {
    const layout = readFileSync("app/(app)/layout.tsx", "utf8");
    const settings = readFileSync("app/(app)/settings/page.tsx", "utf8");
    const home = readFileSync("app/(app)/page.tsx", "utf8");
    const dashboard = readFileSync("components/Dashboard.tsx", "utf8");

    expect(layout).toContain("UserStorageScope");
    expect(layout).toContain("accountPinnedModules");
    expect(settings).not.toContain("UserStorageScope");
    expect(home).not.toContain("UserStorageScope");
    expect(dashboard).not.toContain("UserStorageScope");
  });

  it("laadt vastgezette tools uit het account en maakt persist los voor hydratatie", () => {
    const scope = readFileSync("components/auth/UserStorageScope.tsx", "utf8");
    expect(scope).toContain("setActiveUserId(null)");
    expect(scope).toContain("/api/account/pinned-modules");
    expect(scope).toContain("reconcilePinnedModules");
  });
});
