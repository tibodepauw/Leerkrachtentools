import { afterEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/auth/database";
import {
  countRecentServerAiUsage,
  evaluateServerAiAccess,
  recordServerAiUsage,
  tryReserveServerAiUsage,
} from "@/lib/ai/usageLimits";

function seedUser(userId: string, tier: string) {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO users
        (id, email, tier, email_verified_at, marketing_opt_in, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(userId, `${userId}@example.com`, tier, now, now, now);
}

describe("server AI usage limits", () => {
  const userId = "usage-test-user";

  afterEach(() => {
    getDatabase().prepare("DELETE FROM user_ai_usage WHERE user_id = ?").run(userId);
    getDatabase().prepare("DELETE FROM users WHERE id = ?").run(userId);
  });

  it("blokkeert unapproved gebruikers zonder eigen API-key", () => {
    seedUser(userId, "unapproved");
    const access = evaluateServerAiAccess({
      userId,
      tier: "unapproved",
      userAiConfig: null,
    });

    expect(access.allowed).toBe(false);
    if (!access.allowed) {
      expect(access.status).toBe(403);
    }
  });

  it("valt niet terug op serverquota bij een onleesbare eigen key", () => {
    seedUser(userId, "student");
    const access = evaluateServerAiAccess({
      userId,
      tier: "student",
      userAiConfig: {
        enabled: true,
        provider: "google",
        apiKey: "",
        model: "gemini-test",
      },
    });

    expect(access.allowed).toBe(false);
    if (!access.allowed) {
      expect(access.status).toBe(409);
      expect(access.message).toContain("opnieuw");
    }
  });

  it("hanteert daglimieten voor studenten", () => {
    seedUser(userId, "student");
    const now = Date.now();

    for (let index = 0; index < 40; index += 1) {
      recordServerAiUsage(userId, now - index * 1000);
    }

    expect(countRecentServerAiUsage(userId, now)).toBe(40);

    const access = evaluateServerAiAccess({
      userId,
      tier: "student",
      userAiConfig: null,
      now,
    });

    expect(access.allowed).toBe(false);
    if (!access.allowed) {
      expect(access.status).toBe(429);
      expect(access.message).toContain("40");
    }
  });

  it("reserveert een slot atomair zodat parallelle calls de limiet niet overschrijden", () => {
    seedUser(userId, "student");
    const now = Date.now();
    for (let index = 0; index < 39; index += 1) {
      recordServerAiUsage(userId, now);
    }

    const first = tryReserveServerAiUsage(userId, 40, now);
    const second = tryReserveServerAiUsage(userId, 40, now);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(countRecentServerAiUsage(userId, now)).toBe(40);
  });
});
