import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiAuth } from "@/lib/api-guard";
import { API_DENIAL_LOG_CAP, getOrgQuotaSnapshot } from "@/lib/api/orgQuota";
import {
  createOrganization,
  generateApiKey,
  revokeApiKey,
} from "@/lib/api-keys";
import { getDatabase } from "@/lib/db/sqlite";

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

function seedOrg(quota: number, scopes = ["curriculum:match"]) {
  const organization = createOrganization({
    name: `Org ${randomUUID()}`,
    email: `${randomUUID()}@publisher.test`,
    tier: "enterprise",
    quota,
  });
  const key = generateApiKey(organization.id, "quota-test", scopes);
  return { organization, key };
}

const dummySchema = z.object({ query: z.string().trim().min(3) });

function handlerWithPause(started: { count: number }, pauseMs: number) {
  return withApiAuth(
    async () => {
      started.count += 1;
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
      return NextResponse.json({ ok: true });
    },
    { requiredScope: "curriculum:match", bodySchema: dummySchema },
  );
}

async function post(
  handler: (request: Request) => Promise<Response>,
  token: string,
  body: unknown = { query: "optellen tot 20" },
  extraHeaders: HeadersInit = {},
) {
  return handler(
    new Request("http://benchmark.local/api/v1/curriculum/match", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeader(token),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("B2B org quota ledger", () => {
  afterEach(() => {
    getDatabase().prepare("DELETE FROM api_usage_logs WHERE key_id IN (SELECT id FROM api_keys WHERE name = 'quota-test')").run();
  });

  it("laat bij één resterende eenheid hoogstens één zware handler starten", async () => {
    const { organization, key } = seedOrg(1);
    const started = { count: 0 };
    const handler = handlerWithPause(started, 80);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => post(handler, key.token)),
    );
    const statuses = results.map((response) => response.status).sort();
    expect(started.count).toBe(1);
    expect(statuses.filter((status) => status === 200)).toEqual([200]);
    expect(statuses.filter((status) => status === 429)).toHaveLength(7);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
  });

  it("deelt het maandbudget over twee sleutels van dezelfde organisatie", async () => {
    const { organization, key } = seedOrg(1);
    const second = generateApiKey(organization.id, "quota-test", ["curriculum:match"]);
    const started = { count: 0 };
    const handler = handlerWithPause(started, 40);
    const [first, other] = await Promise.all([
      post(handler, key.token),
      post(handler, second.token),
    ]);
    const statuses = [first.status, other.status].sort();
    expect(started.count).toBe(1);
    expect(statuses).toEqual([200, 429]);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
  });

  it("verbruikt een idempotency-key niet dubbel", async () => {
    const { organization, key } = seedOrg(5);
    const handler = handlerWithPause({ count: 0 }, 0);
    const headers = { "Idempotency-Key": "same-call-1" };
    const first = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    const second = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Idempotent-Replay")).toBe("1");
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
  });

  it("zet het budget niet terug als de usage-log faalt", async () => {
    const { organization, key } = seedOrg(3);
    const logSpy = vi.spyOn(await import("@/lib/api-keys"), "logApiUsage").mockImplementation(() => {
      throw new Error("log disk full");
    });
    const handler = handlerWithPause({ count: 0 }, 0);
    try {
      const response = await post(handler, key.token);
      expect(response.status).toBe(200);
      expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("groeit niet onbeperkt bij een reeks 429's", async () => {
    const { key } = seedOrg(0);
    const handler = handlerWithPause({ count: 0 }, 0);
    const before = (
      getDatabase().prepare("SELECT COUNT(*) AS count FROM api_usage_logs").get() as {
        count: number;
      }
    ).count;
    for (let index = 0; index < 20; index += 1) {
      const response = await post(handler, key.token);
      expect(response.status).toBe(429);
    }
    const after = (
      getDatabase().prepare("SELECT COUNT(*) AS count FROM api_usage_logs").get() as {
        count: number;
      }
    ).count;
    expect(after - before).toBeLessThanOrEqual(API_DENIAL_LOG_CAP);
    expect(after - before).toBeGreaterThan(0);
  });

  it("boekhoudt validatiefouten niet als maandverbruik", async () => {
    const { organization, key } = seedOrg(1);
    const handler = handlerWithPause({ count: 0 }, 0);
    const invalid = await post(handler, key.token, { query: "ab" });
    expect(invalid.status).toBe(400);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(0);
    const valid = await post(handler, key.token);
    expect(valid.status).toBe(200);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
  });

  it("weigert een ingetrokken sleutel onmiddellijk", async () => {
    const { key } = seedOrg(10);
    revokeApiKey(key.id);
    const handler = handlerWithPause({ count: 0 }, 0);
    const response = await post(handler, key.token);
    expect(response.status).toBe(401);
  });
});
