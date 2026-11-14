import { afterEach, expect, it, vi } from "vitest";
import { emailAccountLoginReserve, reserveDiscoveryCall, reserveEmailSend, reserveExternalCall } from "./externalBudget";
import { closeDatabase, getDatabase } from "@/lib/db/sqlite";

afterEach(() => vi.unstubAllEnvs());
const day = Date.UTC(2030, 0, 1);
const subjectA = "a".repeat(64);
const subjectB = "b".repeat(64);

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
  expect(reserveDiscoveryCall(subjectA, day)).toBe(true);
  expect(reserveDiscoveryCall(subjectA, day)).toBe(false);
  expect(reserveDiscoveryCall(subjectA, day + 8 * 86_400_000)).toBe(true);
  const rows = getDatabase().prepare("SELECT * FROM external_daily_usage WHERE service LIKE 'discovery%' ORDER BY service").all();
  expect(rows).toEqual([
    { service: "discovery", day: "2030-01-09", consumed: 1 },
    { service: `discovery-subject:${subjectA}`, day: "2030-01-09", consumed: 1 },
  ]);
});

const mailDay = Date.UTC(2030, 1, 1);
function mailUsage(time: number) {
  const rows = getDatabase().prepare("SELECT service, consumed FROM external_daily_usage WHERE service LIKE 'email%' AND day = ?")
    .all(new Date(time).toISOString().slice(0, 10)) as Array<{ service: string; consumed: number }>;
  return Object.fromEntries(rows.map(row => [row.service, row.consumed]));
}

it("keeps a share of the mail budget that general mail cannot consume", () => {
  vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", "10");
  const general = Array.from({ length: 12 }, () => reserveEmailSend("general", mailDay));
  expect(general.filter(Boolean)).toHaveLength(8);
  expect(reserveEmailSend("account-login", mailDay)).toBe(true);
  expect(reserveEmailSend("account-login", mailDay)).toBe(true);
  // The global ceiling still holds: the reserve is part of the limit, not extra budget.
  expect(reserveEmailSend("account-login", mailDay)).toBe(false);
  expect(reserveEmailSend("general", mailDay)).toBe(false);
  expect(mailUsage(mailDay)).toEqual({ email: 10, "email-general": 8 });
});

it("lets account logins use the whole budget, after which general mail is refused too", () => {
  vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", "5");
  const time = mailDay + 86_400_000;
  for (let index = 0; index < 5; index++) expect(reserveEmailSend("account-login", time)).toBe(true);
  expect(reserveEmailSend("general", time)).toBe(false);
  expect(reserveEmailSend("account-login", time)).toBe(false);
  expect(mailUsage(time)).toEqual({ email: 5 });
});

it.each([[1, 1], [2, 1], [3, 1], [5, 1], [6, 2], [10, 2], [500, 100]])("reserves a bounded share for limit %i: %i", (limit, reserved) => {
  expect(emailAccountLoginReserve(limit)).toBe(reserved);
  vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", String(limit));
  const time = mailDay + (limit + 2) * 86_400_000;
  let general = 0;
  while (general <= limit && reserveEmailSend("general", time)) general++;
  expect(general).toBe(limit - reserved);
  let logins = 0;
  while (logins <= limit && reserveEmailSend("account-login", time)) logins++;
  expect(general + logins).toBe(limit);
});

it.each(["0", "-1", "NaN", "1.5", ""])("sends no mail of any class for disabled/invalid limit %s", (value) => {
  vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", value);
  expect(reserveEmailSend("account-login", mailDay)).toBe(false);
  expect(reserveEmailSend("general", mailDay)).toBe(false);
});

const discoveryDay = Date.UTC(2030, 5, 1);
it("stops one subject at the per-user ceiling while another subject can still search", () => {
  vi.stubEnv("DISCOVERY_DAILY_CALL_LIMIT", "10");
  vi.stubEnv("DISCOVERY_USER_DAILY_CALL_LIMIT", "3");
  const first = Array.from({ length: 6 }, () => reserveDiscoveryCall(subjectA, discoveryDay));
  expect(first.filter(Boolean)).toHaveLength(3);
  // Refused calls did not consume the shared budget.
  expect(getDatabase().prepare("SELECT consumed FROM external_daily_usage WHERE service = 'discovery' AND day = '2030-06-01'").get()).toEqual({ consumed: 3 });
  expect(reserveDiscoveryCall(subjectB, discoveryDay)).toBe(true);
  closeDatabase();
  expect(reserveDiscoveryCall(subjectA, discoveryDay + 1000)).toBe(false);
  expect(reserveDiscoveryCall(subjectA, discoveryDay + 86_400_000)).toBe(true);
});

it("keeps the global Discovery ceiling above all subjects together", () => {
  vi.stubEnv("DISCOVERY_DAILY_CALL_LIMIT", "2");
  vi.stubEnv("DISCOVERY_USER_DAILY_CALL_LIMIT", "50");
  const time = discoveryDay + 3 * 86_400_000;
  expect(reserveDiscoveryCall(subjectA, time)).toBe(true);
  expect(reserveDiscoveryCall(subjectA, time)).toBe(true);
  expect(reserveDiscoveryCall(subjectA, time)).toBe(false);
  expect(reserveDiscoveryCall(subjectB, time)).toBe(false);
});

it.each([undefined, null, "", "user-id", "A".repeat(64), `${"a".repeat(64)}\n`, 42, {}])("refuses Discovery without a valid subject: %j", (subject) => {
  vi.stubEnv("DISCOVERY_DAILY_CALL_LIMIT", "10");
  const time = discoveryDay + 5 * 86_400_000;
  expect(reserveDiscoveryCall(subject, time)).toBe(false);
  expect(getDatabase().prepare("SELECT COUNT(*) AS n FROM external_daily_usage WHERE day = ?").get(new Date(time).toISOString().slice(0, 10))).toEqual({ n: 0 });
});

it.each(["0", "-1", "NaN", "1.5", ""])("fails closed for disabled/invalid per-user Discovery limit %s", (value) => {
  vi.stubEnv("DISCOVERY_USER_DAILY_CALL_LIMIT", value);
  expect(reserveDiscoveryCall(subjectA, discoveryDay + 6 * 86_400_000)).toBe(false);
});

it.each(["0", "-1", "NaN", "1.5", "Infinity", "", "9007199254740992"])("fails closed for disabled/invalid budget %s", (value) => {
  vi.stubEnv("SERVER_AI_DAILY_CALL_LIMIT", value);
  expect(reserveExternalCall("server-ai", day)).toBe(false);
});
