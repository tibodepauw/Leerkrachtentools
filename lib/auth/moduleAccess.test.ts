import { describe, expect, it } from "vitest";
import type { ModuleId } from "@/types";
import {
  hasModuleAccess,
  MODULE_CONFIG,
  TOOL_MODULE_IDS,
} from "@/lib/auth/moduleAccess";

describe("moduleAccess", () => {
  it("geeft student, tester en admin toegang tot alle 12 modules", () => {
    for (const tier of ["student", "tester", "admin"] as const) {
      for (const moduleId of TOOL_MODULE_IDS) {
        expect(hasModuleAccess(tier, moduleId)).toBe(true);
      }
    }
  });

  it("beperkt partner tot B2B-modules zonder Thomas More, Laevers en voice", () => {
    const allowed = [
      "manual-scanner",
      "goal-optimizer",
      "goal-taxonomy",
      "curriculum-rag",
      "minimum-goals",
      "spellcheck",
      "timing-check",
      "alignment",
      "full-audit",
    ] as const;

    for (const moduleId of allowed) {
      expect(hasModuleAccess("partner", moduleId)).toBe(true);
    }

    expect(hasModuleAccess("partner", "dialogue-formatter")).toBe(false);
    expect(hasModuleAccess("partner", "engagement")).toBe(false);
    expect(hasModuleAccess("partner", "voice-reflection")).toBe(false);
  });

  it("blokkeert unapproved voor alle modules", () => {
    for (const moduleId of Object.keys(MODULE_CONFIG) as ModuleId[]) {
      expect(hasModuleAccess("unapproved", moduleId)).toBe(false);
    }
  });

  it("herkent thomas-more-style alias", () => {
    expect(hasModuleAccess("partner", "thomas-more-style")).toBe(false);
    expect(hasModuleAccess("student", "thomas-more-style")).toBe(true);
  });
});
