import { describe, expect, it } from "vitest";
import {
  collectMinimumGoalCandidates,
  mergeMinimumGoalCandidatePools,
  normalizeMinimumGoalCandidate,
} from "@/lib/rag/minimumGoalCandidates";
import { rankMinimumGoalResults } from "@/lib/rag/minimumGoalRanking";

describe("minimumGoalCandidates", () => {
  it("slaat interne OVSG-codes over", () => {
    expect(
      normalizeMinimumGoalCandidate({
        code: "WISget7B.19",
        leergebied: "Wiskunde",
        fase: "Fase 2",
        titel:
          "Doelmatig uit het hoofd natuurlijke getallen optellen met een som kleiner of gelijk aan 20.",
        netwerk: "OVSG",
      }),
    ).toBeNull();
  });

  it("normaliseert OPSTAP-records naar AHOVOKS-weergave", () => {
    const record = normalizeMinimumGoalCandidate({
      code: "2.2.GL1.16",
      discipline: "Wiskunde",
      titel: "Leerplandoel",
      leerjaar_route: "1ste leerjaar (G)",
      gelinkt_minimumdoel: {
        code: "4-2.2.16",
        tekst: "De leerlingen kennen paraat de optellingen tot en met 20.",
        type: "",
      },
      netwerk: "OPSTAP",
    });

    expect(record?.gelinktMinimumdoel?.code).toBe("2.2.16");
    expect(record?.gelinktMinimumdoel?.rawCode).toBe("4-2.2.16");
    expect(record?.leerjaarRoute).toBe("4de leerjaar");
  });

  it("haalt brede kandidaten op voor optellen tot 20", () => {
    const candidates = collectMinimumGoalCandidates({
      query: "optellen tot 20",
      limit: 50,
    });

    expect(candidates.length).toBeGreaterThanOrEqual(7);
    expect(candidates.every((item) => item.gelinktMinimumdoel?.rawCode)).toBe(
      true,
    );

    const ranked = rankMinimumGoalResults("optellen tot 20", candidates, 3);
    expect(ranked.length).toBeGreaterThanOrEqual(3);

    const topCodes = ranked.map((item) => item.gelinktMinimumdoel?.code);
    expect(topCodes[0]).toBe("2.2.16");
    expect(topCodes.every((code) => code && !code.startsWith("WIS"))).toBe(true);
  });

  it("combineert meerdere pools zonder duplicaten op code", () => {
    const merged = mergeMinimumGoalCandidatePools([
      collectMinimumGoalCandidates({ query: "optellen tot 20", limit: 20 }),
      collectMinimumGoalCandidates({ query: "optellen tot 20", limit: 20 }),
    ]);

    const codes = merged.map((item) => item.gelinktMinimumdoel?.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("normaliseert secundaire minimumdoelen zonder basisschoolcode", () => {
    const record = normalizeMinimumGoalCandidate({
      onderwijsniveau: "secundair onderwijs",
      graad: "1ste graad",
      discipline: "Wiskunde",
      gelinkt_minimumdoel: {
        code: "06.12",
        tekst: "De leerlingen analyseren een wiskundig probleem.",
        type: "eindterm",
      },
      netwerk: "VLAANDEREN",
    });

    expect(record?.gelinktMinimumdoel?.code).toBe("06.12");
    expect(record?.leerjaarRoute).toBe("1ste graad");
    expect(record?.netwerk).toBe("VLAANDEREN");
  });
});
