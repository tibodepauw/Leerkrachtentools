import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/account/route";
import { getDatabase } from "@/lib/auth/database";
import { normalizeEmail } from "@/lib/auth/normalizeEmail";
import { aiBudgetSubjectFromEmail } from "@/lib/auth/aiBudgetIdentity";
import { recordAiBudgetUsage, countRecentAiBudgetUsage } from "@/lib/ai/usageLimits";
import { absoluteAppUrl } from "@/lib/http/appUrl";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: vi.fn(),
  unauthorizedResponse: () =>
    Response.json(
      { error: "Je sessie is verlopen. Log opnieuw in." },
      { status: 401 },
    ),
}));

import { sessionFromRequest } from "@/lib/auth/guard";

const mockedSession = vi.mocked(sessionFromRequest);

function insertUser(id: string, email: string) {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO users
        (id, email, tier, email_verified_at, created_at, updated_at)
       VALUES (?, ?, 'tester', ?, ?, ?)`,
    )
    .run(id, email, now, now, now);
}

describe("account delete", () => {
  const ids: string[] = [];

  afterEach(() => {
    const db = getDatabase();
    for (const id of ids.splice(0)) {
      db.prepare("DELETE FROM login_codes WHERE email LIKE ?").run(`%${id}%`);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
    }
    mockedSession.mockReset();
  });

  it("trekt pending login_codes in en laat het AI-budget staan", async () => {
    const id = `del-${randomUUID()}`;
    const email = `${id}@example.com`;
    ids.push(id);
    insertUser(id, email);
    const now = Date.now();
    getDatabase()
      .prepare(
        `INSERT INTO login_codes
          (id, email, code_hash, ip_hash, marketing_opt_in, privacy_accepted, expires_at, created_at)
         VALUES (?, ?, 'abc', 'ip', 0, 1, ?, ?)`,
      )
      .run(randomUUID(), normalizeEmail(email), now + 60_000, now);
    getDatabase()
      .prepare(
        `INSERT INTO sessions
          (token_hash, user_id, expires_at, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(`session-${id}`, id, now + 60_000, now, now);

    const subject = aiBudgetSubjectFromEmail(email);
    recordAiBudgetUsage(subject, now);

    mockedSession.mockReturnValue({
      id,
      email,
      displayName: null,
      tier: "tester",
      marketingOptIn: false,
      profileImageUrl: null,
      pinnedModules: [],
      expiresAt: now + 60_000,
    });

    const response = await DELETE(new Request(absoluteAppUrl("/api/account"), { method: "DELETE" }));
    expect(response.status).toBe(200);

    const codes = getDatabase()
      .prepare("SELECT COUNT(*) AS count FROM login_codes WHERE email = ?")
      .get(normalizeEmail(email)) as { count: number };
    expect(codes.count).toBe(0);

    const sessions = getDatabase()
      .prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?")
      .get(id) as { count: number };
    expect(sessions.count).toBe(0);

    const user = getDatabase()
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(id);
    expect(user).toBeUndefined();

    expect(countRecentAiBudgetUsage(subject, now)).toBe(1);
  });
});
