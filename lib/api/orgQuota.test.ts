import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiAuth } from "@/lib/api-guard";
import {
  API_DENIAL_LOG_CAP,
  completeOrgApiCall,
  countGlobalActiveLeases,
  countOrgActiveLeases,
  getOrgQuotaSnapshot,
  noteOrgDenial,
  reserveOrgApiCall,
} from "@/lib/api/orgQuota";
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
    const { organization, key } = seedOrg(0);
    const handler = handlerWithPause({ count: 0 }, 0);
    const before = (
      getDatabase().prepare("SELECT COUNT(*) AS count FROM api_usage_logs").get() as {
        count: number;
      }
    ).count;
    const eventsBefore = (
      getDatabase()
        .prepare("SELECT COUNT(*) AS count FROM security_events WHERE org_id = ?")
        .get(organization.id) as { count: number }
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
    const events = (
      getDatabase()
        .prepare("SELECT COUNT(*) AS count FROM security_events WHERE org_id = ?")
        .get(organization.id) as { count: number }
    ).count;
    expect(after - before).toBeLessThanOrEqual(API_DENIAL_LOG_CAP);
    expect(after - before).toBeGreaterThan(0);
    expect(events - eventsBefore).toBeLessThanOrEqual(API_DENIAL_LOG_CAP);
    const denial = getDatabase()
      .prepare(
        `SELECT denial_count AS denialCount, denial_logs_written AS denialLogsWritten
         FROM api_org_quota WHERE org_id = ? ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(organization.id) as { denialCount: number; denialLogsWritten: number };
    expect(denial.denialLogsWritten).toBeLessThanOrEqual(API_DENIAL_LOG_CAP);
    expect(denial.denialCount).toBe(20);
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

  it("levert geen auditdata via een goals:improve-sleutel met dezelfde Idempotency-Key", async () => {
    const organization = createOrganization({
      name: `Org ${randomUUID()}`,
      email: `${randomUUID()}@publisher.test`,
      tier: "enterprise",
      quota: 50,
    });
    const auditKey = generateApiKey(organization.id, "quota-test", ["curriculum:audit"]);
    const improveKey = generateApiKey(organization.id, "quota-test", ["goals:improve"]);
    const { POST: postAudit } = await import("@/app/api/v1/curriculum/audit/route");
    const { POST: postImprove } = await import("@/app/api/v1/goals/improve/route");
    const secretTitle = `Vertrouwelijke methode ${randomUUID()}`;
    const headers = { "Idempotency-Key": "shared-job-1" };
    const denied = await postAudit(
      new Request("http://benchmark.local/api/v1/curriculum/audit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${improveKey.token}`,
        },
        body: JSON.stringify({
          method_title: secretTitle,
          grade: "4de leerjaar",
          target_goals: ["De leerlingen tellen tot 20."],
          lesson_units: [
            { unit_id: "u1", title: "Tellen", content: "De leerlingen tellen tot 20." },
          ],
        }),
      }),
    );
    expect(denied.status).toBe(403);

    const audit = await postAudit(
      new Request("http://benchmark.local/api/v1/curriculum/audit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${auditKey.token}`,
          ...headers,
        },
        body: JSON.stringify({
          method_title: secretTitle,
          grade: "4de leerjaar",
          target_goals: ["De leerlingen tellen tot 20."],
          lesson_units: [
            { unit_id: "u1", title: "Tellen", content: "De leerlingen tellen tot 20." },
          ],
        }),
      }),
    );
    expect(audit.status).toBe(200);
    const auditBody = await audit.json() as { method_title: string };
    expect(auditBody.method_title).toBe(secretTitle);

    const replay = await postImprove(
      new Request("http://benchmark.local/api/v1/goals/improve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${improveKey.token}`,
          ...headers,
        },
        body: JSON.stringify({ goal: "De leerlingen kennen de maaltafels van 4." }),
      }),
    );
    expect(replay.status).toBe(200);
    expect(replay.headers.get("X-Idempotent-Replay")).not.toBe("1");
    const improveBody = await replay.text();
    expect(improveBody).not.toContain(secretTitle);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(2);
  });

  it("geeft 409 bij dezelfde Idempotency-Key en een gewijzigde body", async () => {
    const { organization, key } = seedOrg(5);
    const handler = handlerWithPause({ count: 0 }, 0);
    const headers = { "Idempotency-Key": "same-call-conflict" };
    const first = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    const second = await post(handler, key.token, { query: "aftrekken tot 20" }, headers);
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
  });

  it("geeft 409 op de echte auditroute bij dezelfde Idempotency-Key en een gewijzigde body", async () => {
    const organization = createOrganization({
      name: `Org ${randomUUID()}`,
      email: `${randomUUID()}@publisher.test`,
      tier: "enterprise",
      quota: 20,
    });
    const key = generateApiKey(organization.id, "quota-test", ["curriculum:audit"]);
    const { POST: postAudit } = await import("@/app/api/v1/curriculum/audit/route");
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${key.token}`,
      "Idempotency-Key": "audit-body-conflict",
    };
    const firstBody = {
      method_title: "Eerste methode",
      grade: "4de leerjaar",
      target_goals: ["De leerlingen tellen tot 20."],
      lesson_units: [
        { unit_id: "u1", title: "Tellen", content: "De leerlingen tellen tot 20." },
      ],
    };
    const first = await postAudit(
      new Request("http://benchmark.local/api/v1/curriculum/audit", {
        method: "POST",
        headers,
        body: JSON.stringify(firstBody),
      }),
    );
    const second = await postAudit(
      new Request("http://benchmark.local/api/v1/curriculum/audit", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...firstBody, method_title: "Andere methode" }),
      }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
  });

  it("weigert een te lange Idempotency-Key", async () => {
    const { key } = seedOrg(5);
    const handler = handlerWithPause({ count: 0 }, 0);
    const response = await post(handler, key.token, { query: "optellen tot 20" }, {
      "Idempotency-Key": "k".repeat(129),
    });
    expect(response.status).toBe(400);
  });

  it("rondt een reservering af op de geboekte periode na een maandwissel", async () => {
    const { organization, key } = seedOrg(10);
    const september = Date.UTC(2026, 8, 30, 23, 59, 59);
    const october = Date.UTC(2026, 9, 1, 0, 0, 1);
    const first = reserveOrgApiCall({
      orgId: organization.id,
      keyId: key.id,
      monthlyLimit: 10,
      method: "POST",
      endpoint: "/api/v1/curriculum/match",
      requestDigest: "digest-a",
      now: september,
    });
    const second = reserveOrgApiCall({
      orgId: organization.id,
      keyId: key.id,
      monthlyLimit: 10,
      method: "POST",
      endpoint: "/api/v1/curriculum/match",
      requestDigest: "digest-b",
      now: october,
    });
    expect(first.ok && !first.replay).toBe(true);
    expect(second.ok && !second.replay).toBe(true);
    if (!first.ok || first.replay || !second.ok || second.replay) return;
    completeOrgApiCall({
      orgId: organization.id,
      keyId: key.id,
      leaseId: first.leaseId,
      ownerToken: first.ownerToken,
      period: first.period,
      statusCode: 200,
      responseBody: "{}",
      now: october,
    });
    expect(getOrgQuotaSnapshot(organization.id, september).inFlight).toBe(0);
    expect(getOrgQuotaSnapshot(organization.id, october).inFlight).toBe(1);
    completeOrgApiCall({
      orgId: organization.id,
      keyId: key.id,
      leaseId: second.leaseId,
      ownerToken: second.ownerToken,
      period: second.period,
      statusCode: 200,
      responseBody: "{}",
      now: october,
    });
    completeOrgApiCall({
      orgId: organization.id,
      keyId: key.id,
      leaseId: first.leaseId,
      ownerToken: first.ownerToken,
      period: first.period,
      statusCode: 200,
      responseBody: "{}",
      now: october,
    });
    expect(getOrgQuotaSnapshot(organization.id, october).inFlight).toBe(0);
  });

  it("herstelt vastgelopen slots ondanks denialverkeer", async () => {
    const { organization, key } = seedOrg(10);
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const leases = [];
    for (let index = 0; index < 4; index += 1) {
      const reserved = reserveOrgApiCall({
        orgId: organization.id,
        keyId: key.id,
        monthlyLimit: 10,
        method: "POST",
        endpoint: "/api/v1/curriculum/match",
        requestDigest: `digest-${index}`,
        now: start,
      });
      expect(reserved.ok && !reserved.replay).toBe(true);
      leases.push(reserved);
    }
    const blockedAt60 = reserveOrgApiCall({
      orgId: organization.id,
      keyId: key.id,
      monthlyLimit: 10,
      method: "POST",
      endpoint: "/api/v1/curriculum/match",
      requestDigest: "later",
      now: start + 60_000,
    });
    expect(blockedAt60.ok).toBe(false);
    noteOrgDenial(organization.id, start + 60_000);
    noteOrgDenial(organization.id, start + 120_000);
    const recovered = reserveOrgApiCall({
      orgId: organization.id,
      keyId: key.id,
      monthlyLimit: 10,
      method: "POST",
      endpoint: "/api/v1/curriculum/match",
      requestDigest: "recovered",
      now: start + 120_000,
    });
    expect(recovered.ok).toBe(true);
  });

  it("houdt de lease bij timeout tot late completion de oorspronkelijke slot sluit", async () => {
    vi.stubEnv("ORG_API_MAX_EXECUTION_MS", "40");
    const { organization, key } = seedOrg(10);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const handler = withApiAuth(
      async () => {
        await gate;
        return NextResponse.json({ late: true });
      },
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    try {
      const response = await post(handler, key.token);
      expect(response.status).toBe(429);
      expect(getOrgQuotaSnapshot(organization.id).inFlight).toBe(1);
      release?.();
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(getOrgQuotaSnapshot(organization.id).inFlight).toBe(0);
      const extra = reserveOrgApiCall({
        orgId: organization.id,
        keyId: key.id,
        monthlyLimit: 10,
        method: "POST",
        endpoint: "/api/v1/curriculum/match",
        requestDigest: "after-timeout",
        now: Date.now(),
      });
      expect(extra.ok).toBe(true);
      if (extra.ok && !extra.replay) {
        completeOrgApiCall({
          orgId: organization.id,
          keyId: key.id,
          leaseId: extra.leaseId,
          ownerToken: extra.ownerToken,
          period: extra.period,
          statusCode: 200,
          responseBody: "{}",
        });
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("laat een falende security-eventwriter de 429-respons niet onderbreken", async () => {
    const { key } = seedOrg(0);
    const events = await import("@/lib/security/events");
    const spy = vi.spyOn(events, "recordSecurityEvent").mockImplementation(() => {
      throw new Error("event disk full");
    });
    const handler = handlerWithPause({ count: 0 }, 0);
    try {
      const response = await post(handler, key.token);
      expect(response.status).toBe(429);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toContain("quota");
    } finally {
      spy.mockRestore();
    }
  });

  it("speelt een groot JSON-antwoord identiek terug via de guard", async () => {
    const { organization, key } = seedOrg(5);
    const bulky = { ok: true, blob: "a".repeat(70_000) };
    const handler = withApiAuth(
      async () => NextResponse.json(bulky),
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    const headers = { "Idempotency-Key": "bulky-json-1" };
    const first = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    const second = await post(handler, key.token, { query: "optellen tot 20" }, headers);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Idempotent-Replay")).toBe("1");
    const firstText = await first.text();
    const secondText = await second.text();
    expect(firstText.length).toBeGreaterThan(64_000);
    expect(secondText).toBe(firstText);
    expect(JSON.parse(secondText).error).toBeUndefined();
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
  });

  it("speelt een groot auditrapporter identiek terug in plaats van een fout met HTTP 200", async () => {
    const organization = createOrganization({
      name: `Org ${randomUUID()}`,
      email: `${randomUUID()}@publisher.test`,
      tier: "enterprise",
      quota: 20,
    });
    const key = generateApiKey(organization.id, "quota-test", ["curriculum:audit"]);
    const { POST: postAudit } = await import("@/app/api/v1/curriculum/audit/route");
    const units = Array.from({ length: 100 }, (_, index) => ({
      unit_id: `u${String(index).padStart(2, "0")}-${"n".repeat(75)}`.slice(0, 80),
      title: `Tellen ${index}`,
      content: "De leerlingen tellen tot twintig.",
    }));
    const goals = Array.from(
      { length: 10 },
      (_, index) =>
        `De leerlingen tellen tot twintig in doel ${index}. ${"oefen observeerbaar ".repeat(12)}`.slice(0, 500),
    );
    const body = {
      method_title: "Grote audit",
      grade: "4de leerjaar",
      target_goals: goals,
      lesson_units: units,
    };
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${key.token}`,
      "Idempotency-Key": "large-audit-1",
    };
    const first = await postAudit(
      new Request("http://benchmark.local/api/v1/curriculum/audit", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    expect(first.status).toBe(200);
    const firstText = await first.text();
    expect(firstText.length).toBeGreaterThan(64_000);
    expect(JSON.parse(firstText).error).toBeUndefined();
    const second = await postAudit(
      new Request("http://benchmark.local/api/v1/curriculum/audit", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Idempotent-Replay")).toBe("1");
    const secondText = await second.text();
    expect(secondText).toBe(firstText);
    expect(JSON.parse(secondText).error).toBeUndefined();
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(1);
  }, 60_000);

  it("PR1-01 reserveert pas na de body met een actuele heartbeat", async () => {
    const { organization, key } = seedOrg(5);
    const started = { count: 0 };
    const handler = handlerWithPause(started, 0);
    const t0 = Date.now();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"query":"optellen tot 20"}'));
        setTimeout(() => controller.close(), 180);
      },
    });
    const response = await handler(
      new Request("http://benchmark.local/api/v1/curriculum/match", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...authHeader(key.token),
        },
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
    expect(response.status).toBe(200);
    expect(started.count).toBe(1);
    const lease = getDatabase()
      .prepare(
        `SELECT heartbeat_at AS heartbeatAt, created_at AS createdAt
         FROM api_request_leases WHERE org_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(organization.id) as { heartbeatAt: number; createdAt: number };
    expect(lease.createdAt).toBeGreaterThanOrEqual(t0 + 150);
    expect(lease.heartbeatAt).toBeGreaterThanOrEqual(t0 + 150);
  });

  it("PR1-01 start geen handler na een verlopen body", async () => {
    vi.stubEnv("ORG_API_BODY_TIMEOUT_MS", "50");
    const { organization, key } = seedOrg(5);
    const started = { count: 0 };
    const handler = handlerWithPause(started, 0);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"query":"optellen tot 20"}'));
      },
    });
    try {
      const response = await handler(
        new Request("http://benchmark.local/api/v1/curriculum/match", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...authHeader(key.token),
          },
          body,
          duplex: "half",
        } as RequestInit & { duplex: "half" }),
      );
      expect(response.status).toBe(400);
      expect(started.count).toBe(0);
      expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("PR1-02 houdt eerste antwoord en replay gelijk rond de orgcachegrens", async () => {
    const { organization, key } = seedOrg(40);
    const pad = `${"é".repeat(50)}${"x".repeat(499_700)}`;
    const handler = withApiAuth(
      async () => NextResponse.json({ pad }),
      { requiredScope: "curriculum:match", bodySchema: dummySchema },
    );
    let lastKey = "";
    for (let index = 0; index < 16; index += 1) {
      lastKey = `fill-${index}`;
      const response = await post(handler, key.token, { query: "optellen tot 20" }, {
        "Idempotency-Key": lastKey,
      });
      expect(response.status).toBe(200);
    }
    const overflowKey = "overflow-1";
    const first = await post(handler, key.token, { query: "optellen tot 20" }, {
      "Idempotency-Key": overflowKey,
    });
    const replay = await post(handler, key.token, { query: "optellen tot 20" }, {
      "Idempotency-Key": overflowKey,
    });
    const firstText = await first.text();
    const replayText = await replay.text();
    expect(first.status).toBe(replay.status);
    expect(firstText).toBe(replayText);
    expect(first.status).toBe(413);
    expect(JSON.parse(replayText).code).toBe("idempotency_payload_too_large");
    expect(getOrgQuotaSnapshot(organization.id).consumed).toBe(17);
  }, 60_000);

  it("PR1-03 telt organisatieconcurrency over maandgrenzen heen", async () => {
    const { organization, key } = seedOrg(20);
    const september = Date.UTC(2026, 8, 30, 23, 59, 59);
    const october = september + 2_000;
    const leases = [];
    for (let index = 0; index < 4; index += 1) {
      const reserved = reserveOrgApiCall({
        orgId: organization.id,
        keyId: key.id,
        monthlyLimit: 20,
        method: "POST",
        endpoint: "/api/v1/curriculum/match",
        requestDigest: `sept-${index}`,
        now: september,
      });
      expect(reserved.ok && !reserved.replay).toBe(true);
      leases.push(reserved);
    }
    const blocked = reserveOrgApiCall({
      orgId: organization.id,
      keyId: key.id,
      monthlyLimit: 20,
      method: "POST",
      endpoint: "/api/v1/curriculum/match",
      requestDigest: "oct-1",
      now: october,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("org-concurrency");
    expect(countOrgActiveLeases(organization.id, october)).toBe(4);
    expect(countGlobalActiveLeases(october)).toBeGreaterThanOrEqual(4);
    expect(getOrgQuotaSnapshot(organization.id, october).inFlight).toBe(0);
    expect(getOrgQuotaSnapshot(organization.id, september).inFlight).toBe(4);
  });

  it.todo(
    "PR1-05 / V20-08: lease blijft tot een gestreamde responsebody is uitgelezen",
  );
});
