import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/auth/database";
import { GET, PATCH } from "@/app/api/account/api-keys/route";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: vi.fn(),
  unauthorizedResponse: () =>
    Response.json(
      { error: "Je sessie is verlopen. Log opnieuw in." },
      { status: 401 },
    ),
}));

import { sessionFromRequest } from "@/lib/auth/guard";

const mockedSessionFromRequest = vi.mocked(sessionFromRequest);

function insertUser(id: string) {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO users
        (id, email, tier, email_verified_at, created_at, updated_at)
       VALUES (?, ?, 'tester', ?, ?, ?)`,
    )
    .run(id, `${id}@example.com`, now, now, now);
}

function session(id: string): NonNullable<ReturnType<typeof sessionFromRequest>> {
  return {
    id,
    email: `${id}@example.com`,
    displayName: null,
    tier: "tester",
    marketingOptIn: false,
    profileImageUrl: null,
    pinnedModules: [],
    expiresAt: Date.now() + 60_000,
  };
}

describe("account api-keys", () => {
  const createdIds: string[] = [];

  afterEach(() => {
    const db = getDatabase();
    for (const id of createdIds.splice(0)) {
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
    }
    mockedSessionFromRequest.mockReset();
  });

  it("bewaart een ander model zonder de API-key opnieuw te vragen", async () => {
    const id = `keys-${randomUUID()}`;
    createdIds.push(id);
    insertUser(id);
    mockedSessionFromRequest.mockReturnValue(session(id));

    const create = await PATCH(
      new Request("http://localhost/api/account/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          provider: "google",
          model: "gemini-3.5-flash-lite",
          apiKey: "sk-test-google-key",
        }),
      }),
    );
    expect(create.status).toBe(200);

    const update = await PATCH(
      new Request("http://localhost/api/account/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          provider: "google",
          model: "gemini-2.5-flash",
        }),
      }),
    );
    expect(update.status).toBe(200);
    const payload = (await update.json()) as { model: string; hasApiKey: boolean };
    expect(payload.model).toBe("gemini-2.5-flash");
    expect(payload.hasApiKey).toBe(true);

    const stored = getDatabase()
      .prepare("SELECT ai_model FROM users WHERE id = ?")
      .get(id) as { ai_model: string };
    expect(stored.ai_model).toBe("gemini-2.5-flash");

    const loaded = await GET(
      new Request("http://localhost/api/account/api-keys"),
    );
    const settings = (await loaded.json()) as { model: string };
    expect(settings.model).toBe("gemini-2.5-flash");
  });
});
