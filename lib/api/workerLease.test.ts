import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, expect, it, vi } from "vitest";
import { withApiAuth } from "@/lib/api-guard";
import { runProcessJob } from "@/lib/workers/processJob";
import { createOrganization, generateApiKey } from "@/lib/api-keys";
import { countOrgActiveLeases, heartbeatOrgApiCall, reserveOrgApiCall, STALE_IN_FLIGHT_MS } from "./orgQuota";
import { getDatabase } from "@/lib/db/sqlite";
const folder = mkdtempSync(path.join(tmpdir(), "lt-lease-kill-"));
const fixture = path.join(folder, "spin.cjs");
writeFileSync(fixture, `const fs=require('node:fs');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{fs.writeFileSync(JSON.parse(s).marker,String(process.pid));while(true){Math.sqrt(Math.random());}});`);
afterAll(() => rmSync(folder, { recursive: true, force: true }));
afterEach(() => vi.unstubAllEnvs());
function seeded() {
  const org = createOrganization({ name: "worker lease", email: `${randomUUID()}@example.test`, tier: "enterprise", quota: 100 });
  return { org, key: generateApiKey(org.id, "worker-lease", ["curriculum:match"]) };
}
it.each(["deadline", "lease loss", "disconnect"])("hard stops CPU work on %s before releasing the slot", async (cause) => {
  const { org, key } = seeded();
  const marker = path.join(folder, `${randomUUID()}.pid`);
  vi.stubEnv("ORG_API_MAX_EXECUTION_MS", cause === "deadline" ? "1800" : "5000");
  const controller = new AbortController();
  const route = withApiAuth(async (_req, ctx) => {
    await runProcessJob(fixture, { marker }, { signal: ctx.signal, timeoutMs: 10000 });
    return Response.json({ shouldNotComplete: true });
  }, { requiredScope: "curriculum:match" });
  const pending = route(new Request("http://localhost/api/v1/curriculum/match", { method: "POST", signal: controller.signal, headers: { authorization: `Bearer ${key.token}`, "content-type": "application/json" }, body: "{}" }));
  for (let n = 0; n < 100 && !existsSync(marker); n++) await new Promise(r => setTimeout(r, 10));
  expect(existsSync(marker)).toBe(true);
  expect(countOrgActiveLeases(org.id)).toBe(1);
  if (cause === "lease loss") getDatabase().prepare("UPDATE api_request_leases SET expires_at = 0 WHERE org_id = ?").run(org.id);
  if (cause === "disconnect") controller.abort();
  const response = await pending;
  expect(response.status).toBe(cause === "deadline" ? 429 : 500);
  // A public deadline can win a microtask before SIGKILL's close event. The
  // reservation stays held until that close event, then becomes reusable.
  for (let n = 0; n < 100 && countOrgActiveLeases(org.id); n++) await new Promise(r => setTimeout(r, 10));
  expect(countOrgActiveLeases(org.id)).toBe(0);
  expect(() => process.kill(Number(readFileSync(marker, "utf8")), 0)).toThrow();
});
it("does not revive an expired lease with a late heartbeat", () => {
  const { org, key } = seeded();
  const now = Date.now();
  const lease = reserveOrgApiCall({ orgId: org.id, keyId: key.id, monthlyLimit: 100, method: "POST", endpoint: "/test", requestDigest: "test", now });
  expect(lease.ok && !lease.replay).toBe(true);
  if (!lease.ok || lease.replay) throw new Error("fixture did not reserve");
  expect(heartbeatOrgApiCall({ leaseId: lease.leaseId, ownerToken: lease.ownerToken, now: now + STALE_IN_FLIGHT_MS + 1 })).toBe(false);
});
