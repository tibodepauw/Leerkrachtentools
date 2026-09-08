import "server-only";

import { getDatabase } from "@/lib/db/sqlite";
import {
  API_DENIAL_WINDOW_MS,
  pruneApiTelemetry,
  SECURITY_EVENT_SAMPLE_CAP,
} from "@/lib/api/orgQuota";

export type SecurityEventKind =
  | "api_denied"
  | "api_quota_denied"
  | "api_burst_denied"
  | "api_scope_denied"
  | "key_revoked"
  | "otp_verify_denied"
  | "rag_rewrite_skipped"
  | "rag_rewrite_failed"
  | "rag_rewrite_ok";

export function recordSecurityEvent({
  kind,
  requestId,
  orgId,
  keyId,
  detail = "",
  now = Date.now(),
}: {
  kind: SecurityEventKind;
  requestId: string;
  orgId?: string;
  keyId?: string;
  detail?: string;
  now?: number;
}) {
  const db = getDatabase();
  const windowStart = now - (now % API_DENIAL_WINDOW_MS);
  const org = orgId ?? "";
  const detailKey = detail.slice(0, 80);

  db.transaction(() => {
    pruneApiTelemetry(now);
    db.prepare(
      `INSERT INTO security_event_windows (
         org_id, kind, detail, window_start, event_count, samples_written
       ) VALUES (?, ?, ?, ?, 1, 0)
       ON CONFLICT(org_id, kind, detail, window_start) DO UPDATE SET
         event_count = security_event_windows.event_count + 1`,
    ).run(org, kind, detailKey, windowStart);

    const window = db
      .prepare(
        `SELECT samples_written AS samples, event_count AS count
         FROM security_event_windows
         WHERE org_id = ? AND kind = ? AND detail = ? AND window_start = ?`,
      )
      .get(org, kind, detailKey, windowStart) as {
      samples: number;
      count: number;
    };

    if (window.samples >= SECURITY_EVENT_SAMPLE_CAP) {
      return;
    }

    db.prepare(
      `UPDATE security_event_windows
       SET samples_written = samples_written + 1
       WHERE org_id = ? AND kind = ? AND detail = ? AND window_start = ?`,
    ).run(org, kind, detailKey, windowStart);

    db.prepare(
      `INSERT INTO security_events
        (created_at, request_id, kind, org_id, key_id, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      now,
      requestId.slice(0, 80),
      kind,
      orgId ?? null,
      keyId ?? null,
      detail.slice(0, 300),
    );
  })();
}
