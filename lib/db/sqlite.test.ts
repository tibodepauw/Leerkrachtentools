import { describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";

describe("SQLite singleton", () => {
  it("hergebruikt één verbinding met WAL en busy_timeout 5000", () => {
    const first = getDatabase();
    const second = getDatabase();
    expect(first).toBe(second);

    const journal = String(first.pragma("journal_mode", { simple: true })).toLowerCase();
    expect(journal).toBe("wal");
    expect(Number(first.pragma("busy_timeout", { simple: true }))).toBe(5000);
  });
});
