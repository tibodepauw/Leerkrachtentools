import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseModuleVisibilityConfig,
  resetModuleVisibilityConfigForTests,
} from "@/lib/auth/moduleVisibilityConfig";
import {
  hasModuleAccessForUser,
  resolveAccessibleModuleIds,
} from "@/lib/auth/moduleVisibility";

describe("moduleVisibilityConfig", () => {
  it("parseert globale, tier- en gebruikersregels", () => {
    const config = parseModuleVisibilityConfig({
      HIDDEN_MODULES: "voice-reflection, engagement",
      HIDDEN_MODULES_PARTNER: "full-audit",
      USER_MODULE_DENIALS:
        "jan@school.be:spellcheck,full-audit;partner@x.be:engagement",
      USER_MODULE_GRANTS: "beta@school.be:voice-reflection,engagement",
    });

    expect([...config.globalHidden]).toEqual(["voice-reflection", "engagement"]);
    expect([...(config.tierHidden.partner ?? [])]).toEqual(["full-audit"]);
    expect([...(config.userDenials.get("jan@school.be") ?? [])]).toEqual([
      "spellcheck",
      "full-audit",
    ]);
    expect([...(config.userGrants.get("beta@school.be") ?? [])]).toEqual([
      "voice-reflection",
      "engagement",
    ]);
  });
});

describe("moduleVisibility", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetModuleVisibilityConfigForTests();
  });

  it("verbergt modules globaal voor iedereen", () => {
    vi.stubEnv("HIDDEN_MODULES", "voice-reflection");

    expect(
      hasModuleAccessForUser("student", "jan@school.be", "voice-reflection"),
    ).toBe(false);
    expect(
      hasModuleAccessForUser("admin", "owner@school.be", "voice-reflection"),
    ).toBe(false);
    expect(
      hasModuleAccessForUser("student", "jan@school.be", "spellcheck"),
    ).toBe(true);
  });

  it("verbergt modules per tier", () => {
    vi.stubEnv("HIDDEN_MODULES_PARTNER", "engagement,full-audit");

    expect(
      hasModuleAccessForUser("partner", "partner@x.be", "engagement"),
    ).toBe(false);
    expect(
      hasModuleAccessForUser("student", "jan@school.be", "engagement"),
    ).toBe(true);
  });

  it("past per-gebruiker denials toe", () => {
    vi.stubEnv("USER_MODULE_DENIALS", "jan@school.be:spellcheck");

    expect(hasModuleAccessForUser("student", "jan@school.be", "spellcheck")).toBe(
      false,
    );
    expect(
      hasModuleAccessForUser("student", "other@school.be", "spellcheck"),
    ).toBe(true);
  });

  it("kent extra modules toe via grants, tenzij globaal verborgen", () => {
    vi.stubEnv("USER_MODULE_GRANTS", "partner@x.be:voice-reflection");

    expect(
      hasModuleAccessForUser("partner", "partner@x.be", "voice-reflection"),
    ).toBe(true);

    vi.stubEnv("HIDDEN_MODULES", "voice-reflection");
    resetModuleVisibilityConfigForTests();

    expect(
      hasModuleAccessForUser("partner", "partner@x.be", "voice-reflection"),
    ).toBe(false);
  });

  it("resolveert de volledige modulelijst voor een gebruiker", () => {
    vi.stubEnv("HIDDEN_MODULES", "voice-reflection");
    vi.stubEnv("USER_MODULE_DENIALS", "jan@school.be:spellcheck");

    const modules = resolveAccessibleModuleIds("student", "jan@school.be");
    expect(modules).toContain("goal-optimizer");
    expect(modules).not.toContain("voice-reflection");
    expect(modules).not.toContain("spellcheck");
  });
});
