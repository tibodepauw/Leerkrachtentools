import { afterAll, beforeAll, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { createOrganization, generateApiKey } from "@/lib/api-keys";
import { getDatabase } from "@/lib/db/sqlite";
import { completeOrgApiCall, reserveOrgApiCall, STALE_IN_FLIGHT_MS } from "@/lib/api/orgQuota";
import { closeOrganization } from "@/lib/privacy/dataControls";
import { createHmac } from "node:crypto";
import { hashLoginChallenge } from "@/lib/auth/loginChallenge";
import { registerTermsDocument } from "@/lib/legal/acceptance";

// At most 16 short-lived processes, 64 MiB V8 heap each, 8 seconds per
// process and 30 seconds per test. No network, large files or provider keys.
const folder = mkdtempSync(path.resolve("workers/cloud-audit-"));
const entry = path.join(folder, "ledger.cjs");
beforeAll(async () => {
  getDatabase();
  await build({ stdin: { resolveDir: process.cwd(), contents: `
    import {getDatabase,closeDatabase} from './lib/db/sqlite';
    import {reserveExternalCall,reserveEmailSend} from './lib/ai/externalBudget';
    import {reserveOrgAiBudget} from './lib/ai/orgBudget';
    import {reserveOrgApiCall} from './lib/api/orgQuota';
    import {generateApiKey} from './lib/api-keys';
    import {closeOrganization} from './lib/privacy/dataControls';
    import {verifyLoginCode} from './lib/auth/service';
    const p=JSON.parse(process.argv[2]); let result;
    try {
      if(p.action==='external') result=p.service==='email'?reserveEmailSend('account-login',p.now):reserveExternalCall(p.service,p.now);
      if(p.action==='org-ai') result=reserveOrgAiBudget(p.orgId,p.now);
      if(p.action==='reserve' || p.action==='reserve-crash') result=reserveOrgApiCall(p.reserve);
      if(p.action==='issue') result={keyId:generateApiKey(p.orgId,'race',['curriculum:match']).id};
      if(p.action==='close') result=closeOrganization(getDatabase(),p.orgId,true);
      if(p.action==='verify') result={verified:!!verifyLoginCode(p.email,p.code,p.challenge)};
      if(p.action==='reserve-crash') process.stdout.write(JSON.stringify({ok:true,result}),()=>process.kill(process.pid,'SIGKILL'));
      else console.log(JSON.stringify({ok:true,result}));
    } catch(error) { console.log(JSON.stringify({ok:false,errorCode:error.code,errorName:error.name})); }
    if(p.action!=='reserve-crash') closeDatabase();
  ` }, bundle: true, platform: "node", format: "cjs", packages: "external", outfile: entry,
    plugins: [{ name: "server-only-test", setup(b) { b.onResolve({ filter: /^server-only$/ }, () => ({ path: path.resolve("test/server-only-stub.ts") })); } }],
  });
});
afterAll(() => rmSync(folder, { recursive: true, force: true }));
async function run(input: { action: string; [key: string]: unknown }) {
  const child = spawn(process.execPath, ["--max-old-space-size=64", entry, JSON.stringify(input)], {
    env: { NODE_ENV: "test", DATABASE_PATH: process.env.DATABASE_PATH!, AUTH_SECRET: process.env.AUTH_SECRET!,
      API_KEY_ENCRYPTION_SECRET: process.env.API_KEY_ENCRYPTION_SECRET!,
      SERVER_AI_DAILY_CALL_LIMIT: "3", BREVO_DAILY_EMAIL_LIMIT: "3", ORG_AI_DAILY_LIMIT: "2", ORG_AI_GLOBAL_DAILY_LIMIT: "3",
      TESTER_EMAILS: "parallel@example.test", ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) },
    stdio: ["ignore", "pipe", "ignore"], windowsHide: true,
  });
  return await new Promise<{ ok: boolean; result?: unknown }>((resolve, reject) => {
    let output = ""; const timer = setTimeout(() => child.kill("SIGKILL"), 8000);
    child.stdout.on("data", bytes => { output += bytes; if (output.length > 4096) child.kill("SIGKILL"); });
    child.on("error", reject); child.once("close", (code, signal) => {
      clearTimeout(timer); if (code !== 0 && !(input.action === "reserve-crash" && signal === "SIGKILL")) { reject(new Error("Bounded ledger fixture failed")); return; }
      try { resolve(JSON.parse(output)); } catch { reject(new Error("Invalid ledger fixture response")); }
    });
  });
}
function organization() { return createOrganization({ name: "synthetic concurrency", email: "synthetic@example.test", tier: "enterprise", quota: 100 }); }
it("enforces shared server-AI and combined mail budgets across 16 independent processes", async () => {
  for (const [service, now] of [["server-ai", Date.UTC(2031, 0, 1)], ["email", Date.UTC(2031, 0, 2)]] as const) {
    const outcomes = await Promise.all(Array.from({ length: 16 }, () => run({ action: "external", service, now })));
    expect(outcomes.every(o => o.ok), JSON.stringify(outcomes.map(o => ({ ok: o.ok, errorCode: (o as { errorCode?: string }).errorCode })))).toBe(true);
    expect(outcomes.filter(o => o.result === true)).toHaveLength(3);
    const usage = getDatabase().prepare("SELECT consumed FROM external_daily_usage WHERE service=? AND day=?").get(service, new Date(now).toISOString().slice(0, 10));
    expect(usage).toEqual({ consumed: 3 });
  }
}, 30_000);
it("recovers from SIGKILL after a committed reservation without refunding or replaying uncertain work", async () => {
  const org = organization(), key = generateApiKey(org.id, "killed", ["curriculum:match"]), now = Date.UTC(2031, 0, 5);
  const reserve = { orgId: org.id, keyId: key.id, monthlyLimit: 3, method: "POST", endpoint: "/test", requestDigest: "synthetic", now, idempotencyKey: "killed-request" };
  const killed = await run({ action: "reserve-crash", reserve }); expect(killed.ok).toBe(true);
  expect(reserveOrgApiCall(reserve)).toMatchObject({ ok: false, reason: "idempotency-pending", consumed: 1 });
  expect(reserveOrgApiCall({ ...reserve, now: now + STALE_IN_FLIGHT_MS + 1 })).toMatchObject({ ok: false, reason: "idempotency-expired", consumed: 1 });
  const next = reserveOrgApiCall({ ...reserve, idempotencyKey: "fresh-request", now: now + STALE_IN_FLIGHT_MS + 1 });
  expect(next).toMatchObject({ ok: true, replay: false, consumed: 2 });
}, 30_000);
it("bounds organization AI across two tenants and independent processes", async () => {
  const a = organization(), b = organization(), now = Date.UTC(2031, 0, 3);
  const outcomes = await Promise.all(Array.from({ length: 16 }, (_, i) => run({ action: "org-ai", orgId: i % 2 ? a.id : b.id, now })));
  expect(outcomes.every(o => o.ok), JSON.stringify(outcomes.map(o => ({ ok: o.ok, errorCode: (o as { errorCode?: string }).errorCode })))).toBe(true); expect(outcomes.filter(o => o.result === true)).toHaveLength(3);
  const rows = getDatabase().prepare("SELECT consumed FROM org_ai_daily_usage WHERE day='2031-01-03'").all() as { consumed: number }[];
  expect(rows.every(r => r.consumed <= 2)).toBe(true);
}, 30_000);
it("preserves consumption and expires pending work after process exit and restart", async () => {
  const org = organization(), key = generateApiKey(org.id, "crash", ["curriculum:match"]), now = Date.UTC(2031, 0, 4);
  const reserve = { orgId: org.id, keyId: key.id, monthlyLimit: 2, method: "POST", endpoint: "/test", requestDigest: "synthetic", now };
  const outcomes = await Promise.all(Array.from({ length: 16 }, (_, i) => run({ action: "reserve", reserve: { ...reserve, idempotencyKey: `request-${i}` } })));
  expect(outcomes.every(o => o.ok), JSON.stringify(outcomes.map(o => ({ ok: o.ok, errorCode: (o as { errorCode?: string }).errorCode })))).toBe(true);
  const accepted = outcomes.filter(o => (o.result as { ok: boolean }).ok); expect(accepted).toHaveLength(2);
  expect(getDatabase().prepare("SELECT consumed FROM api_org_quota WHERE org_id=?").get(org.id)).toEqual({ consumed: 2 });
  const first = outcomes.findIndex(o => (o.result as { ok: boolean }).ok);
  const replay = reserveOrgApiCall({ ...reserve, idempotencyKey: `request-${first}`, now: now + STALE_IN_FLIGHT_MS + 1 });
  expect(replay).toMatchObject({ ok: false, reason: "idempotency-expired", consumed: 2 });
  expect(reserveOrgApiCall({ ...reserve, now: now + STALE_IN_FLIGHT_MS + 1 })).toMatchObject({ ok: false, reason: "quota", consumed: 2 });
}, 30_000);
it("serializes key issuance against closure and refuses closure while work is active", async () => {
  const org = organization();
  const outcomes = await Promise.all([...Array.from({ length: 8 }, () => run({ action: "issue", orgId: org.id })), run({ action: "close", orgId: org.id })]);
  expect(outcomes[8].ok).toBe(true);
  expect(getDatabase().prepare("SELECT COUNT(*) AS n FROM api_keys WHERE org_id=? AND is_active=1").get(org.id)).toEqual({ n: 0 });
  expect(() => generateApiKey(org.id, "late", ["curriculum:match"])).toThrow();
  const other = organization(), key = generateApiKey(other.id, "live", ["curriculum:match"]);
  const reserve = { orgId: other.id, keyId: key.id, monthlyLimit: 100, method: "POST", endpoint: "/test", requestDigest: "synthetic" };
  const job = reserveOrgApiCall(reserve); if (!job.ok || job.replay) throw new Error("fixture failed");
  expect((await run({ action: "close", orgId: other.id })).ok).toBe(false);
  completeOrgApiCall({ ...reserve, ...job, statusCode: 200 }); closeOrganization(getDatabase(), other.id, true);
  expect(() => reserveOrgApiCall(reserve)).toThrow("afgesloten");
}, 30_000);
it("consumes a valid OTP exactly once under parallel verification without duplicating first terms evidence", async () => {
  const db = getDatabase(), email = "parallel@example.test", code = "234567", challenge = "A".repeat(43), now = Date.now();
  const hash = createHmac("sha256", process.env.AUTH_SECRET!).update(`otp:${email}:${code}`).digest("hex");
  db.prepare("INSERT INTO login_codes(id,email,code_hash,ip_hash,challenge_hash,privacy_accepted,created_at,expires_at,terms_hash,terms_accepted_at) VALUES ('parallel-code',?,?,'synthetic',?,1,?,?,?,?)")
    .run(email, hash, hashLoginChallenge(challenge), now, now + 60_000, registerTermsDocument(db), now);
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => run({ action: "verify", email, code, challenge })));
  expect(outcomes.filter(o => o.ok)).toHaveLength(1);
  expect(db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email=?)").get(email)).toEqual({ n: 1 });
  expect(db.prepare("SELECT accepted_at FROM terms_acceptances WHERE user_id IN (SELECT id FROM users WHERE email=?)").all(email)).toEqual([{ accepted_at: now }]);
  expect((await run({ action: "verify", email, code, challenge })).ok).toBe(false);
}, 30_000);
