import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  formatGoalCopyText,
  formatMinimumGoalCopyText,
  formatSearchResultMetadata,
  networkBadgeLabel,
} from "@/lib/rag/curriculumDisplay";
import type { CurriculumSearchResult } from "@/types";

describe("curriculumDisplay", () => {
  it("decodeert HTML-entiteiten", () => {
    expect(decodeHtmlEntities("De leerlingen &lt;20&gt; optellen")).toBe(
      "De leerlingen <20> optellen",
    );
  });

  it("formatteert netwerk-badges", () => {
    expect(networkBadgeLabel("OPSTAP")).toBe("Op.stap");
    expect(networkBadgeLabel("GO_NIEUW")).toBe("GO! Nieuw");
  });

  it("formatteert kopieertekst voor doelen", () => {
    const result: CurriculumSearchResult = {
      code: "1.2.GL2.1",
      discipline: "Wiskunde",
      subdomein: "",
      titel: "De leerlingen kunnen tot 20 optellen.",
      toelichting: "",
      leerjaarRoute: "",
      gelinktMinimumdoel: null,
      netwerk: "OPSTAP",
      bronUrl: "",
    };

    expect(formatGoalCopyText(result)).toBe(
      "[1.2.GL2.1] De leerlingen kunnen tot 20 optellen.",
    );
  });

  it("formatteert kopieertekst voor minimumdoelen", () => {
    expect(
      formatMinimumGoalCopyText({
        code: "DIG1B.25",
        tekst: "De leerlingen kunnen eenvoudige patronen herkennen.",
        type: "",
      }),
    ).toBe("[DIG1B.25] De leerlingen kunnen eenvoudige patronen herkennen.");
  });

  it("toont discipline, subdomein, leerjaar en netwerk in metadata", () => {
    const result: CurriculumSearchResult = {
      code: "OWti3",
      discipline: "Geschiedenis",
      subdomein: "Tijdlijnen",
      titel: "De leerlingen situeren gebeurtenissen op een tijdlijn.",
      toelichting: "",
      leerjaarRoute: "3e leerjaar",
      gelinktMinimumdoel: null,
      netwerk: "ZILL",
      bronUrl: "https://zill-selector.katholiekonderwijs.vlaanderen/",
    };

    const metadata = formatSearchResultMetadata(result);
    expect(metadata).toContain("Geschiedenis");
    expect(metadata).toContain("Tijdlijnen");
    expect(metadata).toContain("3e leerjaar");
    expect(metadata).toContain("ZILL");
  });

  it("laat ALL-netwerk weg in metadata", () => {
    const result: CurriculumSearchResult = {
      code: "",
      discipline: "Wiskunde",
      subdomein: "",
      titel: "Test",
      toelichting: "",
      leerjaarRoute: "",
      gelinktMinimumdoel: null,
      netwerk: "ALL",
      bronUrl: "",
    };

    expect(formatSearchResultMetadata(result)).toBe("Wiskunde");
  });
});
