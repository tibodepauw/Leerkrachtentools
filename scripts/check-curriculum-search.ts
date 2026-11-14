import { performance } from "node:perf_hooks";
import { searchLocalCorpus } from "../lib/rag/curriculumCorpus";
import { collectMinimumGoalCandidates } from "../lib/rag/minimumGoalCandidates";
import type { EducationLevelFilter } from "../types";

// Local acceptance probes only. No provider, mail, discovery or browser calls.
const probes: Array<{ level: EducationLevelFilter; query: string }> = [
  { level: "KLEUTER", query: "tellen vergelijken hoeveelheden" },
  { level: "LAGER", query: "getallen optellen aftrekken" },
  { level: "SECUNDAIR", query: "klimaat broeikaseffect" },
  { level: "OKAN", query: "Nederlands begrijpen informatie" },
  { level: "BUBAO", query: "getallen tellen vergelijken" },
  { level: "BUSO", query: "veilig werken" },
  { level: "DKO", query: "muziek ritme" },
  { level: "VOLWASSENEN", query: "Nederlands informatie" },
  { level: "HOGER", query: "onderzoek kennis" },
];
for (const { level, query } of probes) {
  const started = performance.now();
  const first = collectMinimumGoalCandidates({ query, educationLevel: level, limit: 5 });
  const firstMs = performance.now() - started;
  const warmStarted = performance.now();
  const again = collectMinimumGoalCandidates({ query, educationLevel: level, limit: 5 });
  console.log(JSON.stringify({ level, results: first.length, firstMs: Math.round(firstMs),
    warmMs: Math.round(performance.now() - warmStarted), stable: JSON.stringify(first) === JSON.stringify(again),
    codes: first.map(row => row.gelinktMinimumdoel?.code) }));
  if (!first.length || JSON.stringify(first) !== JSON.stringify(again)) process.exitCode = 1;
}
const started = performance.now();
const goals = searchLocalCorpus({ query: "getallen optellen aftrekken", network: "GO_NIEUW", educationLevel: "LAGER" });
console.log(JSON.stringify({ network: "GO_NIEUW", results: goals.length,
  firstMs: Math.round(performance.now() - started), codes: goals.map(row => row.code) }));
if (!goals.length) process.exitCode = 1;
for (const level of ["BASISONDERWIJS", "KLEUTER", "LAGER"] as const) {
  const started = performance.now();
  const results = searchLocalCorpus({ query: "getallen tellen vergelijken", network: "OVSG", educationLevel: level });
  console.log(JSON.stringify({ network: "OVSG", level, results: results.length,
    firstMs: Math.round(performance.now() - started),
    codes: results.map(row => row.code), routes: results.map(row => row.leerjaarRoute) }));
  if (!results.length || results.some(row => !row.leerjaarRoute.includes("2027-2028"))) process.exitCode = 1;
}
const secondaryOvsg = searchLocalCorpus({ query: "getallen vergelijken breuken", network: "OVSG", educationLevel: "SECUNDAIR" });
console.log(JSON.stringify({ network: "OVSG", level: "SECUNDAIR", results: secondaryOvsg.length,
  codes: secondaryOvsg.map(row => row.code), routes: secondaryOvsg.map(row => row.leerjaarRoute) }));
if (!secondaryOvsg.length || secondaryOvsg.some(row => !row.bronUrl.includes("/so/leerplannen/"))) process.exitCode = 1;
console.log(JSON.stringify({ memoryMiB: Object.fromEntries(Object.entries(process.memoryUsage()).map(([key, value]) => [key, Math.round(value / 1048576)])) }));
