import "server-only";
import { getDatabase } from "@/lib/db/sqlite";

function limit(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
export function reserveOrgAiBudget(orgId: string, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const db = getDatabase();
  return db.transaction(() => {
    // Prune once per booking, retain a bounded seven-day accounting window.
    db.prepare("DELETE FROM org_ai_daily_usage WHERE day < ?").run(new Date(now - 7 * 86_400_000).toISOString().slice(0, 10));
    const org = db.prepare("SELECT id FROM api_organizations WHERE id = ?").get(orgId);
    if (!org) return false;
    const own = db.prepare("SELECT consumed FROM org_ai_daily_usage WHERE org_id = ? AND day = ?").get(orgId, day) as { consumed: number } | undefined;
    const global = db.prepare("SELECT COALESCE(SUM(consumed), 0) AS consumed FROM org_ai_daily_usage WHERE day = ?").get(day) as { consumed: number };
    if ((own?.consumed ?? 0) >= limit("ORG_AI_DAILY_LIMIT", 100) || global.consumed >= limit("ORG_AI_GLOBAL_DAILY_LIMIT", 500)) return false;
    db.prepare(`INSERT INTO org_ai_daily_usage(org_id, day, consumed) VALUES (?, ?, 1)
      ON CONFLICT(org_id, day) DO UPDATE SET consumed = consumed + 1`).run(orgId, day);
    return true;
  })();
}
