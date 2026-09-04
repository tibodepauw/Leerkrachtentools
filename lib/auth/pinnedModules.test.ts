import { describe, expect, it } from "vitest";
import {
  parsePinnedModules,
  pinnedModulesEqual,
  reconcilePinnedModules,
  serializePinnedModules,
} from "@/lib/auth/pinnedModules";

describe("parsePinnedModules", () => {
  it("houdt unieke vastzetbare tools in volgorde", () => {
    expect(
      parsePinnedModules(["spellcheck", "alignment", "spellcheck", "active-lesson"]),
    ).toEqual(["spellcheck", "alignment"]);
  });

  it("leest JSON-strings en negeert ongeldige invoer", () => {
    expect(parsePinnedModules('["timing-check","voice-reflection"]')).toEqual([
      "timing-check",
      "voice-reflection",
    ]);
    expect(parsePinnedModules("niet-json")).toEqual([]);
    expect(parsePinnedModules({ pinnedModules: ["spellcheck"] })).toEqual([]);
    expect(parsePinnedModules(null)).toEqual([]);
  });

  it("serialiseert naar een stabiele JSON-array", () => {
    expect(serializePinnedModules(["alignment", "unknown"])).toBe('["alignment"]');
    expect(pinnedModulesEqual(["spellcheck"], '["spellcheck"]')).toBe(true);
  });
});

describe("reconcilePinnedModules", () => {
  it("gebruikt lokale pins als het account nog leeg is", () => {
    expect(
      reconcilePinnedModules(["spellcheck", "alignment"], []),
    ).toEqual({
      pins: ["spellcheck", "alignment"],
      shouldUpload: true,
    });
  });

  it("laat het account winnen tussen apparaten", () => {
    expect(
      reconcilePinnedModules(["spellcheck"], ["timing-check", "alignment"]),
    ).toEqual({
      pins: ["timing-check", "alignment"],
      shouldUpload: false,
    });
  });

  it("blijft leeg als beide kanten leeg zijn", () => {
    expect(reconcilePinnedModules([], [])).toEqual({
      pins: [],
      shouldUpload: false,
    });
  });
});
