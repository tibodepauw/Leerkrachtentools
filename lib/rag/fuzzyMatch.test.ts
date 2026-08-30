import { describe, expect, it } from "vitest";
import {
  applyPhoneticTypos,
  bigramOverlap,
  fuzzySimilarity,
  isFuzzySimilar,
  levenshteinDistance,
} from "@/lib/rag/fuzzyMatch";

describe("fuzzyMatch", () => {
  it("meet Levenshtein-afstand voor typefouten", () => {
    expect(levenshteinDistance("vermeningvuldigen", "vermenigvuldigen")).toBe(1);
    expect(levenshteinDistance("optel", "optellen")).toBeLessThanOrEqual(3);
  });

  it("herkent vermeningvuldigen als fuzzy variant", () => {
    expect(
      isFuzzySimilar("vermeningvuldigen", "vermenigvuldigen", 0.72),
    ).toBe(true);
    expect(fuzzySimilarity("vermeningvuldigen", "vermenigvuldigen")).toBeGreaterThan(
      0.72,
    );
  });

  it("normaliseert veelvoorkomende fonetische typos", () => {
    expect(applyPhoneticTypos("opptellingen tot twintich")).toBe(
      "optellen tot twintig",
    );
    expect(applyPhoneticTypos("vermeningvuldigen")).toBe("vermenigvuldigen");
    expect(applyPhoneticTypos("prorgammeren")).toBe("programmeren");
  });

  it("berekent bigram overlap", () => {
    expect(bigramOverlap("vermenigvuldigen", "vermenigvuldiging")).toBeGreaterThan(
      0.5,
    );
  });
});
