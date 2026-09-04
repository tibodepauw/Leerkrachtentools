import "server-only";

import { getDatabase } from "@/lib/auth/database";

const RETENTION_MS = 48 * 60 * 60 * 1000;

export class RequestRateLimitError extends Error {
  constructor(message = "Te veel aanvragen. Probeer het later opnieuw.") {
    super(message);
    this.name = "RequestRateLimitError";
  }
}

export function assertRequestRateLimit({
  scope,
  subject,
  limit,
  windowMs,
  now = Date.now(),
}: {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
  now?: number;
}) {
  const db = getDatabase();
  db.transaction(() => {
    db.prepare("DELETE FROM request_rate_events WHERE created_at < ?").run(
      now - RETENTION_MS,
    );
    const row = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM request_rate_events
         WHERE scope = ? AND subject = ? AND created_at >= ?`,
      )
      .get(scope, subject, now - windowMs) as { count: number };
    if (row.count >= limit) {
      throw new RequestRateLimitError();
    }
    db.prepare(
      `INSERT INTO request_rate_events (scope, subject, created_at)
       VALUES (?, ?, ?)`,
    ).run(scope, subject, now);
  })();
}

const activeRequests = new Map<string, number>();

export async function withRequestConcurrency<T>({
  scope,
  subject,
  limit,
  task,
}: {
  scope: string;
  subject: string;
  limit: number;
  task: () => Promise<T>;
}): Promise<T> {
  const key = `${scope}:${subject}`;
  const active = activeRequests.get(key) ?? 0;
  if (active >= limit) {
    throw new RequestRateLimitError(
      "Er lopen al meerdere zware aanvragen. Wacht tot die klaar zijn.",
    );
  }

  activeRequests.set(key, active + 1);
  try {
    return await task();
  } finally {
    const remaining = (activeRequests.get(key) ?? 1) - 1;
    if (remaining <= 0) activeRequests.delete(key);
    else activeRequests.set(key, remaining);
  }
}
