import type Database from "better-sqlite3";
const DAY = 86_400_000;
/** No schema creation, no implicit database selection; dry-run is read-only. */
export function cleanupExpiredData(db: Database.Database, { now = Date.now(), apply = false } = {}) {
  const day = new Date(now - 7 * DAY).toISOString().slice(0, 10);
  const rules: Array<[string, string, Array<string | number>]> = [
    ["login_codes", "expires_at < ? AND created_at < ?", [now, now - DAY]],
    ["sessions", "expires_at < ? OR last_seen_at < ?", [now, now - DAY]],
    ["request_rate_events", "created_at < ?", [now - 2 * DAY]],
    ["ai_budget_usage", "created_at < ?", [now - 2 * DAY]],
    ["user_ai_usage", "created_at < ?", [now - 2 * DAY]],
    ["feedback_events", "created_at < ?", [now - 90 * DAY]],
    ["api_usage_logs", "created_at < ?", [now - 90 * DAY]],
    ["security_events", "created_at < ?", [now - 90 * DAY]],
    ["security_event_windows", "window_start < ?", [now - 90 * DAY]],
    ["api_idempotency_keys", "created_at < ? AND status != 'pending' AND NOT EXISTS (SELECT 1 FROM api_request_leases l WHERE l.id = api_idempotency_keys.lease_id AND l.status = 'active')", [now - DAY]],
    ["api_request_leases", "created_at < ? AND status != 'active' AND NOT EXISTS (SELECT 1 FROM api_idempotency_keys i WHERE i.lease_id = api_request_leases.id AND (i.status = 'pending' OR i.created_at >= ?))", [now - DAY, now - DAY]],
    ["external_daily_usage", "day < ?", [day]],
    ["org_ai_daily_usage", "day < ?", [day]],
  ];
  // Quota ledgers, terms evidence, profile data and live work are deliberately outside these expiry rules.
  const run = () => rules.map(([table, where, params]) => {
    const eligible = (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...params) as { n: number }).n;
    const removed = apply ? db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...params).changes : 0;
    return { table, eligible, removed };
  });
  const transaction = db.transaction(run);
  return { dryRun: !apply, at: now, tables: apply ? transaction.immediate() : transaction() };
}
