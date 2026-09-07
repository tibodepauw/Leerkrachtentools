import "server-only";

import { getDatabase } from "@/lib/db/sqlite";
import { startOfNextUtcMonth, utcMonthPeriod } from "@/lib/api/utcMonth";

export const ORG_API_BURST_PER_MINUTE = 60;
export const ORG_API_MAX_IN_FLIGHT = 4;
export const GLOBAL_API_MAX_IN_FLIGHT = 32;
export const ORG_API_MAX_EXECUTION_MS = 45_000;
export const API_DENIAL_LOG_CAP = 8;
export const API_DENIAL_WINDOW_MS = 5 * 60 * 1000;
export const API_DENIAL_ALARM_THRESHOLD = 80;
export const API_USAGE_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const API_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const API_IDEMPOTENCY_BODY_MAX = 64_000;
export const STALE_IN_FLIGHT_MS = ORG_API_MAX_EXECUTION_MS * 2;

/**
 * Booking rules for the shared organization ledger:
 * - 401 invalid/revoked token: no reserve.
 * - 403 missing scope: no reserve.
 * - 400 JSON/schema before the handler: no reserve.
 * - Burst, org concurrency and global concurrency: 429, no monthly consume.
 * - Monthly quota: consume 1 in the same SQLite transaction that raises in_flight,
 *   before the heavy handler. Failures after that keep the unit.
 * - Idempotency-Key: first call consumes; replay or in-flight retry does not.
 * - Usage-log insert failures must not decrement consumed.
 */

export type OrgQuotaPeriod = ReturnType<typeof utcMonthPeriod>;

export type OrgQuotaReservation = {
  ok: true;
  replay: false;
  period: OrgQuotaPeriod;
  consumed: number;
  inFlight: number;
};

export type OrgQuotaReplay = {
  ok: true;
  replay: true;
  consumed: number;
  statusCode: number;
  body: string;
};

export type OrgQuotaDenied = {
  ok: false;
  reason:
    | "quota"
    | "burst"
    | "org-concurrency"
    | "global-concurrency"
    | "idempotency-pending";
  consumed: number;
  retryAfterSeconds: number;
};

export type OrgQuotaResult = OrgQuotaReservation | OrgQuotaReplay | OrgQuotaDenied;

export { utcMonthPeriod };

export function getOrgQuotaSnapshot(orgId: string, now = Date.now()) {
  const db = getDatabase();
  const period = utcMonthPeriod(now);
  const row = db
    .prepare(
      `SELECT consumed, in_flight AS inFlight
       FROM api_org_quota WHERE org_id = ? AND period = ?`,
    )
    .get(orgId, period) as { consumed: number; inFlight: number } | undefined;
  return {
    period,
    consumed: row?.consumed ?? 0,
    inFlight: row?.inFlight ?? 0,
  };
}

export function pruneApiTelemetry(now = Date.now()) {
  const db = getDatabase();
  db.prepare("DELETE FROM api_usage_logs WHERE created_at < ?").run(
    now - API_USAGE_LOG_RETENTION_MS,
  );
  db.prepare("DELETE FROM security_events WHERE created_at < ?").run(
    now - API_USAGE_LOG_RETENTION_MS,
  );
  db.prepare("DELETE FROM api_idempotency_keys WHERE created_at < ?").run(
    now - API_IDEMPOTENCY_TTL_MS,
  );
}

function normalizeIdempotencyKey(value: string | undefined) {
  const key = value?.trim() ?? "";
  if (!key) return undefined;
  if (key.length > 128) return undefined;
  return key;
}

