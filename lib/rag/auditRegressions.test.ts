import { afterEach, expect, it, vi } from "vitest";
import type { CurriculumSearchResult } from "@/types";
import { isValidRagBody } from "./requestValidation";
import { groundProPicks, buildProCurriculumPrompt, parseProLessonContext } from "./selectProCurriculumGoals";
import { buildRagQueryCacheKey } from "./clientQueryCache";
import { resetCorpusLevelCache, createCorpusDerivedCache } from "./corpusLevelCache";
import { findCorpusRecordByCode, warmCorpusTokenIndex } from "./curriculumCorpus";
import { warmMinimumGoalTokenIndex } from "./minimumGoalCandidates";
import { readFileSync } from "node:fs";

vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync) };
});
afterEach(() => { resetCorpusLevelCache(); vi.useRealTimers(); vi.clearAllMocks(); });
it.each([null, [], { goal: {} }, { goal: 1 }, { goal: "doel", grade: ["l1"] }, { goal: "doel", educationLevel: "invalid" }, { goal: "doel", network: "invalid" }, { goal: "doel", phases: [null] }])("rejects malformed search input before string access: %j", (body) => {
  expect(isValidRagBody(body)).toBe(false);
});
it("accepts a normal Pro search with lesson context", () => {
  expect(isValidRagBody({ goal: "Tellen", grade: "l1", educationLevel: "LAGER", searchMode: "pro", phases: [{ name: "Instap", text: "Samen tellen" }] })).toBe(true);
});
const first: CurriculumSearchResult = { code: "C1", titel: "Eerste leerplandoel", discipline: "Taal", subdomein: "", toelichting: "", leerjaarRoute: "", netwerk: "ZILL", bronUrl: "https://example.test/1", gelinktMinimumdoel: { code: "M1", tekst: "Gemeenschappelijk minimumdoel", type: "" } };
const second: CurriculumSearchResult = { ...first, titel: "Tweede leerplandoel", netwerk: "OVSG" };
it("grounds by candidate number even when codes and linked minimum goals collide", () => {
  expect(groundProPicks([first, second], [{ nr: 2, code: "C1", why: "Tweede past", lessonPhase: "Instap" }])[0]?.netwerk).toBe("OVSG");
  expect(groundProPicks([first, second], [{ code: "M1", why: "Ambigu" }])).toEqual([]);
  expect(groundProPicks([first, second], [{ nr: 999, code: "C1", why: "Ongeldig" }])).toEqual([]);
});
it("puts the actual curriculum code and text in a curriculum prompt", () => {
  const prompt = buildProCurriculumPrompt({ query: "Taal", retrieved: [first], lesson: parseProLessonContext({}), kind: "leerplandoel" });
  expect(prompt).toContain('"code": "C1"');
  expect(prompt).toContain("Eerste leerplandoel");
  expect(prompt).not.toContain("Gemeenschappelijk minimumdoel");
});
it("invalidates Pro cache keys when context changes and leaves quick searches independent of it", () => {
  const key = (searchMode: string, lessonContext: unknown) => buildRagQueryCacheKey("LAGER", "ZILL", "Tellen", { searchMode, lessonContext });
  const context = { topic: "Fruit", learningArea: "Wiskunde", phases: [{ name: "Instap", text: "Twee appels" }] };
  expect(key("pro", context)).toBe(key("pro", structuredClone(context)));
  for (const changed of [{ ...context, topic: "Dieren" }, { ...context, learningArea: "Taal" }, { ...context, phases: [] }]) expect(key("pro", changed)).not.toBe(key("pro", context));
  expect(key("snel", context)).toBe(key("snel", {}));
});
it("keeps ALL indexes independent of raw-level eviction and code lookups reuse them", () => {
  warmCorpusTokenIndex("ALL", "ALL");
  const reads = vi.mocked(readFileSync);
  reads.mockClear();
  warmCorpusTokenIndex("ALL", "ALL");
  findCorpusRecordByCode("not-a-real-code", "ALL", "ALL");
  expect(reads).not.toHaveBeenCalled();
  warmMinimumGoalTokenIndex("ALL");
  reads.mockClear();
  warmMinimumGoalTokenIndex("ALL");
  expect(reads).not.toHaveBeenCalled();
});

it("expires derived indexes on inactivity, refreshes on hits and bounds their LRU", () => {
  vi.useFakeTimers();
  const cache = createCorpusDerivedCache<number>({ maxEntries: 1, ttlMs: 1000 });
  const build = vi.fn(() => 42);
  expect(cache.get("a", ["BASISONDERWIJS"], build)).toBe(42);
  vi.advanceTimersByTime(600);
  cache.get("a", ["BASISONDERWIJS"], build);
  vi.advanceTimersByTime(600);
  cache.get("a", ["BASISONDERWIJS"], build);
  expect(build).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1001);
  cache.get("a", ["BASISONDERWIJS"], build);
  expect(build).toHaveBeenCalledTimes(2);
  cache.get("b", ["OKAN"], build);
  expect(cache.keys()).toEqual(["b"]);
  resetCorpusLevelCache();
  expect(cache.keys()).toEqual([]);
});
