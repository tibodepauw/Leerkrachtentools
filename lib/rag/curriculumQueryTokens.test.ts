import { describe, expect, it } from "vitest";
import {
  countCurriculumTokenMatches,
  inferDisciplineFromQuery,
  isZillMathThinkingCode,
  isZillMediaCode,
  isZillMotorCode,
  scoreCurriculumOverlap,
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
        "vermenigvuldigen",
      ),
    ).toBeGreaterThan(0);
  });

  it("matcht maaltafels op typefout vermeningvuldigen", () => {
    const tokens = tokenizeCurriculumQuery("vermeningvuldigen");
    expect(
      countCurriculumTokenMatches(
        "De leerlingen kennen de maaltafels van 2 paraat",
        tokens,
        "vermeningvuldigen",
      ),
    ).toBeGreaterThan(0);
  });

  it("weegt inhoudelijke kernwoorden zwaarder dan stopwoorden", () => {
    const contentScore = scoreCurriculumOverlap(
      "De leerlingen kennen kastelen en burchten in de middeleeuwen",
      tokenizeCurriculumQuery("de leerlingen kunnen kastelen benoemen"),
      "de leerlingen kunnen kastelen benoemen",
    );
    const stopwordOnlyScore = scoreCurriculumOverlap(
      "De leerlingen kennen kastelen en burchten in de middeleeuwen",
      tokenizeCurriculumQuery("de leerlingen kunnen"),
      "de leerlingen kunnen",
    );

    expect(contentScore).toBeGreaterThan(stopwordOnlyScore);
  });

  it("herkent geschiedenis uit kastelen-query", () => {
    expect(inferDisciplineFromQuery("kastelen in de middeleeuwen")).toBe(
      "Geschiedenis",
    );
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

  it("breidt motorische tokens uit voor LO-zoekopdrachten", () => {
    const tokens = tokenizeCurriculumQuery("koprol en springen");
    expect(tokens.has("koprol")).toBe(true);
    expect(tokens.has("spring")).toBe(true);
    expect(tokens.has("roll")).toBe(true);
    expect(tokens.has("balanc")).toBe(true);
  });

  it("breidt media-tokens uit voor presentatie-zoekopdrachten", () => {
    const tokens = tokenizeCurriculumQuery("powerpoint presentatie maken");
    expect(tokens.has("powerpoint")).toBe(true);
    expect(tokens.has("present")).toBe(true);
    expect(tokens.has("slide")).toBe(true);
    expect(tokens.has("maken")).toBe(false);
  });

  it("corrigeert typefout presntatie naar presentatie-stems", () => {
    const tokens = tokenizeCurriculumQuery("presntatie met slides");
    expect(tokens.has("present")).toBe(true);
    expect(tokens.has("presntat")).toBe(true);
    expect(tokens.has("slide")).toBe(true);
  });

  it("herkent lichamelijke opvoeding uit motor-query", () => {
    expect(inferDisciplineFromQuery("koprol en balanceren")).toBe(
      "Lichamelijke opvoeding",
    );
  });

  it("herkent ICT uit presentatie-query", () => {
    expect(inferDisciplineFromQuery("powerpoint presentatie")).toBe("ICT");
    expect(inferDisciplineFromQuery("presntatie slides")).toBe("ICT");
  });

  it("herkent ZILL motor- en media-codes", () => {
    expect(isZillMotorCode("MZgm6")).toBe(true);
    expect(isZillMotorCode("MZlb5")).toBe(true);
    expect(isZillMotorCode("WDgk3")).toBe(false);
    expect(isZillMediaCode("MEge2")).toBe(true);
    expect(isZillMediaCode("MEmw1")).toBe(true);
    expect(isZillMediaCode("MEva1")).toBe(true);
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

  it("vindt OWna-doelen voor zoogdieren via geneste ontwikkelstappen", () => {
    const results = searchLocalCorpus({
      query: "zoogdieren",
      network: "ZILL",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((item) => item.code.startsWith("OWna"))).toBe(true);
  });

  it("rangschikt TOsn boven Frans/godsdienst bij sleutelwoorden en tekst", () => {
    const results = searchLocalCorpus({
      query: "sleutelwoorden uit een tekst",
      network: "ZILL",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.code.startsWith("TOsn")).toBe(true);
  });

  it("vindt OWti-doelen voor kastelen", () => {
    const results = searchLocalCorpus({
      query: "kastelen middeleeuwen",
      network: "ZILL",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((item) => item.code.startsWith("OWti"))).toBe(true);
  });

  it("vindt MZgm/MZlb-doelen voor springen en balanceren", () => {
    const results = searchLocalCorpus({
      query: "springen balanceren",
      network: "ZILL",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(
      results.some(
        (item) =>
          item.code.startsWith("MZgm") || item.code.startsWith("MZlb"),
      ),
    ).toBe(true);
    expect(results[0]?.discipline.toLowerCase()).toContain("lichamelijk");
  });

  it("vindt ME/TOmn-doelen voor powerpoint presentatie", () => {
    const results = searchLocalCorpus({
      query: "powerpoint presentatie",
      network: "ZILL",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(
      results.some(
        (item) =>
          item.code.startsWith("ME") || item.code.startsWith("TOmn"),
      ),
    ).toBe(true);
  });

  it("vindt ME-doelen bij typefout presntatie", () => {
    const results = searchLocalCorpus({
      query: "presntatie slides",
      network: "ZILL",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(
      results.some(
        (item) =>
          item.code.startsWith("ME") || item.code.startsWith("TOmn"),
      ),
    ).toBe(true);
  });
});
