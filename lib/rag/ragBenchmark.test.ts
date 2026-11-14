import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCorpusFaithfulnessIndex,
  evaluateBenchmarkCase,
  isFaithfulResult,
  matchesAllPatternGroups,
  matchesDisciplinePatterns,
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

 it("does not report an empty successful response as a relevant match",()=>{
   const report=evaluateBenchmarkCase({id:"expected-match",label:"known lesson",endpoint:"curriculum",query:"optellen",disciplinePatterns:[/wiskunde/i]}, {status:200,durationMs:1,body:{data:{goal:"niet gevonden",alternatives:[]}}}, {codes:new Set(),minimumCodes:new Set(),titels:new Set()});
   expect(report.passed).toBe(false);
   expect(report.failures.some(reason=>reason.includes("Geen resultaten"))).toBe(true);
 });
