import { describe, expect, it } from "vitest";
import {
  enforceThomasMoreDialogue,
  isStrictThomasMoreDialogue,
} from "@/lib/ai/dialogue";
import { searchCurriculum } from "@/lib/rag/vectorSearch";
import { parseMinutes } from "@/lib/timing";

describe("deterministische timing", () => {
  it("herkent min, minuten en m", () => {
    expect(
      parseMinutes(
        "Instap 5 min\nInstructie 15 minuten\nVerwerking 25 m\nAfronding 5 MIN",
      ),
    ).toEqual([5, 15, 25, 5]);
  });

  it("negeert getallen zonder tijdseenheid", () => {
    expect(parseMinutes("Fase 1 met 12 leerlingen en 10 min")).toEqual([10]);
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

describe("lokale curriculum RAG", () => {
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
