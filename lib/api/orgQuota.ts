import "server-only";

import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/db/sqlite";
import { startOfNextUtcMonth, utcMonthPeriod } from "@/lib/api/utcMonth";
import {
  API_IDEMPOTENCY_BODY_MAX_BYTES,
  API_IDEMPOTENCY_ORG_STORAGE_MAX_BYTES,
  requestFingerprint,
  utf8ByteLength,
} from "@/lib/api/idempotency";

export const ORG_API_BURST_PER_MINUTE = 60;
export const ORG_API_MAX_IN_FLIGHT = 4;
export const GLOBAL_API_MAX_IN_FLIGHT = 4;
export const ORG_API_MAX_EXECUTION_MS = 45_000;
export const API_DENIAL_LOG_CAP = 8;
export const API_DENIAL_WINDOW_MS = 5 * 60 * 1000;
export const API_DENIAL_ALARM_THRESHOLD = 80;
export const API_USAGE_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const API_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const API_IDEMPOTENCY_BODY_MAX = API_IDEMPOTENCY_BODY_MAX_BYTES;
export const STALE_IN_FLIGHT_MS = ORG_API_MAX_EXECUTION_MS * 2;
export const SECURITY_EVENT_SAMPLE_CAP = API_DENIAL_LOG_CAP;

export function orgApiExecutionLimitMs() {
  const raw = Number(process.env.ORG_API_MAX_EXECUTION_MS);
  return Number.isFinite(raw) && raw >= 10 ? Math.min(raw, ORG_API_MAX_EXECUTION_MS) : ORG_API_MAX_EXECUTION_MS;
}

/**
 * Booking rules for the shared organization ledger:
 * - 401 invalid/revoked token: no reserve.
 * - 403 missing scope: no reserve.
 * - 400 JSON/schema before the handler: no reserve.
 * - Burst, org concurrency and global concurrency: 429, no monthly consume.
 * - Monthly quota: consume 1 in the same SQLite transaction that creates the lease,
 *   before the heavy handler. Failures after that keep the unit.
 * - Idempotency-Key is bound to API key + method + endpoint + body digest.
 * - Usage-log insert failures must not decrement consumed.
 */

export type OrgQuotaPeriod = ReturnType<typeof utcMonthPeriod>;

export type OrgQuotaReservation = {
  ok: true;
  replay: false;
  period: OrgQuotaPeriod;
  consumed: number;
  inFlight: number;
  leaseId: string;
  ownerToken: string;
};

export type OrgQuotaReplay = {
  ok: true;
  replay: true;
  consumed: number;
  statusCode: number;
  body: string;
};

export type OrgQuotaDeniedReason =
  | "quota"
  | "burst"
  | "org-concurrency"
  | "global-concurrency"
  | "idempotency-pending"
  | "idempotency-conflict"
  | "idempotency-expired";

export type OrgQuotaDenied = {
  ok: false;
  reason: OrgQuotaDeniedReason;
  consumed: number;
  retryAfterSeconds: number;
};

export type OrgQuotaResult = OrgQuotaReservation | OrgQuotaReplay | OrgQuotaDenied;

export { utcMonthPeriod, requestFingerprint };

type LeaseRow = { id: string; period: string; owner_token: string };

