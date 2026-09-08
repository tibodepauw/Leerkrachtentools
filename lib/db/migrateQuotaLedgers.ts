import type Database from "better-sqlite3";
import { aiBudgetSubjectFromEmail } from "@/lib/auth/aiBudgetIdentity";
import { utcMonthPeriod } from "@/lib/api/utcMonth";

export const QUOTA_LEDGER_BACKFILL_MIGRATION = "v20_quota_ledger_backfill_v1";

/**
 * Historical B2B rows that count as consumed work after upgrade:
 * - 2xx: successful handler
 * - 5xx: work may already have run; no refund
 * 4xx and 429 are not counted (validation, auth, or quota denials).
 */
export function isHistoricalBillableStatus(statusCode: number) {
  return (
    (statusCode >= 200 && statusCode < 300) ||
    (statusCode >= 500 && statusCode < 600)
  );
}

function migrationApplied(db: Database.Database, id: string) {
  const row = db
    .prepare("SELECT id FROM schema_migrations WHERE id = ?")
    .get(id) as { id: string } | undefined;
  return Boolean(row);
}

export type QuotaBackfillResult = {
  id: typeof QUOTA_LEDGER_BACKFILL_MIGRATION;
  applied: boolean;
  orgRows: number;
  aiRows: number;
};

export function applyQuotaLedgerBackfill(
  db: Database.Database,
  now = Date.now(),
): QuotaBackfillResult {
  if (migrationApplied(db, QUOTA_LEDGER_BACKFILL_MIGRATION)) {
    return {
      id: QUOTA_LEDGER_BACKFILL_MIGRATION,
      applied: false,
      orgRows: 0,
      aiRows: 0,
    };
  }

  return db.transaction((): QuotaBackfillResult => {
    if (migrationApplied(db, QUOTA_LEDGER_BACKFILL_MIGRATION)) {
      return {
        id: QUOTA_LEDGER_BACKFILL_MIGRATION,
        applied: false,
        orgRows: 0,
        aiRows: 0,
      };
    }

    const period = utcMonthPeriod(now);
    const monthStart = Date.UTC(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)) - 1,
      1,
    );
    const logs = db
      .prepare(
        `SELECT k.org_id AS orgId, l.status_code AS statusCode
         FROM api_usage_logs l
         JOIN api_keys k ON k.id = l.key_id
         WHERE l.created_at >= ?`,
      )
      .all(monthStart) as Array<{ orgId: string; statusCode: number }>;

    const consumedByOrg = new Map<string, number>();
    for (const row of logs) {
      if (!isHistoricalBillableStatus(row.statusCode)) continue;
      consumedByOrg.set(row.orgId, (consumedByOrg.get(row.orgId) ?? 0) + 1);
    }

    let orgRows = 0;
    for (const [orgId, historical] of consumedByOrg) {
      db.prepare(
        `INSERT INTO api_org_quota (
           org_id, period, consumed, in_flight, burst_window_start, burst_count,
           denial_window_start, denial_count, denial_logs_written, updated_at
         ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, ?)
         ON CONFLICT(org_id, period) DO UPDATE SET
           consumed = MAX(api_org_quota.consumed, excluded.consumed)`,
      ).run(orgId, period, historical, now);
      orgRows += 1;
    }

    const cutoff = now - 48 * 60 * 60 * 1000;
    const aiRows = db
      .prepare(
        `SELECT u.email AS email, a.created_at AS createdAt
         FROM user_ai_usage a
         JOIN users u ON u.id = a.user_id
         WHERE a.created_at >= ?`,
      )
      .all(cutoff) as Array<{ email: string; createdAt: number }>;

    let insertedAi = 0;
    const insertAi = db.prepare(
      `INSERT INTO ai_budget_usage (subject, created_at)
       SELECT ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM ai_budget_usage
         WHERE subject = ? AND created_at = ?
       )`,
    );
    for (const row of aiRows) {
      const subject = aiBudgetSubjectFromEmail(row.email);
      const result = insertAi.run(subject, row.createdAt, subject, row.createdAt);
      insertedAi += Number(result.changes ?? 0);
    }

    db.prepare(
      "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
    ).run(QUOTA_LEDGER_BACKFILL_MIGRATION, now);

    return {
      id: QUOTA_LEDGER_BACKFILL_MIGRATION,
      applied: true,
      orgRows,
      aiRows: insertedAi,
    };
  })();
}

export function warnIfQuotaBackfillPending(db: Database.Database, now = Date.now()) {
  if (process.env.VITEST) return;
  if (migrationApplied(db, QUOTA_LEDGER_BACKFILL_MIGRATION)) return;
  const period = utcMonthPeriod(now);
  const monthStart = Date.UTC(
    Number(period.slice(0, 4)),
    Number(period.slice(5, 7)) - 1,
    1,
  );
  const logs = db
    .prepare(
      "SELECT COUNT(*) AS count FROM api_usage_logs WHERE created_at >= ?",
    )
    .get(monthStart) as { count: number };
  const ai = db
    .prepare("SELECT COUNT(*) AS count FROM user_ai_usage WHERE created_at >= ?")
    .get(now - 48 * 60 * 60 * 1000) as { count: number };
  if (logs.count > 0 || ai.count > 0) {
    console.warn(
      "[db] quota ledger backfill is not applied. Back up the database, then run: npx tsx scripts/migrate-quota-ledgers.ts",
    );
  }
}
