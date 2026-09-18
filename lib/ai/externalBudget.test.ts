import { afterEach, expect, it, vi } from "vitest";
import { reserveExternalCall } from "./externalBudget";
import { closeDatabase, getDatabase } from "@/lib/db/sqlite";

afterEach(() => vi.unstubAllEnvs());
const day = Date.UTC(2030, 0, 1);

it("bounds calls across consumers and database reopen, resetting at the next UTC day", () => {
  vi.stubEnv("SERVER_AI_DAILY_CALL_LIMIT", "2");
  expect(reserveExternalCall("server-ai", day)).toBe(true);
  closeDatabase();
  expect(reserveExternalCall("server-ai", day + 1)).toBe(true);
  expect(reserveExternalCall("server-ai", day + 2)).toBe(false);
  expect(reserveExternalCall("server-ai", day + 86_400_000)).toBe(true);
});

it("keeps independent service counters and prunes old records without recording private data", () => {
  vi.stubEnv("DISCOVERY_DAILY_CALL_LIMIT", "1");
  expect(reserveExternalCall("discovery", day)).toBe(true);
  expect(reserveExternalCall("discovery", day)).toBe(false);
  expect(reserveExternalCall("discovery", day + 8 * 86_400_000)).toBe(true);
  const rows = getDatabase().prepare("SELECT * FROM external_daily_usage WHERE service = 'discovery'").all();
  expect(rows).toEqual([{ service: "discovery", day: "2030-01-09", consumed: 1 }]);
});

it.each(["0", "-1", "NaN", "1.5", "Infinity", "", "9007199254740992"])("fails closed for disabled/invalid budget %s", (value) => {
  vi.stubEnv("SERVER_AI_DAILY_CALL_LIMIT", value);
  expect(reserveExternalCall("server-ai", day)).toBe(false);
});
