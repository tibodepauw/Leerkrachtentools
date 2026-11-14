import { describe, expect, it } from "vitest";
import {
  recordMatchesEducationLevel,
  resultMatchesEducationLevel,
} from "@/lib/rag/educationLevel";
import type { CurriculumSearchResult } from "@/types";

describe("educationLevel", () => {
  it("herkent expliciet basisonderwijs en gebruikt een bekende leeftijd vóór de faseheuristiek", () => {
    const raw = { onderwijsniveau: "Basisonderwijs", fase: "Fase 2", leeftijd: "6" };
    expect(recordMatchesEducationLevel(raw, "BASISONDERWIJS")).toBe(true);
    expect(recordMatchesEducationLevel(raw, "LAGER")).toBe(true);
    expect(recordMatchesEducationLevel(raw, "KLEUTER")).toBe(false);
    expect(recordMatchesEducationLevel({ ...raw, leeftijd: "2,5" }, "KLEUTER")).toBe(true);
  });
  it("herkent kleuter- en lagerbereiken in leeftijdsdata", () => {
    const sharedGoal = {
      leerlijn: [{ leeftijd: "2.5-12j" }],
    };

    expect(recordMatchesEducationLevel(sharedGoal, "KLEUTER")).toBe(true);
    expect(recordMatchesEducationLevel(sharedGoal, "LAGER")).toBe(true);
    expect(recordMatchesEducationLevel(sharedGoal, "SECUNDAIR")).toBe(false);
  });

  it("herkent leerjaar- en fasegegevens", () => {
    expect(
      recordMatchesEducationLevel(
        { leerjaar_route: "3de leerjaar (G)" },
        "LAGER",
      ),
    ).toBe(true);
    expect(
      recordMatchesEducationLevel({ fase: "Fase 1" }, "KLEUTER"),
    ).toBe(true);
    expect(
      recordMatchesEducationLevel({ fase: "Fase 4" }, "LAGER"),
    ).toBe(true);
  });

  it("filtert minimumdoelen op AHOVOKS-ijkpunt", () => {
    const result = (code: string): CurriculumSearchResult => ({
      code: "",
      discipline: "Wiskunde",
      subdomein: "",
      titel: "",
      toelichting: "",
      leerjaarRoute: "",
      gelinktMinimumdoel: { code, rawCode: code, tekst: "Doel", type: "" },
      netwerk: "OPSTAP",
      bronUrl: "",
    });

    expect(resultMatchesEducationLevel(result("K-1.1"), "KLEUTER")).toBe(true);
    expect(resultMatchesEducationLevel(result("K-1.1"), "LAGER")).toBe(false);
    expect(resultMatchesEducationLevel(result("4-1.1"), "LAGER")).toBe(true);
    expect(resultMatchesEducationLevel(result("6-1.1"), "KLEUTER")).toBe(false);
    expect(resultMatchesEducationLevel(result("6-1.1"), "SECUNDAIR")).toBe(
      false,
    );
  });

  it("laat onbekende niveaus alleen toe bij Alle onderwijsniveaus", () => {
    expect(recordMatchesEducationLevel({ titel: "Doel" }, "ALL")).toBe(true);
    expect(recordMatchesEducationLevel({ titel: "Doel" }, "LAGER")).toBe(false);
  });

  it("herkent secundaire graad- en finaliteitsmetadata", () => {
    expect(
      recordMatchesEducationLevel(
        {
          onderwijsniveau: "SECUNDAIR",
          graad: "2de graad",
          finaliteit: "Doorstroom",
        },
        "SECUNDAIR",
      ),
    ).toBe(true);
  });
});
