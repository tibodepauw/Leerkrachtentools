import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/auth/database";
import { GET, PUT } from "@/app/api/account/pinned-modules/route";

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

function insertUser(id: string, email: string) {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO users
        (id, email, tier, email_verified_at, created_at, updated_at, pinned_modules)
       VALUES (?, ?, 'tester', ?, ?, ?, '[]')`,
    )
    .run(id, email, now, now, now);
}

describe("account pinned-modules API", () => {
  const createdIds: string[] = [];

  afterEach(() => {
    const db = getDatabase();
    for (const id of createdIds.splice(0)) {
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
    }
    mockedSessionFromRequest.mockReset();
  });

  it("weigert verzoeken zonder sessie", async () => {
    mockedSessionFromRequest.mockReturnValue(null);
    const response = await GET(new Request("http://localhost/api/account/pinned-modules"));
    expect(response.status).toBe(401);
  });

  it("bewaart geldige pins op het account", async () => {
    const id = `pin-${randomUUID()}`;
    createdIds.push(id);
    insertUser(id, `${id}@example.com`);
    mockedSessionFromRequest.mockReturnValue({
      id,
      email: `${id}@example.com`,
      displayName: null,
      tier: "tester",
      marketingOptIn: false,
      profileImageUrl: null,
      pinnedModules: [],
      expiresAt: Date.now() + 60_000,
    });

    const put = await PUT(
      new Request("http://localhost/api/account/pinned-modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pinnedModules: ["spellcheck", "active-lesson", "alignment"],
        }),
      }),
    );
    expect(put.status).toBe(200);
    await expect(put.json()).resolves.toEqual({
      pinnedModules: ["spellcheck", "alignment"],
    });

    const row = getDatabase()
      .prepare("SELECT pinned_modules FROM users WHERE id = ?")
      .get(id) as { pinned_modules: string };
    expect(row.pinned_modules).toBe('["spellcheck","alignment"]');
  });

  it("weigert een body zonder array", async () => {
    const id = `pin-${randomUUID()}`;
    createdIds.push(id);
    insertUser(id, `${id}@example.com`);
    mockedSessionFromRequest.mockReturnValue({
      id,
      email: `${id}@example.com`,
      displayName: null,
      tier: "tester",
      marketingOptIn: false,
      profileImageUrl: null,
      pinnedModules: [],
      expiresAt: Date.now() + 60_000,
    });

    const response = await PUT(
      new Request("http://localhost/api/account/pinned-modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedModules: "spellcheck" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
