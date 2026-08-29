import { describe, expect, it } from "vitest";
import {
  collectMinimumGoalCandidates,
  mergeMinimumGoalCandidatePools,
  normalizeMinimumGoalCandidate,
} from "@/lib/rag/minimumGoalCandidates";
import { rankMinimumGoalResults } from "@/lib/rag/minimumGoalRanking";

describe("minimumGoalCandidates", () => {
  it("normaliseert OVSG-records als zelfstandige minimumdoelen", () => {
    const record = normalizeMinimumGoalCandidate({
      code: "WISget7B.19",
      leergebied: "Wiskunde",
      fase: "Fase 2",
      titel:
        "Doelmatig uit het hoofd natuurlijke getallen optellen met een som kleiner of gelijk aan 20.",
      netwerk: "OVSG",
    });

    expect(record?.gelinktMinimumdoel?.code).toBe("WISget7B.19");
    expect(record?.gelinktMinimumdoel?.tekst).toContain("optellen");
    expect(record?.titel).toBe("");
  });

  it("haalt brede kandidaten op voor optellen tot 20", () => {
    const candidates = collectMinimumGoalCandidates({
      query: "optellen tot 20",
      limit: 50,
    });

    expect(candidates.length).toBeGreaterThanOrEqual(10);

    const ranked = rankMinimumGoalResults("optellen tot 20", candidates, 3);
    expect(ranked.length).toBeGreaterThanOrEqual(3);

    const topText = ranked
      .map((item) => item.gelinktMinimumdoel?.tekst ?? "")
      .join(" ")
      .toLowerCase();

    expect(topText).toMatch(/20/);
    expect(topText).not.toMatch(/10 000|10000/);
  });

  it("combineert meerdere pools zonder duplicaten op code", () => {
    const merged = mergeMinimumGoalCandidatePools([
      collectMinimumGoalCandidates({ query: "optellen tot 20", limit: 20 }),
      collectMinimumGoalCandidates({ query: "optellen tot 20", limit: 20 }),
    ]);

    const codes = merged.map((item) => item.gelinktMinimumdoel?.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
