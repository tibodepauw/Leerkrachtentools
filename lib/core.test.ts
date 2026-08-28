import { describe, expect, it } from "vitest";
import {
  enforceThomasMoreDialogue,
  isStrictThomasMoreDialogue,
} from "@/lib/ai/dialogue";
import { searchCurriculum } from "@/lib/rag/vectorSearch";
import { parsePhaseMinutes, sumPhaseMinutes } from "@/lib/timing";

describe("deterministische timing", () => {
  it("herkent min, minuten en m in fase-headers", () => {
    expect(
      parsePhaseMinutes(
        "Instap 5 min\nInstructie 15 minuten\nVerwerking 25 m\nAfronding 5 MIN",
      ),
    ).toEqual([5, 15, 25, 5]);
  });

  it("negeert minuten in losse zinnen binnen een fase", () => {
    expect(
      parsePhaseMinutes(
        "Instap — 5 min\nLeerlingen krijgen 10 min om te tekenen.\nInstructie — 15 min",
      ),
    ).toEqual([5, 15]);
  });

  it("berekent de som en afwijking t.o.v. totale lestijd", () => {
    const content =
      "Instap — 5 min\nInstructie — 15 min\nVerwerking — 25 min\nAfronding — 5 min";
    expect(sumPhaseMinutes(content)).toBe(50);
    expect(sumPhaseMinutes(content) - 45).toBe(5);
  });
});

describe("Thomas More dialoog", () => {
  it("normaliseert alle regels naar strikte conventies", () => {
    const output = enforceThomasMoreDialogue(
      'Lk: "Wat zie je?"\nLln: een tijdlijn\n[Bordschema: tijdlijn]',
    );
    expect(output).toBe(
      "Lk: “Wat zie je?”\nLln: “een tijdlijn”\n*[Bordschema: tijdlijn]*",
    );
    expect(isStrictThomasMoreDialogue(output)).toBe(true);
  });
});

describe("lokale leerplandoelenindex", () => {
  it("vindt het tijdlijndoel in minimumdoelen en ZILL", () => {
    const query = "De leerlingen situeren de Romeinen op een tijdlijn";
    const minimum = searchCurriculum({
      query,
      schoolYear: "2025-2026",
      source: "minimumdoel",
    });
    const zill = searchCurriculum({
      query,
      schoolYear: "2025-2026",
      source: "leerplandoel",
      network: "ZILL",
    });
    expect(minimum[0].goal.code).toBe("MM 3.8");
    expect(zill[0].goal.code).toBe("OWti3");
    expect(zill[0].score).toBeGreaterThan(0.4);
  });

  it("houdt toekomstplannen uit actieve resultaten", () => {
    const results = searchCurriculum({
      query: "nieuw kennisrijk leerplan",
      schoolYear: "2025-2026",
      source: "leerplandoel",
      network: "GO",
    });
    expect(results.some((item) => item.goal.status === "future")).toBe(false);
  });
});
