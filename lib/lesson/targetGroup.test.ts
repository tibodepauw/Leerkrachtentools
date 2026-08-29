import { describe, expect, it } from "vitest";
import {
  GRADE_OPTIONS,
  inferGradeFromLegacyTargetGroup,
  migrateLessonTargetGroup,
  resolveTargetGroupFields,
  targetGroupHeaderLabel,
} from "@/lib/lesson/targetGroup";
import {
  applyTargetGroupRanking,
  scoreTargetGroupBonus,
  TARGET_GROUP_BONUS,
} from "@/lib/rag/targetGroupBonus";
import type { CurriculumSearchResult } from "@/types";

function sampleResult(
  overrides: Partial<CurriculumSearchResult> = {},
): CurriculumSearchResult {
  return {
    code: "MZgm1",
    discipline: "Lichamelijke opvoeding",
    subdomein: "Grootmotorisch bewegen",
    titel: "Balanceren op",
    toelichting: "",
    leerjaarRoute: "2.5-12j",
    gelinktMinimumdoel: null,
    netwerk: "ZILL",
    bronUrl: "",
    ...overrides,
  };
}

describe("targetGroup lesson model", () => {
  it("vult leerjaar automatisch aan met leeftijd en weergave", () => {
    expect(resolveTargetGroupFields({ grade: "l3" })).toEqual({
      grade: "l3",
      ageRange: "8-9j",
      displayTargetGroup: "3de leerjaar (8-9j)",
      targetGroup: "3de leerjaar (8-9j)",
    });
  });

  it("ondersteunt aangepaste doelgroepen", () => {
    expect(
      resolveTargetGroupFields({
        grade: "custom",
        customLabel: "Graadsklas B",
        customAgeRange: "8-9j",
      }),
    ).toEqual({
      grade: "custom",
      ageRange: "8-9j",
      displayTargetGroup: "Graadsklas B (8-9j)",
      targetGroup: "Graadsklas B (8-9j)",
    });
  });

  it("migreert legacy vrije tekst naar custom of herkende leerjaren", () => {
    expect(
      migrateLessonTargetGroup({ targetGroup: "3de leerjaar" }).grade,
    ).toBe("l3");
    expect(
      migrateLessonTargetGroup({ targetGroup: "L6B" }).grade,
    ).toBe("custom");
    expect(inferGradeFromLegacyTargetGroup("2de kleuter")).toBe("k2");
  });

  it("toont headerlabel met displayTargetGroup", () => {
    expect(
      targetGroupHeaderLabel({
        displayTargetGroup: "3de leerjaar (8-9j)",
      }),
    ).toBe("3de leerjaar (8-9j)");
    expect(targetGroupHeaderLabel({})).toBe("Doelgroep nog niet ingevuld");
  });

  it("bevat alle gevraagde leerjaren", () => {
    expect(GRADE_OPTIONS.map((option) => option.value)).toEqual([
      "peuters",
      "k1",
      "k2",
      "k3",
      "l1",
      "l2",
      "l3",
      "l4",
      "l5",
      "l6",
      "custom",
    ]);
  });
});

describe("targetGroupBonus", () => {
  it("geeft bonus voor passende leeftijd zonder andere doelen uit te sluiten", () => {
    const bonus = scoreTargetGroupBonus(
      { grade: "l3", ageRange: "8-9j" },
      sampleResult({ leerjaarRoute: "7-9j" }),
    );
    expect(bonus).toBe(TARGET_GROUP_BONUS);
  });

  it("geeft bonus voor kleuterdoelen bij kleuterkeuze", () => {
    const bonus = scoreTargetGroupBonus(
      { grade: "k2", ageRange: "4-5j" },
      sampleResult({
        code: "",
        leerjaarRoute: "Kleuteronderwijs (ontwikkelingsdoel)",
        gelinktMinimumdoel: {
          code: "K-1.1.1",
          tekst: "De kleuters kunnen rijm herkennen.",
          type: "Minimumdoel",
        },
      }),
    );
    expect(bonus).toBe(TARGET_GROUP_BONUS);
  });

  it("geeft geen bonus zonder doelgroepcontext", () => {
    expect(scoreTargetGroupBonus({}, sampleResult())).toBe(0);
  });

  it("herordent resultaten zonder hard filter", () => {
    const ranked = applyTargetGroupRanking(
      [
        { ...sampleResult({ code: "WDgk3", leerjaarRoute: "10-12j" }), score: 0.8 },
        { ...sampleResult({ code: "MZgm7", leerjaarRoute: "8-9j" }), score: 0.7 },
      ],
      { grade: "l3", ageRange: "8-9j" },
    );

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.code).toBe("MZgm7");
    expect(ranked[1]?.code).toBe("WDgk3");
  });
});
