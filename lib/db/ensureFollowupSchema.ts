import type Database from "better-sqlite3";

function columnNames(db: Database.Database, table: string) {
  return new Set(
    (
      db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    ).map((column) => column.name),
  );
}

function tableExists(db: Database.Database, table: string) {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(table) as { name: string } | undefined;
  return Boolean(row);
}

/**
 * v5.20.1 follow-up schema. Old idempotency rows keyed only by (org, key)
 * are unsafe to replay and are dropped rather than migrated.
 */
export function ensureFollowupSchema(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS org_ai_daily_usage (
    org_id TEXT NOT NULL REFERENCES api_organizations(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, day)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS api_key_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_request_leases (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      period TEXT NOT NULL,
      key_id TEXT NOT NULL,
      owner_token TEXT NOT NULL,
      heartbeat_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS api_request_leases_org_period_status
      ON api_request_leases(org_id, period, status);
    CREATE INDEX IF NOT EXISTS api_request_leases_active_heartbeat
      ON api_request_leases(status, heartbeat_at);
    CREATE INDEX IF NOT EXISTS api_request_leases_org_status_heartbeat
      ON api_request_leases(org_id, status, heartbeat_at);

    CREATE TABLE IF NOT EXISTS security_event_windows (
      org_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      detail TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      event_count INTEGER NOT NULL DEFAULT 0,
      samples_written INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (org_id, kind, detail, window_start)
    );
  `);

  const idempotencyExists = tableExists(db, "api_idempotency_keys");
  const columns = idempotencyExists
    ? columnNames(db, "api_idempotency_keys")
    : new Set<string>();
  const safeShape =
    columns.has("key_id") &&
    columns.has("method") &&
    columns.has("endpoint") &&
    columns.has("request_digest") &&
    columns.has("lease_id");

  if (idempotencyExists && !safeShape) {
    db.exec("DROP TABLE api_idempotency_keys");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_idempotency_keys (
      org_id TEXT NOT NULL,
      key_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      method TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      request_digest TEXT NOT NULL,
      lease_id TEXT,
      status TEXT NOT NULL,
      status_code INTEGER,
      response_body TEXT,
      response_bytes INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (org_id, key_id, idempotency_key)
    );

    CREATE INDEX IF NOT EXISTS api_idempotency_keys_created
      ON api_idempotency_keys(created_at);
    CREATE INDEX IF NOT EXISTS api_idempotency_keys_org_created
      ON api_idempotency_keys(org_id, created_at);
  `);

  if (tableExists(db, "api_org_quota")) {
    const quotaColumns = columnNames(db, "api_org_quota");
    if (!quotaColumns.has("opened_at")) {
      db.exec(
        "ALTER TABLE api_org_quota ADD COLUMN opened_at INTEGER NOT NULL DEFAULT 0",
      );
    }
  }

  if (tableExists(db, "ai_budget_usage")) {
    const aiColumns = columnNames(db, "ai_budget_usage");
    if (!aiColumns.has("source_event_id")) {
      db.exec("ALTER TABLE ai_budget_usage ADD COLUMN source_event_id TEXT");
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_budget_usage_source_event
        ON ai_budget_usage(source_event_id)
        WHERE source_event_id IS NOT NULL;
    `);
  }
}
