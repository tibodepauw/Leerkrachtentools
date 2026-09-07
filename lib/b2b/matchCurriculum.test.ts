import { describe, expect, it } from "vitest";
import {
  CURRICULUM_MATCH_RESULT_KEYS,
  toCurriculumMatchResult,
} from "@/lib/b2b/matchCurriculum";
import { curriculumMatchBodySchema } from "@/lib/b2b/schemas";
import type { CurriculumSearchResult } from "@/types";

const ALLOWED_KEYS = new Set<string>(CURRICULUM_MATCH_RESULT_KEYS);

function sampleResult(
  extras: Partial<CurriculumSearchResult> = {},
): CurriculumSearchResult {
  return {
    code: "2.2.GL1.1",
    discipline: "Wiskunde",
    subdomein: "Getallen",
    titel: "De leerlingen tellen tot twintig.",
    toelichting:
      "Volledig koepelhoofdstuk met pedagogische wenken, achtergrondtekst en voorbeelden over meerdere bladzijden.",
    leerjaarRoute: "1ste leerjaar (G)",
    gelinktMinimumdoel: {
      code: "1.2.1",
      tekst: "De leerlingen tellen tot twintig.",
      type: "Te bereiken minimumdoelen op populatieniveau",
    },
    netwerk: "OPSTAP",
    bronUrl: "https://opstap.example/secret-chapter",
    snippet: "Volledige achtergrondtekst mag niet over de lijn.",
    sourceUri: "file://data/opstap/opstap_volledig.jsonl",
    bronTitel: "Hoofdstuk rekenen",
    verrijking: "corpus",
    score: 0.91,
    ...extras,
  };
}

describe("B2B curriculum match citations", () => {
  it("default limit is 5 and rejects more than 10", () => {
    expect(curriculumMatchBodySchema.parse({ query: "tellen tot twintig" }).limit).toBe(
      5,
    );
    expect(
      curriculumMatchBodySchema.parse({ query: "tellen tot twintig", limit: 10 })
        .limit,
    ).toBe(10);
    expect(() =>
      curriculumMatchBodySchema.parse({ query: "tellen tot twintig", limit: 11 }),
    ).toThrow();
    expect(() =>
      curriculumMatchBodySchema.parse({ query: "tellen tot twintig", limit: 0 }),
    ).toThrow();
  });

  it("geeft alleen code, text, network, score en optionele didactic_note terug", () => {
    const mapped = toCurriculumMatchResult(sampleResult());
    expect(mapped).toEqual({
      code: "1.2.1",
      text: "De leerlingen tellen tot twintig.",
      network: "OPSTAP",
      score: 0.91,
    });
    expect(Object.keys(mapped ?? {}).every((key) => ALLOWED_KEYS.has(key))).toBe(
      true,
    );
    expect(JSON.stringify(mapped)).not.toContain("pedagogische wenken");
    expect(JSON.stringify(mapped)).not.toContain("koepelhoofdstuk");
    expect(JSON.stringify(mapped)).not.toMatch(/toelichting/i);
  });

  it("gebruikt alleen de gegenereerde verantwoording, nooit toelichting", () => {
    const mapped = toCurriculumMatchResult(
      sampleResult({ proWhy: "Kort: oefen tellen tot 20 in de instap." }),
    );
    expect(mapped?.didactic_note).toBe("Kort: oefen tellen tot 20 in de instap.");
    expect(mapped?.didactic_note).not.toContain("koepelhoofdstuk");
  });
});
