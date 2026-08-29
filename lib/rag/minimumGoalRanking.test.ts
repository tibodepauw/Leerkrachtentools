import { describe, expect, it } from "vitest";
import type { CurriculumSearchResult } from "@/types";
import {
  applyMinimumGoalRangeBonus,
  extractQuerySignals,
  rankMinimumGoalResults,
} from "@/lib/rag/minimumGoalRanking";

function resultWithMinimum(
  minimumText: string,
  overrides: Partial<CurriculumSearchResult> = {},
): CurriculumSearchResult {
  return {
    code: "LP1",
    discipline: "Wiskunde",
    subdomein: "",
    titel: "Leerplandoel",
    toelichting: "",
    leerjaarRoute: "",
    gelinktMinimumdoel: {
      code: "MD1",
      tekst: minimumText,
      type: "",
    },
    netwerk: "ZILL",
    bronUrl: "",
    ...overrides,
  };
}

describe("minimumGoalRanking", () => {
  it("herkent primair getalbereik in de zoekopdracht", () => {
    expect(extractQuerySignals("optellen tot 20").primaryNumber).toBe(20);
    expect(extractQuerySignals("rekenen t/m 10 000").primaryNumber).toBe(10000);
  });

  it("geeft bonus bij exact hetzelfde getalbereik", () => {
    const query = "optellen tot 20";
    const exact = resultWithMinimum(
      "De leerlingen kunnen natuurlijke getallen tot 20 optellen.",
    );
    const mismatch = resultWithMinimum(
      "De leerlingen kunnen natuurlijke getallen tot 10 000 optellen.",
      { leerjaarRoute: "6e leerjaar" },
    );

    const exactScore = applyMinimumGoalRangeBonus(query, exact, 0.5);
    const mismatchScore = applyMinimumGoalRangeBonus(query, mismatch, 0.5);

    expect(exactScore).toBeGreaterThan(mismatchScore);
  });

  it("geeft bonus bij fase-termen zoals kommagetallen", () => {
    const query = "rekenen met kommagetallen";
    const match = resultWithMinimum(
      "De leerlingen kunnen kommagetallen tot honderdste benoemen.",
    );
    const other = resultWithMinimum(
      "De leerlingen kunnen natuurlijke getallen tot 20 optellen.",
    );

    expect(
      applyMinimumGoalRangeBonus(query, match, 0.45),
    ).toBeGreaterThan(applyMinimumGoalRangeBonus(query, other, 0.45));
  });

  it("rangschikt top 3 unieke minimumdoelen", () => {
    const ranked = rankMinimumGoalResults("optellen tot 20", [
      {
        ...resultWithMinimum("Minimum tot 20", {
          gelinktMinimumdoel: { code: "A", tekst: "Minimum tot 20", type: "" },
        }),
        score: 0.7,
      },
      {
        ...resultWithMinimum("Minimum tot 10 000", {
          gelinktMinimumdoel: {
            code: "B",
            tekst: "Minimum tot 10 000",
            type: "",
          },
        }),
        score: 0.75,
      },
      {
        ...resultWithMinimum("Minimum tot 20 variant", {
          gelinktMinimumdoel: {
            code: "C",
            tekst: "Minimum tot 20 variant",
            type: "",
          },
        }),
        score: 0.65,
      },
      {
        ...resultWithMinimum("Minimum breuken", {
          gelinktMinimumdoel: {
            code: "D",
            tekst: "Minimum breuken",
            type: "",
          },
        }),
        score: 0.6,
      },
    ]);

    expect(ranked).toHaveLength(3);
    expect(ranked[0]?.gelinktMinimumdoel?.code).toBe("A");
  });
});
