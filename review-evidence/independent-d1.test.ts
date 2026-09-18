/**
 * Independent D1 assertions for the ZIP review of 2026-09-09.
 *
 * Isolated run (do not point DATABASE_PATH at a production database):
 * DATABASE_PATH=:memory: npx vitest run review-evidence/independent-d1.test.ts --pool=forks --maxWorkers=1 --testTimeout=30000
 */
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiAuth } from "@/lib/api-guard";
import { countOrgActiveLeases, getOrgQuotaSnapshot } from "@/lib/api/orgQuota";
import { createOrganization, generateApiKey } from "@/lib/api-keys";
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

function usageLogCount(keyId: string) {
  return (
    getDatabase()
      .prepare("SELECT COUNT(*) AS count FROM api_usage_logs WHERE key_id = ?")
      .get(keyId) as { count: number }
  ).count;
}

describe("independent D1 assertions", () => {
  afterEach(() => {
    const db = getDatabase();
    db.prepare(
      "DELETE FROM api_request_leases WHERE key_id IN (SELECT id FROM api_keys WHERE name = 'quota-test')",
    ).run();
    db.prepare(
      `UPDATE api_org_quota SET in_flight = 0
       WHERE org_id IN (SELECT org_id FROM api_keys WHERE name = 'quota-test')`,
    ).run();
    db.prepare(
      "DELETE FROM api_usage_logs WHERE key_id IN (SELECT id FROM api_keys WHERE name = 'quota-test')",
    ).run();
  });

  it("D1-01 REQUIRED schrijft één usage-log voor een normale 200 zonder Idempotency-Key", async () => {
    const { organization, key } = seedOrg(5);
    const started = { count: 0 };
    const handler = withApiAuth(
      async () => {
        started.count += 1;
        return NextResponse.json({ ok: true });
      },
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    const before = usageLogCount(key.id);
    const response = await post(handler, key.token);
    expect(response.status).toBe(200);
    expect(started.count).toBe(1);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
    expect(usageLogCount(key.id) - before).toBe(1);
  });

  it("D1-01 REQUIRED schrijft één usage-log voor de eerste uitvoering, niet voor replay", async () => {
    const { organization, key } = seedOrg(5);
    const started = { count: 0 };
    const handler = withApiAuth(
      async () => {
        started.count += 1;
        return NextResponse.json({ ok: true });
      },
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    const headers = { "Idempotency-Key": "d1-01-independent" };
    const before = usageLogCount(key.id);
    const first = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    const replay = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.headers.get("X-Idempotent-Replay")).toBe("1");
    expect(started.count).toBe(1);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
    expect(usageLogCount(key.id) - before).toBe(1);
  });

  it("D1-01 bewaart response en quota als de logwriter faalt en de spy is aangeroepen", async () => {
    const { organization, key } = seedOrg(3);
    const apiKeys = await import("@/lib/api-keys");
    const logSpy = vi.spyOn(apiKeys, "logApiUsage").mockImplementation(() => {
      throw new Error("log disk full");
    });
    const handler = withApiAuth(
      async () => NextResponse.json({ ok: true }),
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    try {
      const response = await post(handler, key.token);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("D1-02 REQUIRED cachet een handlerrejection als 500, niet als timeout-429", async () => {
    const { organization, key } = seedOrg(5);
    const started = { count: 0 };
    const handler = withApiAuth(
      async () => {
        started.count += 1;
        throw new Error("controlled handler failure");
      },
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    const headers = { "Idempotency-Key": "d1-02-independent" };
    const first = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    const replay = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    const firstBody = await first.text();
    const replayBody = await replay.text();
    expect(first.status).toBe(500);
    expect(replay.status).toBe(500);
    expect(replay.headers.get("X-Idempotent-Replay")).toBe("1");
    expect(firstBody).toContain("niet verwerken");
    expect(replayBody).toBe(firstBody);
    expect(replayBody).not.toContain("te lang");
    expect(started.count).toBe(1);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
    expect(getOrgQuotaSnapshot(organization.id).inFlight).toBe(0);
  });

  it("D1-02 houdt een expliciete fouthandler en een echte timeout in hun eigen contract", async () => {
    const { organization, key } = seedOrg(10);
    const errorHandler = withApiAuth(
      async () => NextResponse.json({ error: "doel ontbreekt" }, { status: 422 }),
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    const errorHeaders = { "Idempotency-Key": "d1-02-error-response" };
    const firstError = await post(errorHandler, key.token, { query: "optellen tot 20" }, errorHeaders);
    const replayError = await post(errorHandler, key.token, { query: "optellen tot 20" }, errorHeaders);
    expect(firstError.status).toBe(422);
    expect(replayError.status).toBe(422);
    expect(replayError.headers.get("X-Idempotent-Replay")).toBe("1");
    expect(await replayError.text()).toBe(await firstError.text());

    vi.stubEnv("ORG_API_MAX_EXECUTION_MS", "40");
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const timeoutHandler = withApiAuth(
      async () => {
        await gate;
        return NextResponse.json({ late: true });
      },
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    try {
      const timeoutHeaders = { "Idempotency-Key": "d1-02-timeout" };
      const firstTimeout = await post(
        timeoutHandler,
        key.token,
        { query: "optellen tot 20" },
        timeoutHeaders,
      );
      expect(firstTimeout.status).toBe(429);
      expect(await firstTimeout.text()).toContain("te lang");
      release?.();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const replayTimeout = await post(
        timeoutHandler,
        key.token,
        { query: "optellen tot 20" },
        timeoutHeaders,
      );
      expect(replayTimeout.status).toBe(429);
      expect(replayTimeout.headers.get("X-Idempotent-Replay")).toBe("1");
      expect(await replayTimeout.text()).toContain("te lang");
      expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(2);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("V20-08 deellease: streamtimeout houdt de lease tot de body is uitgelezen", async () => {
    vi.stubEnv("ORG_API_MAX_EXECUTION_MS", "40");
    const { organization, key } = seedOrg(10);
    const produced = { count: 0 };
    const handler = withApiAuth(
      async () => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            setTimeout(() => {
              produced.count += 1;
              controller.enqueue(new TextEncoder().encode('{"late":true}'));
              controller.close();
            }, 120);
          },
        });
        return new Response(stream, {
          headers: { "content-type": "application/json" },
        });
      },
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    try {
      const response = await post(handler, key.token);
      expect(response.status).toBe(429);
      expect(produced.count).toBe(0);
      expect(countOrgActiveLeases(organization.id)).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(produced.count).toBe(1);
      expect(countOrgActiveLeases(organization.id)).toBe(0);
      expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
    } finally {
      vi.unstubAllEnvs();
    }
  }, 10_000);

  // Hard-stop/deadline/lease-loss regressions now run in lib/api/workerLease.test.ts.
});
