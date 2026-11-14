import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/terms";
import { POST as requestCode } from "@/app/api/auth/request-code/route";
import { POST as verifyCode } from "@/app/api/auth/verify-code/route";

const existing = "bestaand@student.thomasmore.be";
const newcomer = "nieuw@student.thomasmore.be";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  vi.stubEnv("BREVO_API_KEY", "synthetic-mail-budget-test");
  vi.stubEnv("BREVO_FROM_EMAIL", "Audit <audit@example.test>");
  vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", "5");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  getDatabase().prepare("INSERT INTO users(id,email,email_verified_at,created_at,updated_at) VALUES ('privacy-budget',?,1,1,1)").run(existing);
});
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  for (const table of ["sessions", "terms_acceptances", "users", "login_codes", "request_rate_events", "external_daily_usage"]) {
    getDatabase().prepare(`DELETE FROM ${table}`).run();
  }
});
async function request(email: string) {
  const pending = requestCode(new Request("http://localhost/api/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ email, privacyAccepted: true, termsVersion: CURRENT_TERMS_VERSION }),
  }));
  const handled = pending.then((response) => response);
  await vi.runAllTimersAsync();
  const response = await handled;
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")!.split(";")[0] };
}
function useBudget(total: number) {
  const insert = getDatabase().prepare("INSERT INTO external_daily_usage(service,day,consumed) VALUES (?,'2026-11-11',?)");
  insert.run("email", total); insert.run("email-general", 4);
}
async function wrong(email: string, cookie: string) {
  const response = await verifyCode(new Request("http://localhost/api/auth/verify-code", {
    method: "POST", headers: { cookie }, body: JSON.stringify({ email, code: "000000" }),
  }));
  return { status: response.status, body: await response.json() };
}
it("conceals account existence in requests and guesses after only general mail is exhausted", async () => {
  useBudget(4);
  const a = await request(newcomer), b = await request(existing);
  expect(a.status).toBe(200); expect(b.status).toBe(200);
  expect(a.body).toEqual({ email: newcomer, expiresInSeconds: 600 });
  expect(b.body).toEqual({ ...a.body, email: existing });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).to).toEqual([{ email: existing }]);
  for (let attempt = 0; attempt < 6; attempt++) {
    expect(await wrong(newcomer, a.cookie)).toEqual(await wrong(existing, b.cookie));
  }
  expect(getDatabase().prepare("SELECT COUNT(*) AS n FROM users").get()).toEqual({ n: 1 });
  expect(getDatabase().prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
});
it("keeps both account classes indistinguishable when the entire mail budget is exhausted", async () => {
  useBudget(5);
  const a = await request(newcomer), b = await request(existing);
  expect(a.status).toBe(b.status); expect(a.status).toBe(200);
  expect(a.body.expiresInSeconds).toBe(b.body.expiresInSeconds);
  expect(await wrong(newcomer, a.cookie)).toEqual(await wrong(existing, b.cookie));
  expect(fetch).not.toHaveBeenCalled();
});
