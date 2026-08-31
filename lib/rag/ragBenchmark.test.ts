import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCorpusFaithfulnessIndex,
  isFaithfulResult,
  matchesAllPatternGroups,
  matchesDisciplinePatterns,
  summarizeBenchmarkReport,
} from "@/lib/rag/ragBenchmark";
import type { CurriculumSearchResult } from "@/types";

const hasFullCorpus = existsSync(
  path.join(process.cwd(), "data", "secundair", "leerplannen_secundair.jsonl"),
);
const codeThreshold = hasFullCorpus ? 100 : 50;

describe("ragBenchmark", () => {
  it("indexeert corpus-codes voor faithfulness checks", () => {
    const index = buildCorpusFaithfulnessIndex();
    expect(index.codes.size).toBeGreaterThan(codeThreshold);
    expect(index.titels.size).toBeGreaterThan(codeThreshold);
  });

  it("weigert fragment-resultaten in faithfulness check", () => {
    const index = buildCorpusFaithfulnessIndex();
    const fragment: CurriculumSearchResult = {
      code: "FAKE.999",
      discipline: "Test",
      subdomein: "",
      titel: "Verzonnen fragment",
      toelichting: "",
      leerjaarRoute: "",
      gelinktMinimumdoel: null,
      netwerk: "OPSTAP",
      bronUrl: "",
      verrijking: "fragment",
    };

    expect(isFaithfulResult(fragment, index)).toBe(false);
  });

  it("herkent multi-intent pattern groups", () => {
    const results: CurriculumSearchResult[] = [
      {
        code: "FR.1",
        discipline: "Frans",
        subdomein: "",
        titel: "Franse liedjes",
        toelichting: "",
        leerjaarRoute: "",
        gelinktMinimumdoel: null,
        netwerk: "OPSTAP",
        bronUrl: "",
      },
      {
        code: "MU.1",
        discipline: "Muzische vorming",
        subdomein: "",
        titel: "Dansen op muziek",
        toelichting: "",
        leerjaarRoute: "",
        gelinktMinimumdoel: null,
        netwerk: "OPSTAP",
        bronUrl: "",
      },
    ];

    expect(
      matchesAllPatternGroups(results, [[/frans/i], [/muzisch|dans|muziek/i]]),
    ).toBe(true);
    expect(matchesDisciplinePatterns(results, [/wiskunde/i])).toBe(false);
  });
});
