import { describe, expect, it } from "vitest";
import {
  formatAhovoksMinimumGoalCopy,
  isAhovoksMinimumGoalCode,
  normalizeAhovoksMinimumGoalResult,
  parseAhovoksCode,
} from "@/lib/rag/ahovoksMinimumGoals";

describe("ahovoksMinimumGoals", () => {
  it("parseert 4de- en 6de-ijkpuntcodes", () => {
    expect(parseAhovoksCode("4-2.2.16")).toEqual({
      rawCode: "4-2.2.16",
      displayCode: "2.2.16",
      ijkpunt: "4de",
      ijkpuntLabel: "4de leerjaar (ijkpunt)",
      ijkpuntShort: "4de leerjaar",
    });
    expect(parseAhovoksCode("6-2.2.6")).toEqual({
      rawCode: "6-2.2.6",
      displayCode: "2.2.6",
      ijkpunt: "6de",
      ijkpuntLabel: "6de leerjaar (einddoel)",
      ijkpuntShort: "6de leerjaar",
    });
  });

  it("parseert kleuter K-codes", () => {
    expect(parseAhovoksCode("K-1.1.3")).toEqual({
      rawCode: "K-1.1.3",
      displayCode: "K-1.1.3",
      ijkpunt: "kleuter",
      ijkpuntLabel: "Kleuteronderwijs (ontwikkelingsdoel)",
      ijkpuntShort: "Kleuteronderwijs",
    });
  });

  it("weigert interne leerplancodes", () => {
    expect(isAhovoksMinimumGoalCode("WISget7B.23")).toBe(false);
    expect(isAhovoksMinimumGoalCode("2.2.GL1.16")).toBe(false);
  });

  it("formatteert kopieertekst volgens AHOVOKS", () => {
    expect(
      formatAhovoksMinimumGoalCopy({
        code: "2.2.16",
        rawCode: "4-2.2.16",
        tekst: "De leerlingen kennen paraat de optellingen tot en met 20.",
        type: "",
      }),
    ).toBe(
      "[Code 2.2.16 - 4de leerjaar] De leerlingen kennen paraat de optellingen tot en met 20.",
    );
  });

  it("normaliseert API-resultaten naar decretale weergave", () => {
    const normalized = normalizeAhovoksMinimumGoalResult({
      code: "2.2.GL1.16",
      discipline: "Wiskunde",
      subdomein: "",
      titel: "Leerplandoel",
      toelichting: "",
      leerjaarRoute: "1ste leerjaar (G)",
      gelinktMinimumdoel: {
        code: "4-2.2.16",
        tekst: "De leerlingen kennen paraat de optellingen tot en met 20.",
        type: "",
      },
      netwerk: "OPSTAP",
      bronUrl: "",
    });

    expect(normalized?.gelinktMinimumdoel?.code).toBe("2.2.16");
    expect(normalized?.leerjaarRoute).toBe("4de leerjaar (ijkpunt)");
    expect(normalized?.titel).toBe("");
    expect(normalized?.leerjaarRoute).not.toContain("1ste leerjaar");
  });
});
