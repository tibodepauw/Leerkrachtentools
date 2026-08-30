import { describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/auth/database";

describe("ensureDatabaseIndexes", () => {
  it("maakt indexen aan voor sessies en AI-gebruik", () => {
    const db = getDatabase();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as Array<{ name: string }>;

    const names = new Set(indexes.map((index) => index.name));

    expect(names.has("sessions_user_id")).toBe(true);
    expect(names.has("sessions_user_id_created_at")).toBe(true);
    expect(names.has("user_ai_usage_user_created")).toBe(true);
    expect(names.has("user_ai_usage_user_id")).toBe(true);
    expect(names.has("user_ai_usage_created_at")).toBe(true);
    expect(names.has("users_created_at")).toBe(true);
  });
});
