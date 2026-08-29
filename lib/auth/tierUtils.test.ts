import { describe, expect, it } from "vitest";
import { dailyServerAiLimit } from "@/lib/auth/tiers";
import { normalizeAccountTier } from "@/lib/auth/tierUtils";
import { evaluateServerAiAccess } from "@/lib/ai/usageLimits";

describe("tierUtils", () => {
  it("mapt legacy free tier naar student", () => {
    expect(normalizeAccountTier("free")).toBe("student");
    expect(dailyServerAiLimit("free")).toBe(40);
  });
});

describe("server AI access with legacy tiers", () => {
  it("staat legacy free tier toe voor server-ai", () => {
    const access = evaluateServerAiAccess({
      userId: "legacy-user",
      tier: "free",
      userAiConfig: null,
    });

    expect(access.allowed).toBe(true);
    if (access.allowed && access.usesServerQuota) {
      expect(access.limit).toBe(40);
    }
  });
});
