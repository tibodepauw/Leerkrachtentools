import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as postCurriculum } from "@/app/api/rag-curriculum/route";
import { POST as postMinimumGoals } from "@/app/api/rag-minimum-goals/route";
import {
  evaluateBenchmarkCase,
  RAG_BENCHMARK_CASES,
  summarizeBenchmarkReport,
  warmBenchmarkCase,
  warmRagBenchmarkCorpus,
  type RagBenchmarkApiResponse,
  type RagBenchmarkCase,
  type RagBenchmarkCaseResult,
} from "@/lib/rag/ragBenchmark";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({
    id: "benchmark-user",
    email: "benchmark@test.local",
    displayName: "Benchmark",
    tier: "admin",
    marketingOptIn: false,
    profileImageUrl: null,
    expiresAt: Date.now() + 60_000,
  }),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
}));

vi.mock("@/lib/ai/serverAccess", () => ({
  approvedTierResponse: () => null,
}));

vi.mock("@/lib/rag/discoveryEngine", () => ({
  searchDiscoveryEngine: async () => ({ hits: [] }),
}));

async function callBenchmarkApi(
  testCase: RagBenchmarkCase,
): Promise<RagBenchmarkApiResponse> {
  const handler =
    testCase.endpoint === "minimum-goals" ? postMinimumGoals : postCurriculum;

  const payload =
    testCase.endpoint === "minimum-goals"
      ? {
          goal: testCase.query,
          educationLevel: testCase.educationLevel ?? "BASISONDERWIJS",
          domainDetail: testCase.domainDetail ?? "all",
          domainFinality: testCase.domainFinality ?? "all",
          secondaryGrade: "all",
          secondaryFinality: "all",
        }
      : {
          goal: testCase.query,
          network: testCase.network ?? "ALL",
          educationLevel: testCase.educationLevel ?? "BASISONDERWIJS",
          domainDetail: testCase.domainDetail ?? "all",
          domainFinality: testCase.domainFinality ?? "all",
          secondaryGrade: "all",
          secondaryFinality: "all",
        };

  const started = performance.now();
  const response = await handler(
    new Request("http://benchmark.local/api/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  const durationMs = performance.now() - started;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    status: response.status,
    durationMs,
    body,
  };
}

describe("RAG benchmark suite", () => {
  beforeAll(async () => {
    warmRagBenchmarkCorpus();
    await callBenchmarkApi({
      id: "warmup-curriculum",
      label: "warmup",
      endpoint: "curriculum",
      query: "optellen tot 20",
      educationLevel: "LAGER",
      network: "OPSTAP",
    });
    await callBenchmarkApi({
      id: "warmup-minimum",
      label: "warmup",
      endpoint: "minimum-goals",
      query: "optellen tot 20",
      educationLevel: "LAGER",
    });
  }, 60_000);

  it("evalueert 10 randgevallen en rapporteert kwaliteitsscore", async () => {
    const caseResults: RagBenchmarkCaseResult[] = [];

    for (const benchmarkCase of RAG_BENCHMARK_CASES) {
      if (benchmarkCase.skipIf?.()) {
        caseResults.push({
          id: benchmarkCase.id,
          label: benchmarkCase.label,
          passed: true,
          skipped: true,
          skipReason: benchmarkCase.skipReason ?? "corpus niet beschikbaar",
          durationMs: 0,
          statusOk: true,
          latencyOk: true,
          faithfulnessOk: true,
          relevancyOk: true,
          expectEmptyOk: true,
          topResults: [],
          failures: [],
        });
        continue;
      }

      warmBenchmarkCase(benchmarkCase);
      const apiResponse = await callBenchmarkApi(benchmarkCase);
      caseResults.push(evaluateBenchmarkCase(benchmarkCase, apiResponse));
    }

    const report = summarizeBenchmarkReport(caseResults);
    const lines = report.results.map((result) => {
      if (result.skipped) {
        return `- SKIP ${result.label}`;
      }
      const status = result.passed ? "PASS" : "FAIL";
      const detail = result.passed ? "" : ` (${result.failures.join("; ")})`;
      return `- ${status} ${result.label} · ${result.durationMs.toFixed(0)} ms${detail}`;
    });

    console.info(
      [
        "",
        "=== RAG Benchmark Report ===",
        `Kwaliteitsscore: ${report.qualityScore}% (${report.passed}/${report.total - report.skipped} geslaagd, ${report.skipped} overgeslagen)`,
        ...lines,
        "==============================",
        "",
      ].join("\n"),
    );

    expect(report.total).toBe(10);
    expect(report.qualityScore).toBe(100);
  }, 60_000);
});

describe("RAG benchmark helpers", () => {
  it("rapporteert kwaliteitsscore op basis van case-resultaten", () => {
    const report = summarizeBenchmarkReport([
      {
        id: "a",
        label: "A",
        passed: true,
        skipped: false,
        durationMs: 120,
        statusOk: true,
        latencyOk: true,
        faithfulnessOk: true,
        relevancyOk: true,
        expectEmptyOk: true,
        topResults: [],
        failures: [],
      },
      {
        id: "b",
        label: "B",
        passed: false,
        skipped: false,
        durationMs: 900,
        statusOk: true,
        latencyOk: false,
        faithfulnessOk: true,
        relevancyOk: true,
        expectEmptyOk: true,
        topResults: [],
        failures: ["te traag"],
      },
    ]);

    expect(report.qualityScore).toBe(50);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
  });
});
