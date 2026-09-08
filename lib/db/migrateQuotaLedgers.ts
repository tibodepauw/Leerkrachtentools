import type Database from "better-sqlite3";
import { aiBudgetSubjectFromEmail } from "@/lib/auth/aiBudgetIdentity";
import { utcMonthPeriod } from "@/lib/api/utcMonth";
import { ensureFollowupSchema } from "@/lib/db/ensureFollowupSchema";

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

type BillableLog = { orgId: string; statusCode: number; createdAt: number };

/**
 * Optional Unix timestamp of the first v5.20 quota ledger start.
 * Milliseconds if > 1e12, otherwise seconds. Used when `opened_at` is unknown.
 */
export function quotaLedgerEpochMs(env = process.env.QUOTA_LEDGER_EPOCH_MS) {
  if (!env) return 0;
  const value = Number(env);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1e12 ? Math.floor(value) : Math.floor(value * 1000);
}

export function resolveOpenedAt(
  rowOpenedAt: number | null | undefined,
  monthStart: number,
  envEpochMs = quotaLedgerEpochMs(),
) {
  if (typeof rowOpenedAt === "number" && rowOpenedAt > monthStart) {
    return rowOpenedAt;
  }
  if (envEpochMs > monthStart) return envEpochMs;
  return 0;
}

/**
 * Mix old usage-log rows with a v5.20 ledger without losing unlogged new
 * work or counting logged new work twice.
 *
 * When `openedAt` marks the first v5.20 quota row for the period:
 *   old logs (before openedAt) + max(ledger, new logs)
 * When the start is unknown (`openedAt` is 0):
 *   max(ledger, all billable logs) so overlapping rows cannot double-count.
 */
export function mixedPeriodConsumed({
  ledgerConsumed,
  openedAt,
  monthStart,
  logs,
}: {
  ledgerConsumed: number;
  openedAt: number;
  monthStart: number;
  logs: Array<{ statusCode: number; createdAt: number }>;
}) {
  const billable = logs.filter((log) =>
    isHistoricalBillableStatus(log.statusCode),
  );
  const inMonth = billable.filter((log) => log.createdAt >= monthStart);
  const ledger = Math.max(0, ledgerConsumed);
  if (openedAt > monthStart) {
    const oldCount = inMonth.filter((log) => log.createdAt < openedAt).length;
    const newCount = inMonth.filter((log) => log.createdAt >= openedAt).length;
    return oldCount + Math.max(ledger, newCount);
  }
  return Math.max(ledger, inMonth.length);
}

export function applyQuotaLedgerBackfill(
  db: Database.Database,
  now = Date.now(),
): QuotaBackfillResult {
  ensureFollowupSchema(db);
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
        `SELECT k.org_id AS orgId, l.status_code AS statusCode, l.created_at AS createdAt
         FROM api_usage_logs l
         JOIN api_keys k ON k.id = l.key_id
         WHERE l.created_at >= ?`,
      )
      .all(monthStart) as BillableLog[];

    const logsByOrg = new Map<string, BillableLog[]>();
    for (const row of logs) {
      const list = logsByOrg.get(row.orgId) ?? [];
      list.push(row);
      logsByOrg.set(row.orgId, list);
    }

    const quotaRows = db
      .prepare(
        `SELECT org_id AS orgId, consumed, opened_at AS openedAt
         FROM api_org_quota WHERE period = ?`,
      )
      .all(period) as Array<{
      orgId: string;
      consumed: number;
      openedAt: number | null;
    }>;
    const quotaByOrg = new Map(quotaRows.map((row) => [row.orgId, row]));
    const envEpoch = quotaLedgerEpochMs();

    const orgIds = new Set<string>([...logsByOrg.keys(), ...quotaByOrg.keys()]);
    let orgRows = 0;
    for (const orgId of orgIds) {
      const quota = quotaByOrg.get(orgId);
      const openedAt = resolveOpenedAt(quota?.openedAt, monthStart, envEpoch);
      const consumed = mixedPeriodConsumed({
        ledgerConsumed: quota?.consumed ?? 0,
        openedAt,
        monthStart,
        logs: logsByOrg.get(orgId) ?? [],
      });
      const persistOpenedAt =
        typeof quota?.openedAt === "number" && quota.openedAt > 0
          ? quota.openedAt
          : openedAt;
      db.prepare(
        `INSERT INTO api_org_quota (
           org_id, period, consumed, in_flight, burst_window_start, burst_count,
           denial_window_start, denial_count, denial_logs_written, opened_at, updated_at
         ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
         ON CONFLICT(org_id, period) DO UPDATE SET
           consumed = excluded.consumed,
           opened_at = CASE
             WHEN api_org_quota.opened_at > 0 THEN api_org_quota.opened_at
             ELSE excluded.opened_at
           END`,
      ).run(orgId, period, consumed, persistOpenedAt, now);
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
  if (process.env.QUOTA_LEDGER_BACKUP_CONFIRMED === "1") return;
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
      "[db] quota ledger backfill is not applied. Back up the database, then run: QUOTA_LEDGER_BACKUP_CONFIRMED=1 npm run migrate:quota-ledgers",
    );
  }
}
