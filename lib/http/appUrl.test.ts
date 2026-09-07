import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { absoluteAppUrl, appOriginFromEnv } from "@/lib/http/appUrl";

describe("absoluteAppUrl", () => {
  it("lost paden op via APP_ORIGIN in plaats van localhost", () => {
    expect(appOriginFromEnv()).toBeNull();
    expect(absoluteAppUrl("/api/rag-curriculum")).toBe(
      "https://app.invalid/api/rag-curriculum",
    );
    expect(absoluteAppUrl("/api/rag-curriculum")).not.toContain("localhost");
    expect(absoluteAppUrl("/api/rag-curriculum")).not.toContain("127.0.0.1");
  });
});

describe("standalone build copy", () => {
  it("kopieert public en .next/static naar de standalone map", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: { build: string };
    };
    expect(packageJson.scripts.build).toContain("next build");
    expect(packageJson.scripts.build).toContain(
      "node scripts/copy-standalone-assets.mjs",
    );
    const copyScript = readFileSync("scripts/copy-standalone-assets.mjs", "utf8");
    expect(copyScript).toContain("cpSync(\"public\", \".next/standalone/public\"");
    expect(copyScript).toContain(
      "cpSync(\".next/static\", \".next/standalone/.next/static\"",
    );
  });
});
