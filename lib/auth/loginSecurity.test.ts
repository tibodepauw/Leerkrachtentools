import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/terms";
import { createLoginChallenge, hashLoginChallenge, LOGIN_CHALLENGE_COOKIE } from "./loginChallenge";
import { requestLoginCode, verifyLoginCode, hashRequestIp } from "./service";
import { POST as verify } from "@/app/api/auth/verify-code/route";
import { POST as requestCode } from "@/app/api/auth/request-code/route";

vi.mock("@/lib/email/brevo", () => ({ isBrevoConfigured: () => false, sendBrevoEmail: vi.fn() }));
const email = "security@student.thomasmore.be";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T12:00:00Z")); });
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllEnvs();
  const db = getDatabase();
  for (const table of ["login_codes", "sessions", "terms_acceptances", "users", "request_rate_events"]) db.prepare(`DELETE FROM ${table}`).run();
});
async function issue(challenge: string, overrides: Partial<Parameters<typeof requestLoginCode>[0]> = {}) {
  const promise = requestLoginCode({ email, challenge, ipHash: hashRequestIp("192.0.2.1"), ipTrusted: true, marketingOptIn: false, privacyAccepted: true, termsVersion: CURRENT_TERMS_VERSION, exposeDevCode: true, ...overrides });
  // Attach rejection handling before advancing the artificial delivery delay.
  const handled = promise.then((result) => ({ result }), (error: unknown) => ({ error }));
  await vi.runAllTimersAsync();
  const settled = await handled;
  if ("error" in settled) throw settled.error;
  return settled.result;
}
it("keeps codes and failed guesses isolated between browsers", async () => {
  const a = createLoginChallenge(), b = createLoginChallenge();
  const first = await issue(a);
  await issue(b);
  const row = () => getDatabase().prepare("SELECT attempts,used_at FROM login_codes WHERE challenge_hash=?").get(hashLoginChallenge(a));
  for (let i = 0; i < 5; i++) {
    await expect(verify(new Request("http://localhost/api/auth/verify-code", { method: "POST", body: JSON.stringify({ email, code: "000000" }) }))).resolves.toHaveProperty("status", 400);
  }
  expect(row()).toEqual({ attempts: 0, used_at: null });
  expect(getDatabase().prepare("SELECT count(*) n FROM request_rate_events WHERE scope LIKE 'otp-verify%'").get()).toEqual({ n: 0 });
  expect(verifyLoginCode(email, first.devCode!, a).user.email).toBe(email);
});
it("uses a challenge from the request cookie for a real successful verification", async () => {
  const challenge = createLoginChallenge(), code = await issue(challenge);
  const response = await verify(new Request("http://localhost/api/auth/verify-code", { method: "POST", headers: { cookie: `${LOGIN_CHALLENGE_COOKIE}=${challenge}` }, body: JSON.stringify({ email, code: code.devCode }) }));
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});
it("completes the request-code and verify-code routes with the issued browser cookie", async () => {
  vi.stubEnv("ALLOW_DEV_LOGIN_CODE", "true");
  const pending = requestCode(new Request("http://localhost/api/auth/request-code", { method: "POST", body: JSON.stringify({ email, privacyAccepted: true, termsVersion: CURRENT_TERMS_VERSION }) }));
  await vi.runAllTimersAsync();
  const response = await pending;
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.devCode).toMatch(/^\d{6}$/);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const verified = await verify(new Request("http://localhost/api/auth/verify-code", { method: "POST", headers: { cookie }, body: JSON.stringify({ email, code: payload.devCode }) }));
  expect(verified.status).toBe(200);
});
it("preserves existing consent across a subsequent opted-in login", async () => {
  const a = createLoginChallenge(), first = await issue(a);
  verifyLoginCode(email, first.devCode!, a);
  vi.advanceTimersByTime(61000);
  const b = createLoginChallenge(), second = await issue(b, { marketingOptIn: true });
  expect(verifyLoginCode(email, second.devCode!, b).user.marketingOptIn).toBe(false);
  expect(getDatabase().prepare("SELECT marketing_opt_in,marketing_consent_at FROM users WHERE email=?").get(email)).toEqual({ marketing_opt_in: 0, marketing_consent_at: null });
});
it("limits trusted IP requests across multiple short windows without sharing an unknown-IP bucket", async () => {
  vi.stubEnv("LOGIN_CODE_IP_DAILY_LIMIT", "2");
  await issue(createLoginChallenge(), { email: "one@student.thomasmore.be" });
  vi.advanceTimersByTime(16 * 60000);
  await issue(createLoginChallenge(), { email: "two@student.thomasmore.be" });
  vi.advanceTimersByTime(16 * 60000);
  await expect(issue(createLoginChallenge(), { email: "three@student.thomasmore.be" })).rejects.toThrow("morgen");
  await expect(issue(createLoginChallenge(), { email: "four@student.thomasmore.be", ipTrusted: false })).resolves.toHaveProperty("devCode");
});