export function reserveOrgApiCall({
  orgId,
  monthlyLimit,
  idempotencyKey,
  now = Date.now(),
}: {
  orgId: string;
  monthlyLimit: number;
  idempotencyKey?: string;
  now?: number;
}): OrgQuotaResult {
  const db = getDatabase();
  const period = utcMonthPeriod(now);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const burstWindow = now - (now % 60_000);
  const retryAfterMonth = Math.max(
    1,
    Math.ceil((startOfNextUtcMonth(now) - now) / 1000),
  );

  return db.transaction((): OrgQuotaResult => {
    pruneApiTelemetry(now);
    db.prepare(
      `UPDATE api_org_quota
       SET in_flight = 0, updated_at = ?
       WHERE in_flight > 0 AND updated_at < ?`,
    ).run(now, now - STALE_IN_FLIGHT_MS);

    if (key) {
      const existing = db
        .prepare(
          `SELECT status, status_code, response_body
           FROM api_idempotency_keys
           WHERE org_id = ? AND idempotency_key = ?`,
        )
        .get(orgId, key) as
        | { status: string; status_code: number | null; response_body: string | null }
        | undefined;
      if (existing?.status === "pending") {
        const snapshot = getOrgQuotaSnapshot(orgId, now);
        return {
          ok: false,
          reason: "idempotency-pending",
          consumed: snapshot.consumed,
          retryAfterSeconds: 5,
        };
      }
      if (existing?.status === "completed") {
        const snapshot = getOrgQuotaSnapshot(orgId, now);
        return {
          ok: true,
          replay: true,
          consumed: snapshot.consumed,
          statusCode: existing.status_code ?? 200,
          body:
            existing.response_body ??
            JSON.stringify({ error: "Dit verzoek is al verwerkt." }),
        };
      }
    }

    const global = db
      .prepare("SELECT COALESCE(SUM(in_flight), 0) AS count FROM api_org_quota")
      .get() as { count: number };
    if (global.count >= GLOBAL_API_MAX_IN_FLIGHT) {
      const snapshot = getOrgQuotaSnapshot(orgId, now);
      return {
        ok: false,
        reason: "global-concurrency",
        consumed: snapshot.consumed,
        retryAfterSeconds: 15,
      };
    }

    db.prepare(
      `INSERT INTO api_org_quota (
         org_id, period, consumed, in_flight, burst_window_start, burst_count,
         denial_window_start, denial_count, denial_logs_written, updated_at
       ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, ?)
       ON CONFLICT(org_id, period) DO NOTHING`,
    ).run(orgId, period, now);

    const row = db
      .prepare(
        `SELECT consumed, in_flight, burst_window_start, burst_count
         FROM api_org_quota WHERE org_id = ? AND period = ?`,
      )
      .get(orgId, period) as {
      consumed: number;
      in_flight: number;
      burst_window_start: number;
      burst_count: number;
    };

    const burstCount =
      row.burst_window_start === burstWindow ? row.burst_count : 0;
    if (burstCount >= ORG_API_BURST_PER_MINUTE) {
      return {
        ok: false,
        reason: "burst",
        consumed: row.consumed,
        retryAfterSeconds: Math.max(1, Math.ceil((burstWindow + 60_000 - now) / 1000)),
      };
    }

    if (row.in_flight >= ORG_API_MAX_IN_FLIGHT) {
      return {
        ok: false,
        reason: "org-concurrency",
        consumed: row.consumed,
        retryAfterSeconds: 10,
      };
    }

    if (row.consumed >= monthlyLimit) {
      return {
        ok: false,
        reason: "quota",
        consumed: row.consumed,
        retryAfterSeconds: retryAfterMonth,
      };
    }

    db.prepare(
      `UPDATE api_org_quota
       SET consumed = consumed + 1,
           in_flight = in_flight + 1,
           burst_window_start = ?,
           burst_count = ?,
           updated_at = ?
       WHERE org_id = ? AND period = ?`,
    ).run(burstWindow, burstCount + 1, now, orgId, period);

    if (key) {
      db.prepare(
        `INSERT INTO api_idempotency_keys
          (org_id, idempotency_key, status, created_at)
         VALUES (?, ?, 'pending', ?)`,
      ).run(orgId, key, now);
    }

    const next = getOrgQuotaSnapshot(orgId, now);
    return {
      ok: true,
      replay: false,
      period,
      consumed: next.consumed,
      inFlight: next.inFlight,
    };
  })();
}

export function completeOrgApiCall({
  orgId,
  idempotencyKey,
  statusCode,
  responseBody,
  now = Date.now(),
}: {
  orgId: string;
  idempotencyKey?: string;
  statusCode: number;
  responseBody?: string;
  now?: number;
}) {
  const db = getDatabase();
  const period = utcMonthPeriod(now);
  const key = normalizeIdempotencyKey(idempotencyKey);
  db.transaction(() => {
    db.prepare(
      `UPDATE api_org_quota
       SET in_flight = MAX(0, in_flight - 1), updated_at = ?
       WHERE org_id = ? AND period = ? AND in_flight > 0`,
    ).run(now, orgId, period);
    if (key) {
      const stored =
        typeof responseBody === "string" &&
        responseBody.length <= API_IDEMPOTENCY_BODY_MAX
          ? responseBody
          : JSON.stringify({
              error: "Dit verzoek is al verwerkt.",
            });
      db.prepare(
        `UPDATE api_idempotency_keys
         SET status = 'completed', status_code = ?, response_body = ?
         WHERE org_id = ? AND idempotency_key = ?`,
      ).run(statusCode, stored, orgId, key);
    }
  })();
}

export function noteOrgDenial(orgId: string, now = Date.now()) {
  const db = getDatabase();
  const period = utcMonthPeriod(now);
  const windowStart = now - (now % API_DENIAL_WINDOW_MS);
  db.prepare(
    `INSERT INTO api_org_quota (
       org_id, period, consumed, in_flight, burst_window_start, burst_count,
       denial_window_start, denial_count, denial_logs_written, updated_at
     ) VALUES (?, ?, 0, 0, 0, 0, ?, 1, 0, ?)
     ON CONFLICT(org_id, period) DO UPDATE SET
       denial_count = CASE
         WHEN api_org_quota.denial_window_start = excluded.denial_window_start
         THEN api_org_quota.denial_count + 1
         ELSE 1
       END,
       denial_window_start = excluded.denial_window_start,
       denial_logs_written = CASE
         WHEN api_org_quota.denial_window_start = excluded.denial_window_start
         THEN api_org_quota.denial_logs_written
         ELSE 0
       END,
       updated_at = excluded.updated_at`,
  ).run(orgId, period, windowStart, now);

  const row = db
    .prepare(
      `SELECT denial_count, denial_logs_written, denial_window_start
       FROM api_org_quota WHERE org_id = ? AND period = ?`,
    )
    .get(orgId, period) as {
    denial_count: number;
    denial_logs_written: number;
    denial_window_start: number;
  };

  const inWindow = row.denial_window_start === windowStart;
  const count = inWindow ? row.denial_count : 1;
  const written = inWindow ? row.denial_logs_written : 0;
  const shouldLog = written < API_DENIAL_LOG_CAP;
  if (shouldLog) {
    db.prepare(
      `UPDATE api_org_quota
       SET denial_logs_written = denial_logs_written + 1, updated_at = ?
       WHERE org_id = ? AND period = ?`,
    ).run(now, orgId, period);
  }
  if (count === API_DENIAL_ALARM_THRESHOLD || count % 200 === 0) {
    console.warn(
      `[security] hoge API-afwijzingen org=${orgId} count=${count} window=${windowStart}`,
    );
  }
  return { count, shouldLog };
}
