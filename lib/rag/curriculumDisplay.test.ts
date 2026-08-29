import { describe, expect, it } from "vitest";
import { formatSearchResultMetadata } from "@/lib/rag/curriculumDisplay";
import type { CurriculumSearchResult } from "@/types";

describe("curriculumDisplay", () => {
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
