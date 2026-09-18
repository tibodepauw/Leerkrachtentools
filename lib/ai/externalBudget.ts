import "server-only";
import { getDatabase } from "@/lib/db/sqlite";

const limits = {
  "server-ai": ["SERVER_AI_DAILY_CALL_LIMIT", 500],
  discovery: ["DISCOVERY_DAILY_CALL_LIMIT", 1000],
  email: ["BREVO_DAILY_EMAIL_LIMIT", 500],
} as const;

/** One reservation per attempted remote call, including failed/fallback calls.
 * Shared by web and B2B processes using the same database. No prompt or key is stored.
 * Counts calls, not euros; provider-side spending limits are still required.
 */
export function reserveExternalCall(service: keyof typeof limits, now = Date.now()) {
  const [name, fallback] = limits[service];
  const raw = process.env[name];
  const limit = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(limit) || limit <= 0) return false;
  const day = new Date(now).toISOString().slice(0, 10);
  const db = getDatabase();
  return db.transaction(() => {
    db.prepare("DELETE FROM external_daily_usage WHERE day < ?").run(new Date(now - 7 * 86_400_000).toISOString().slice(0, 10));
    const row = db.prepare("SELECT consumed FROM external_daily_usage WHERE service = ? AND day = ?").get(service, day) as { consumed: number } | undefined;
    if ((row?.consumed ?? 0) >= limit) return false;
    db.prepare(`INSERT INTO external_daily_usage(service, day, consumed) VALUES (?, ?, 1)
      ON CONFLICT(service, day) DO UPDATE SET consumed = consumed + 1`).run(service, day);
    return true;
  }).immediate();
}