function countActiveLeases(
  orgId: string | undefined,
  now: number,
  period?: string,
) {
  const db = getDatabase();
  const staleBefore = now - STALE_IN_FLIGHT_MS;
  if (orgId && period) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS count FROM api_request_leases
         WHERE org_id = ? AND period = ? AND status = 'active' AND heartbeat_at >= ?`,
      )
      .get(orgId, period, staleBefore) as { count: number };
    return row.count;
  }
  if (orgId) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS count FROM api_request_leases
         WHERE org_id = ? AND status = 'active' AND heartbeat_at >= ?`,
      )
      .get(orgId, staleBefore) as { count: number };
    return row.count;
  }
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM api_request_leases
       WHERE status = 'active' AND heartbeat_at >= ?`,
    )
    .get(staleBefore) as { count: number };
  return row.count;
}

export function getOrgQuotaSnapshot(orgId: string, now = Date.now()) {
  const db = getDatabase();
  const period = utcMonthPeriod(now);
  const row = db
    .prepare(
      `SELECT consumed FROM api_org_quota WHERE org_id = ? AND period = ?`,
    )
    .get(orgId, period) as { consumed: number } | undefined;
  return {
    period,
    consumed: row?.consumed ?? 0,
    inFlight: countActiveLeases(orgId, now, period),
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
  db.prepare("DELETE FROM security_event_windows WHERE window_start < ?").run(
    now - API_USAGE_LOG_RETENTION_MS,
  );
  db.prepare("DELETE FROM api_idempotency_keys WHERE created_at < ?").run(
    now - API_IDEMPOTENCY_TTL_MS,
  );
  db.prepare(
    "DELETE FROM api_request_leases WHERE created_at < ? AND status != 'active'",
  ).run(now - API_IDEMPOTENCY_TTL_MS);
}

function expireStaleLeases(now: number) {
  const db = getDatabase();
  db.prepare(
    `UPDATE api_request_leases
     SET status = 'expired'
     WHERE status = 'active' AND heartbeat_at < ?`,
  ).run(now - STALE_IN_FLIGHT_MS);
  db.prepare(
    `UPDATE api_idempotency_keys
     SET status = 'expired'
     WHERE status = 'pending'
       AND lease_id IS NOT NULL
       AND lease_id IN (
         SELECT id FROM api_request_leases WHERE status = 'expired'
       )`,
  ).run();
}

function ensureQuotaRow(orgId: string, period: string, now: number) {
  getDatabase()
    .prepare(
      `INSERT INTO api_org_quota (
         org_id, period, consumed, in_flight, burst_window_start, burst_count,
         denial_window_start, denial_count, denial_logs_written, opened_at, updated_at
       ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, ?, ?)
       ON CONFLICT(org_id, period) DO NOTHING`,
    )
    .run(orgId, period, now, now);
}

export function reserveOrgApiCall({
  orgId,
  keyId,
  monthlyLimit,
  method,
  endpoint,
  requestDigest,
  idempotencyKey,
  now = Date.now(),
}: {
  orgId: string;
  keyId: string;
  monthlyLimit: number;
  method: string;
  endpoint: string;
  requestDigest: string;
  idempotencyKey?: string;
  now?: number;
}): OrgQuotaResult {
  const db = getDatabase();
  const period = utcMonthPeriod(now);
  const burstWindow = now - (now % 60_000);
  const retryAfterMonth = Math.max(
    1,
    Math.ceil((startOfNextUtcMonth(now) - now) / 1000),
  );

  return db.transaction((): OrgQuotaResult => {
    pruneApiTelemetry(now);
    expireStaleLeases(now);

    if (idempotencyKey) {
      const existing = db
        .prepare(
          `SELECT method, endpoint, request_digest, status, status_code, response_body, lease_id
           FROM api_idempotency_keys
           WHERE org_id = ? AND key_id = ? AND idempotency_key = ?`,
        )
        .get(orgId, keyId, idempotencyKey) as
        | {
            method: string;
            endpoint: string;
            request_digest: string;
            status: string;
            status_code: number | null;
            response_body: string | null;
            lease_id: string | null;
          }
        | undefined;

      if (existing) {
        const sameOperation =
          existing.method === method.toUpperCase() &&
          existing.endpoint === endpoint &&
          existing.request_digest === requestDigest;
        if (!sameOperation) {
          const snapshot = getOrgQuotaSnapshot(orgId, now);
          return {
            ok: false,
            reason: "idempotency-conflict",
            consumed: snapshot.consumed,
            retryAfterSeconds: 0,
          };
        }
        if (existing.status === "pending") {
          const snapshot = getOrgQuotaSnapshot(orgId, now);
          return {
            ok: false,
            reason: "idempotency-pending",
            consumed: snapshot.consumed,
            retryAfterSeconds: 5,
          };
        }
        if (existing.status === "expired") {
          const snapshot = getOrgQuotaSnapshot(orgId, now);
          return {
            ok: false,
            reason: "idempotency-expired",
            consumed: snapshot.consumed,
            retryAfterSeconds: 0,
          };
        }
        if (existing.status === "completed" || existing.status === "failed") {
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
    }

    ensureQuotaRow(orgId, period, now);

    const row = db
      .prepare(
        `SELECT consumed, burst_window_start, burst_count
         FROM api_org_quota WHERE org_id = ? AND period = ?`,
      )
      .get(orgId, period) as {
      consumed: number;
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

    const orgInFlight = countActiveLeases(orgId, now);
    if (orgInFlight >= ORG_API_MAX_IN_FLIGHT) {
      return {
        ok: false,
        reason: "org-concurrency",
        consumed: row.consumed,
        retryAfterSeconds: 10,
      };
    }

    const globalCount = countActiveLeases(undefined, now);
    if (globalCount >= GLOBAL_API_MAX_IN_FLIGHT) {
      const snapshot = getOrgQuotaSnapshot(orgId, now);
      return {
        ok: false,
        reason: "global-concurrency",
        consumed: snapshot.consumed,
        retryAfterSeconds: 15,
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

    const leaseId = randomUUID();
    const ownerToken = randomUUID();
    db.prepare(
      `INSERT INTO api_request_leases (
         id, org_id, period, key_id, owner_token, heartbeat_at, expires_at, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    ).run(
      leaseId,
      orgId,
      period,
      keyId,
      ownerToken,
      now,
      now + STALE_IN_FLIGHT_MS,
      now,
    );

    db.prepare(
      `UPDATE api_org_quota
       SET consumed = consumed + 1,
           in_flight = in_flight + 1,
           burst_window_start = ?,
           burst_count = ?,
           updated_at = ?
       WHERE org_id = ? AND period = ?`,
    ).run(burstWindow, burstCount + 1, now, orgId, period);

    if (idempotencyKey) {
      db.prepare(
        `INSERT INTO api_idempotency_keys (
           org_id, key_id, idempotency_key, method, endpoint, request_digest,
           lease_id, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      ).run(
        orgId,
        keyId,
        idempotencyKey,
        method.toUpperCase(),
        endpoint,
        requestDigest,
        leaseId,
        now,
      );
    }

    const next = getOrgQuotaSnapshot(orgId, now);
    return {
      ok: true,
      replay: false,
      period,
      consumed: next.consumed,
      inFlight: next.inFlight,
      leaseId,
      ownerToken,
    };
  })();
}

export function heartbeatOrgApiCall({
  leaseId,
  ownerToken,
  now = Date.now(),
}: {
  leaseId: string;
  ownerToken: string;
  now?: number;
}) {
  const updated = getDatabase()
    .prepare(
      `UPDATE api_request_leases
       SET heartbeat_at = ?, expires_at = ?
       WHERE id = ? AND owner_token = ? AND status = 'active' AND expires_at > ?`,
    )
    .run(now, now + STALE_IN_FLIGHT_MS, leaseId, ownerToken, now);
  return Number(updated.changes ?? 0) > 0;
}

function orgIdempotencyBytes(orgId: string, now: number) {
  const row = getDatabase()
    .prepare(
      `SELECT COALESCE(SUM(response_bytes), 0) AS total
       FROM api_idempotency_keys
       WHERE org_id = ? AND created_at >= ?`,
    )
    .get(orgId, now - API_IDEMPOTENCY_TTL_MS) as { total: number };
  return row.total;
}

export type OrgQuotaStoredResponse = {
  statusCode: number;
  body?: string;
};

export function completeOrgApiCall({
  orgId,
  keyId,
  leaseId,
  ownerToken,
  idempotencyKey,
  statusCode,
  responseBody,
  releaseLease = true,
  storeIdempotency = true,
  now = Date.now(),
}: {
  orgId: string;
  keyId?: string;
  leaseId?: string;
  ownerToken?: string;
  period?: string;
  idempotencyKey?: string;
  statusCode: number;
  responseBody?: string;
  releaseLease?: boolean;
  storeIdempotency?: boolean;
  now?: number;
}): OrgQuotaStoredResponse {
  const db = getDatabase();
  return db.transaction((): OrgQuotaStoredResponse => {
    if (releaseLease && leaseId && ownerToken) {
      const lease = db
        .prepare(
          `SELECT id, period FROM api_request_leases
           WHERE id = ? AND owner_token = ? AND status = 'active'`,
        )
        .get(leaseId, ownerToken) as LeaseRow | undefined;
      if (lease) {
        db.prepare(
          `UPDATE api_request_leases
           SET status = 'completed', heartbeat_at = ?
           WHERE id = ? AND owner_token = ? AND status = 'active'`,
        ).run(now, leaseId, ownerToken);
        db.prepare(
          `UPDATE api_org_quota
           SET in_flight = MAX(0, in_flight - 1), updated_at = ?
           WHERE org_id = ? AND period = ? AND in_flight > 0`,
        ).run(now, orgId, lease.period);
      }
    }

    let stored = responseBody;
    let storedStatus = statusCode;
    if (storeIdempotency && idempotencyKey && keyId) {
      if (typeof stored !== "string") {
        stored = JSON.stringify({ error: "Dit verzoek is al verwerkt." });
        if (storedStatus >= 200 && storedStatus < 300) storedStatus = 500;
      } else {
        const bytes = utf8ByteLength(stored);
        const total = orgIdempotencyBytes(orgId, now);
        if (
          bytes > API_IDEMPOTENCY_BODY_MAX_BYTES ||
          total + bytes > API_IDEMPOTENCY_ORG_STORAGE_MAX_BYTES
        ) {
          stored = JSON.stringify({
            error: "Het antwoord is te groot om idempotent te bewaren.",
            code: "idempotency_payload_too_large",
          });
          storedStatus = 413;
        }
      }
      const bytes = utf8ByteLength(stored);
      db.prepare(
        `UPDATE api_idempotency_keys
         SET status = 'completed', status_code = ?, response_body = ?, response_bytes = ?
         WHERE org_id = ? AND key_id = ? AND idempotency_key = ?
           AND status = 'pending'`,
      ).run(storedStatus, stored, bytes, orgId, keyId, idempotencyKey);
    }
    return { statusCode: storedStatus, body: stored };
  })();
}

export function noteOrgDenial(orgId: string, now = Date.now()) {
  const db = getDatabase();
  const period = utcMonthPeriod(now);
  const windowStart = now - (now % API_DENIAL_WINDOW_MS);
  pruneApiTelemetry(now);
  expireStaleLeases(now);
  db.prepare(
    `INSERT INTO api_org_quota (
       org_id, period, consumed, in_flight, burst_window_start, burst_count,
       denial_window_start, denial_count, denial_logs_written, opened_at, updated_at
     ) VALUES (?, ?, 0, 0, 0, 0, ?, 1, 0, ?, ?)
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
       END`,
  ).run(orgId, period, windowStart, now, now);

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
       SET denial_logs_written = denial_logs_written + 1
       WHERE org_id = ? AND period = ?`,
    ).run(orgId, period);
  }
  if (count === API_DENIAL_ALARM_THRESHOLD || count % 200 === 0) {
    console.warn(
      `[security] hoge API-afwijzingen org=${orgId} count=${count} window=${windowStart}`,
    );
  }
  return { count, shouldLog, shouldSampleEvents: shouldLog };
}

export function countOrgActiveLeases(orgId: string, now = Date.now()) {
  return countActiveLeases(orgId, now);
}

export function countGlobalActiveLeases(now = Date.now()) {
  return countActiveLeases(undefined, now);
}
