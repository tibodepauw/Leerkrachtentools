import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const env = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
describe("analytics deployment defaults",()=>{
 it("keeps unknown project configuration disabled and exposes the common choice in root layout",()=>{
  expect(env).toContain("NEXT_PUBLIC_ANALYTICS_ENABLED=false");
  expect(env).toContain("NEXT_PUBLIC_POSTHOG_CONFIGURATION_CONFIRMED=false");
  expect(env).toContain("NEXT_PUBLIC_POSTHOG_RETENTION_MONTHS=\n");
  expect(layout).toContain("PostHogProvider");
 });
});
