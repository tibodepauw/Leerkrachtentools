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

export const QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER = "sum-pre-ledger";
export const QUOTA_LEDGER_RECONCILE_MAX_OVERLAP = "max-overlap";

export type QuotaLedgerReconcile =
  | typeof QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER
  | typeof QUOTA_LEDGER_RECONCILE_MAX_OVERLAP;

export type QuotaBackfillResult = {
  id: typeof QUOTA_LEDGER_BACKFILL_MIGRATION;
  applied: boolean;
  refused: boolean;
  reason?: string;
  ambiguousOrgIds?: string[];
  orgRows: number;
  aiRows: number;
};

const idleBackfill = {
  id: QUOTA_LEDGER_BACKFILL_MIGRATION,
  applied: false,
  refused: false,
  orgRows: 0,
  aiRows: 0,
} as const;

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

export function parseQuotaLedgerReconcile(
  env = process.env.QUOTA_LEDGER_RECONCILE,
): QuotaLedgerReconcile | null {
  if (!env) return null;
  if (
    env === QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER ||
    env === QUOTA_LEDGER_RECONCILE_MAX_OVERLAP
  ) {
    return env;
  }
  throw new Error(
    `Unknown QUOTA_LEDGER_RECONCILE=${env}. Use ${QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER} (all current logs are pre-ledger) or ${QUOTA_LEDGER_RECONCILE_MAX_OVERLAP} (all new work is also logged).`,
  );
}

export function billableLogsInMonth(
  logs: Array<{ statusCode: number; createdAt: number }>,
  monthStart: number,
) {
  return logs.filter(
    (log) =>
      isHistoricalBillableStatus(log.statusCode) && log.createdAt >= monthStart,
  );
}

export function isAmbiguousUnknownStart({
  ledgerConsumed,
  openedAt,
  monthStart,
  billableCount,
}: {
  ledgerConsumed: number;
  openedAt: number;
  monthStart: number;
  billableCount: number;
}) {
  return openedAt <= monthStart && ledgerConsumed > 0 && billableCount > 0;
}

/**
 * Mix old usage-log rows with a v5.20 ledger without losing unlogged new
 * work or counting logged new work twice.
 *
 * When `openedAt` marks the first v5.20 quota row for the period:
 *   old logs (before openedAt) + max(ledger, new logs)
 * When the start is unknown, only unambiguous periods are counted here
 * (logs-only or ledger-only). Mixed unknown periods need an explicit
 * `QUOTA_LEDGER_RECONCILE` mode; `max(ledger, logs)` can drop unlogged work.
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
  const inMonth = billableLogsInMonth(logs, monthStart);
  const ledger = Math.max(0, ledgerConsumed);
  if (openedAt > monthStart) {
    const oldCount = inMonth.filter((log) => log.createdAt < openedAt).length;
    const newCount = inMonth.filter((log) => log.createdAt >= openedAt).length;
    return oldCount + Math.max(ledger, newCount);
  }
  if (ledger > 0 && inMonth.length > 0) {
    throw new Error(
      "Unknown v5.20 start with both logs and a ledger. Set QUOTA_LEDGER_EPOCH_MS or QUOTA_LEDGER_RECONCILE.",
    );
  }
  return Math.max(ledger, inMonth.length);
}

/**
 * Explicit operator choice when `opened_at` and `QUOTA_LEDGER_EPOCH_MS` are
 * both unknown. `sum-pre-ledger` assumes every current log is older than the
 * ledger (3 logged + 2 unlogged ledger units => 5). `max-overlap` assumes
 * every new unit is also logged and can drop unlogged new work (same fixture
 * => 3).
 */
export function reconcileUnknownStartConsumed({
  ledgerConsumed,
  monthStart,
  logs,
  mode,
}: {
  ledgerConsumed: number;
  monthStart: number;
  logs: Array<{ statusCode: number; createdAt: number }>;
  mode: QuotaLedgerReconcile;
}) {
  const billableCount = billableLogsInMonth(logs, monthStart).length;
  const ledger = Math.max(0, ledgerConsumed);
  if (mode === QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER) {
    return billableCount + ledger;
  }
  return Math.max(ledger, billableCount);
}

export function ambiguousStartMessage(orgIds: string[]) {
  const subject =
    orgIds.length === 1 ? `${orgIds[0]} has` : `${orgIds.join(", ")} have`;
  return [
    `Refusing quota backfill: ${subject} both billable usage logs and a ledger in this UTC month, but opened_at is unknown.`,
    "max(ledger, logs) would drop unlogged new work (3 logged calls + 2 unlogged ledger units become 3 instead of 5).",
    "Set QUOTA_LEDGER_EPOCH_MS to the first v5.20 start, or approve a documented reconcile:",
    `  QUOTA_LEDGER_RECONCILE=${QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER}  # logs are all pre-ledger; add them to consumed`,
    `  QUOTA_LEDGER_RECONCILE=${QUOTA_LEDGER_RECONCILE_MAX_OVERLAP}     # all new work is also logged; can drop unlogged units`,
  ].join("\n");
}

export function applyQuotaLedgerBackfill(
  db: Database.Database,
  now = Date.now(),
): QuotaBackfillResult {
  ensureFollowupSchema(db);
  if (migrationApplied(db, QUOTA_LEDGER_BACKFILL_MIGRATION)) {
    return { ...idleBackfill };
  }

  const reconcile = parseQuotaLedgerReconcile();

  return db.transaction((): QuotaBackfillResult => {
    if (migrationApplied(db, QUOTA_LEDGER_BACKFILL_MIGRATION)) {
      return { ...idleBackfill };
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
    const plans: Array<{
      orgId: string;
      consumed: number;
      persistOpenedAt: number;
    }> = [];
    const ambiguousOrgIds: string[] = [];
    for (const orgId of orgIds) {
      const quota = quotaByOrg.get(orgId);
      const openedAt = resolveOpenedAt(quota?.openedAt, monthStart, envEpoch);
      const orgLogs = logsByOrg.get(orgId) ?? [];
      const billableCount = billableLogsInMonth(orgLogs, monthStart).length;
      const ledgerConsumed = quota?.consumed ?? 0;
      if (
        isAmbiguousUnknownStart({
          ledgerConsumed,
          openedAt,
          monthStart,
          billableCount,
        })
      ) {
        if (!reconcile) {
          ambiguousOrgIds.push(orgId);
          continue;
        }
        plans.push({
          orgId,
          consumed: reconcileUnknownStartConsumed({
            ledgerConsumed,
            monthStart,
            logs: orgLogs,
            mode: reconcile,
          }),
          persistOpenedAt:
            typeof quota?.openedAt === "number" && quota.openedAt > 0
              ? quota.openedAt
              : openedAt,
        });
        continue;
      }
      const consumed = mixedPeriodConsumed({
        ledgerConsumed,
        openedAt,
        monthStart,
        logs: orgLogs,
      });
      const persistOpenedAt =
        typeof quota?.openedAt === "number" && quota.openedAt > 0
          ? quota.openedAt
          : openedAt;
      plans.push({ orgId, consumed, persistOpenedAt });
    }

    if (ambiguousOrgIds.length > 0) {
      return {
        ...idleBackfill,
        refused: true,
        reason: ambiguousStartMessage(ambiguousOrgIds),
        ambiguousOrgIds,
      };
    }

    let orgRows = 0;
    for (const plan of plans) {
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
      ).run(plan.orgId, period, plan.consumed, plan.persistOpenedAt, now);
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
      refused: false,
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
