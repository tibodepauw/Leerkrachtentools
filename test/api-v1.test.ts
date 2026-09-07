import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as postMatch } from "@/app/api/v1/curriculum/match/route";
import { POST as postAudit } from "@/app/api/v1/curriculum/audit/route";
import { POST as postImprove } from "@/app/api/v1/goals/improve/route";
import { CURRICULUM_MATCH_RESULT_KEYS } from "@/lib/b2b/matchCurriculum";
import {
  createOrganization,
  generateApiKey,
  hashApiKey,
  timingSafeHashEqual,
  validateApiKey,
  ApiAuthError,
} from "@/lib/api-keys";
import { getDatabase } from "@/lib/db/sqlite";
import { proxy } from "@/proxy";

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

function seedPublisher(scopes: string[], quota = 10_000) {
  const organization = createOrganization({
    name: `Uitgeverij ${randomUUID()}`,
    email: `${randomUUID()}@publisher.test`,
    tier: "enterprise",
    quota,
  });
  const key = generateApiKey(organization.id, "ci", scopes);
  return { organization, key };
}

async function postJson(
  handler: (request: Request) => Promise<Response>,
  url: string,
  token: string,
  body: unknown,
) {
  return handler(
    new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeader(token),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("B2B API v1", () => {
  afterEach(() => {
    getDatabase()
      .prepare(
        "DELETE FROM api_usage_logs WHERE key_id IN (SELECT id FROM api_keys WHERE name = 'ci')",
      )
      .run();
  });

  it("autoriseert een geldige sleutel en weigert een foutieve (401)", async () => {
    const { key } = seedPublisher(["curriculum:match"]);
    const ok = await postJson(
      postMatch,
      "http://benchmark.local/api/v1/curriculum/match",
      key.token,
      {
        query: "optellen tot 20",
        network: "AHOVOKS",
        level: "basis",
        mode: "snel",
      },
    );
    expect(ok.status).toBe(200);
    const payload = (await ok.json()) as {
      success: boolean;
      count: number;
      results: Array<{ code: string; text: string; network: string; score: number }>;
    };
    expect(payload.success).toBe(true);
    expect(payload.count).toBe(payload.results.length);
    expect(payload.results.length).toBeLessThanOrEqual(5);
    const allowed = new Set<string>(CURRICULUM_MATCH_RESULT_KEYS);
    for (const result of payload.results) {
      expect(Object.keys(result).every((key) => allowed.has(key))).toBe(true);
      expect(result).toHaveProperty("code");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("network");
      expect(result).toHaveProperty("score");
      expect(result).not.toHaveProperty("toelichting");
      expect(result).not.toHaveProperty("titel");
      expect(result).not.toHaveProperty("snippet");
      expect(JSON.stringify(result)).not.toMatch(/pedagogische wenken/i);
    }
    expect(ok.headers.get("X-RateLimit-Limit")).toBe("10000");
    expect(ok.headers.get("X-RateLimit-Remaining")).toBeTruthy();
    expect(ok.headers.get("X-RateLimit-Reset")).toBeTruthy();

    const denied = await postJson(
      postMatch,
      "http://benchmark.local/api/v1/curriculum/match",
      "lt_live_thisisnotavalidsecretvalue00000000000000000000000000000000",
      { query: "optellen tot 20" },
    );
    expect(denied.status).toBe(401);
  });

  it("weigert een sleutel zonder de vereiste scope (403)", async () => {
    const { key } = seedPublisher(["curriculum:match"]);
    const response = await postJson(
      postAudit,
      "http://benchmark.local/api/v1/curriculum/audit",
      key.token,
      {
        method_title: "Methode rekenen",
        grade: "4de leerjaar",
        target_goals: ["De leerlingen tellen tot 20."],
        lesson_units: [
          {
            unit_id: "u1",
            title: "Instap",
            content: "De leerlingen tellen tot 20 met blokken.",
          },
        ],
      },
    );
    expect(response.status).toBe(403);
  });

  it("geeft 401 bij een timingSafeEqual-lengtemismatch, geen 500", () => {
    expect(timingSafeHashEqual("abcd", "abcde")).toBe(false);
    expect(timingSafeHashEqual(hashApiKey("lt_live_a"), hashApiKey("lt_live_a"))).toBe(
      true,
    );
    expect(() => validateApiKey("short", "curriculum:match")).toThrow(ApiAuthError);
    try {
      validateApiKey("short", "curriculum:match");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiAuthError);
      expect((error as ApiAuthError).status).toBe(401);
    }
  });

  it("geeft 429 en Retry-After bij quota-overschrijding", async () => {
    const { key } = seedPublisher(["curriculum:match"], 0);
    const response = await postJson(
      postMatch,
      "http://benchmark.local/api/v1/curriculum/match",
      key.token,
      { query: "optellen tot 20" },
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("geeft 400 bij ongeldige Zod-payload en bij corrupte JSON", async () => {
    const { key } = seedPublisher(["curriculum:match", "curriculum:audit"]);
    const tooShort = await postJson(
      postMatch,
      "http://benchmark.local/api/v1/curriculum/match",
      key.token,
      { query: "ab" },
    );
    expect(tooShort.status).toBe(400);

    const tooMany = await postJson(
      postMatch,
      "http://benchmark.local/api/v1/curriculum/match",
      key.token,
      { query: "optellen tot 20", limit: 11 },
    );
    expect(tooMany.status).toBe(400);

    const invalidJson = await postJson(
      postMatch,
      "http://benchmark.local/api/v1/curriculum/match",
      key.token,
      "{not-json",
    );
    expect(invalidJson.status).toBe(400);
  });

  it("auditet dekking van lesunits tegen doelzinnen", async () => {
    const { key } = seedPublisher(["curriculum:audit"]);
    const response = await postJson(
      postAudit,
      "http://benchmark.local/api/v1/curriculum/audit",
      key.token,
      {
        method_title: "Rekenen tot 20",
        grade: "2de leerjaar",
        target_goals: [
          "De leerlingen tellen vlot tot twintig.",
          "De leerlingen lassen een metalen buis.",
        ],
        lesson_units: [
          {
            unit_id: "instap",
            title: "Tellen tot twintig",
            content:
              "De leerlingen tellen vlot tot twintig met blokken en een getallenlijn.",
          },
        ],
      },
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      coverage: Array<{ goal: string; status: string; matched_units: string[] }>;
      missing: string[];
    };
    expect(payload.success).toBe(true);
    expect(payload.coverage[0]?.status).toBe("gedekt");
    expect(payload.coverage[0]?.matched_units).toContain("instap");
    expect(payload.missing.length).toBeGreaterThan(0);
  });

  it("verbetert een lesdoel via de Doelverbeteraar-regels", async () => {
    const { key } = seedPublisher(["goals:improve"]);
    const response = await postJson(
      postImprove,
      "http://benchmark.local/api/v1/goals/improve",
      key.token,
      { goal: "De leerlingen kennen de maaltafels van 4." },
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      result: { improved: string; status: string };
    };
    expect(payload.success).toBe(true);
    expect(payload.result.improved.length).toBeGreaterThan(10);
  });
});

describe("B2B proxy CSRF-uitzondering", () => {
  it("laat /api/v1 met Bearer lt_live_ door, ook vanaf een andere origin", async () => {
    const { key } = seedPublisher(["curriculum:match"]);
    const request = new NextRequest("https://tools.example.be/api/v1/curriculum/match", {
      method: "POST",
      headers: {
        origin: "https://uitgeverij.example",
        authorization: `Bearer ${key.token}`,
        "content-type": "application/json",
      },
    });
    const response = proxy(request);
    expect(response.status).not.toBe(403);
    expect(response.status).not.toBe(401);
  });

  it("houdt cookie-CSRF voor gewone API-routes in productie", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://tools.example.be");
    try {
      const request = new NextRequest("https://tools.example.be/api/account", {
        method: "DELETE",
        headers: {
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        },
      });
      const response = proxy(request);
      expect(response.status).toBe(403);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
