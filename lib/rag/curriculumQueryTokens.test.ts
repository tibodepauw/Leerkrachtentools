import { describe, expect, it } from "vitest";
import {
  countCurriculumTokenMatches,
  inferDisciplineFromQuery,
  isZillMathThinkingCode,
  tokenizeCurriculumQuery,
} from "@/lib/rag/curriculumQueryTokens";
import { searchLocalCorpus } from "@/lib/rag/curriculumCorpus";

describe("curriculumQueryTokens", () => {
  it("breidt vermenigvuldigen uit met synoniemen", () => {
    const tokens = tokenizeCurriculumQuery("vermenigvuldigen tot 20");
    expect(tokens.has("vermenigvuld")).toBe(true);
    expect(tokens.has("maal")).toBe(true);
    expect(tokens.has("20")).toBe(true);
  });

  it("breidt typefout vermeningvuldigen uit met synoniemen", () => {
    const tokens = tokenizeCurriculumQuery("vermeningvuldigen tot 20");
    expect(tokens.has("vermenigvuld")).toBe(true);
    expect(tokens.has("maal")).toBe(true);
    expect(tokens.has("20")).toBe(true);
  });

  it("matcht maaltafels op vermenigvuldigen", () => {
    const tokens = tokenizeCurriculumQuery("vermenigvuldigen");
    expect(
      countCurriculumTokenMatches(
        "De leerlingen kennen de maaltafels van 2 paraat",
        tokens,
      ),
    ).toBeGreaterThan(0);
  });

  it("matcht maaltafels op typefout vermeningvuldigen", () => {
    const tokens = tokenizeCurriculumQuery("vermeningvuldigen");
    expect(
      countCurriculumTokenMatches(
        "De leerlingen kennen de maaltafels van 2 paraat",
        tokens,
      ),
    ).toBeGreaterThan(0);
  });

  it("herkent wiskunde uit reken-query", () => {
    expect(inferDisciplineFromQuery("vermenigvuldigen tot 20")).toBe("Wiskunde");
    expect(inferDisciplineFromQuery("vermeningvuldigen tot 20")).toBe("Wiskunde");
  });

  it("herkent ZILL WD-codes als wiskundig denken", () => {
    expect(isZillMathThinkingCode("WDgk3")).toBe(true);
    expect(isZillMathThinkingCode("WDlw6")).toBe(true);
    expect(isZillMathThinkingCode("WDmm2")).toBe(true);
    expect(isZillMathThinkingCode("IKid1")).toBe(false);
  });
});

describe("searchLocalCorpus curriculum", () => {
  it("vindt wiskundedoelen voor vermenigvuldigen tot 20", () => {
    const results = searchLocalCorpus({
      query: "vermenigvuldigen tot 20",
      network: "OPSTAP",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0]?.discipline.toLowerCase()).toContain("wiskunde");
    expect(results.some((item) => item.titel.toLowerCase().includes("vermenigvuld"))).toBe(
      true,
    );
  });

  it("vindt wiskundedoelen bij typefout vermeningvuldigen", () => {
    const results = searchLocalCorpus({
      query: "vermeningvuldigen tot 20",
      network: "OPSTAP",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0]?.discipline.toLowerCase()).toContain("wiskunde");
  });

  it("vindt ZILL WD-doelen voor vermenigvuldigen", () => {
    const results = searchLocalCorpus({
      query: "vermenigvuldigen tot 20",
      network: "ZILL",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.discipline.toLowerCase()).toContain("wiskunde");
    expect(
      results.some(
        (item) =>
          item.code.startsWith("WD") &&
          (item.titel.toLowerCase().includes("vermenigvuld") ||
            item.code.startsWith("WDrv") ||
            item.code.startsWith("WDlw")),
      ),
    ).toBe(true);
  });
});
