import "server-only";

import { getDatabase } from "@/lib/db/sqlite";

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
  getDatabase()
    .prepare(
      `INSERT INTO security_events
        (created_at, request_id, kind, org_id, key_id, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      now,
      requestId.slice(0, 80),
      kind,
      orgId ?? null,
      keyId ?? null,
      detail.slice(0, 300),
    );
}
