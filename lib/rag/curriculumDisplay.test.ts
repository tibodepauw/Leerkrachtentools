import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  formatGoalCopyText,
  formatGoalTitleParts,
  formatMinimumGoalCopyText,
  formatSearchResultMetadata,
  networkBadgeLabel,
  repairUtf8Mojibake,
  splitGoalCodeAndTitle,
} from "@/lib/rag/curriculumDisplay";
import type { CurriculumSearchResult } from "@/types";

describe("curriculumDisplay", () => {
  it("decodeert HTML-entiteiten", () => {
    expect(decodeHtmlEntities("De leerlingen &lt;20&gt; optellen")).toBe(
      "De leerlingen <20> optellen",
    );
  });

  it("herstelt dubbel gecodeerde UTF-8 tekens", () => {
    expect(repairUtf8Mojibake("ideeÃ«n")).toBe("ideeën");
    expect(repairUtf8Mojibake("creÃ«ren")).toBe("creëren");
    expect(repairUtf8Mojibake("Ã©")).toBe("é");
    expect(repairUtf8Mojibake("\u00C3\u00A0")).toBe("à");
    expect(repairUtf8Mojibake("\u00E2\u0080\u00A6")).toBe("…");
    expect(
      repairUtf8Mojibake(
        "Afbeeldingen of fotoâs bewerken om eigen ideeÃ«n creatief vorm te geven.",
      ),
    ).toBe(
      "Afbeeldingen of foto’s bewerken om eigen ideeën creatief vorm te geven.",
    );
  });

  it("splitst code en titel wanneer ze aan elkaar geplakt zitten", () => {
    expect(
      splitGoalCodeAndTitle("", "3.6.GL6.14De leerlingen kunnen ..."),
    ).toEqual({
      code: "3.6.GL6.14",
      titel: "De leerlingen kunnen ...",
    });
    expect(
      splitGoalCodeAndTitle("", "FR.034Vertalen beluisterde zinnen ..."),
    ).toEqual({
      code: "FR.034",
      titel: "Vertalen beluisterde zinnen ...",
    });
  });

  it("verwijdert dubbele code uit titel wanneer codeveld al gevuld is", () => {
    expect(
      formatGoalTitleParts({
        code: "NL.001",
        titel: "NL.001 Herkennen eenvoudige eindrijm.",
      }),
    ).toEqual({
      code: "NL.001",
      titel: "Herkennen eenvoudige eindrijm.",
    });
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
