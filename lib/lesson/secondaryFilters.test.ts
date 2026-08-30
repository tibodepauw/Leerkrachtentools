import { describe, expect, it } from "vitest";
import {
  matchesSecondaryFinalityFilter,
  matchesSecondaryGradeFilter,
  scoreSecondaryFilterBonus,
  secondaryGradeFilterFromLessonGrade,
} from "@/lib/lesson/secondaryFilters";
import type { CurriculumSearchResult } from "@/types";

function sampleResult(
  overrides: Partial<CurriculumSearchResult> = {},
): CurriculumSearchResult {
  return {
    code: "SO-1",
    discipline: "Wiskunde",
    subdomein: "",
    titel: "Probleem analyseren",
    toelichting: "",
    leerjaarRoute: "",
    gelinktMinimumdoel: null,
    netwerk: "GO",
    bronUrl: "",
    ...overrides,
  };
}

describe("secondaryFilters", () => {
  it("mapt secundaire leerjaren naar graad-filters", () => {
    expect(secondaryGradeFilterFromLessonGrade("s1")).toBe("1ste_graad");
    expect(secondaryGradeFilterFromLessonGrade("s3")).toBe("3de_graad");
    expect(secondaryGradeFilterFromLessonGrade("l3")).toBeNull();
  });

  it("herkent graad en finaliteit in corpusmetadata", () => {
    const haystack =
      "2de graad doorstroomfinaliteit wiskunde natuurwetenschappen";
    expect(matchesSecondaryGradeFilter(haystack, "2de_graad")).toBe(true);
    expect(matchesSecondaryFinalityFilter(haystack, "doorstroom")).toBe(true);
    expect(matchesSecondaryFinalityFilter(haystack, "arbeidsmarkt")).toBe(false);
  });

  it("geeft sterke bonus bij passende graad en finaliteit", () => {
    const result = sampleResult({
      leerjaarRoute: "2de graad · doorstroomfinaliteit",
    });

    expect(
      scoreSecondaryFilterBonus(
        { secondaryGrade: "2de_graad", secondaryFinality: "doorstroom" },
        result,
      ),
    ).toBeGreaterThan(0.35);

    expect(
      scoreSecondaryFilterBonus(
        { secondaryGrade: "1ste_graad", secondaryFinality: "all" },
        result,
      ),
    ).toBe(0);
  });
});
