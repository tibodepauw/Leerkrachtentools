import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { ensureFollowupSchema } from "@/lib/db/ensureFollowupSchema";
import {
  applyQuotaLedgerBackfill,
  QUOTA_LEDGER_BACKFILL_MIGRATION,
} from "@/lib/db/migrateQuotaLedgers";
import { utcMonthPeriod } from "@/lib/api/utcMonth";
import { aiBudgetSubjectFromEmail } from "@/lib/auth/aiBudgetIdentity";

function v519Database() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      tier TEXT NOT NULL DEFAULT 'unapproved',
      email_verified_at INTEGER NOT NULL,
      marketing_opt_in INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE api_organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      tier TEXT NOT NULL,
      monthly_quota INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      scopes TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at INTEGER,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE api_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      duration_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      request_id TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE user_ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE api_org_quota (
      org_id TEXT NOT NULL,
      period TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      in_flight INTEGER NOT NULL DEFAULT 0,
      burst_window_start INTEGER NOT NULL DEFAULT 0,
      burst_count INTEGER NOT NULL DEFAULT 0,
      denial_window_start INTEGER NOT NULL DEFAULT 0,
      denial_count INTEGER NOT NULL DEFAULT 0,
      denial_logs_written INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (org_id, period)
    );
    CREATE TABLE ai_budget_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  ensureFollowupSchema(db);
  return db;
}

describe("quota ledger backfill", () => {
  it("migreert een synthetische v5.19-DB herhaalbaar", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    db.prepare(
      `INSERT INTO api_organizations (id, name, contact_email, tier, monthly_quota, created_at)
       VALUES ('org-1', 'Uitgeverij', 'redactie@test.be', 'enterprise', 10, ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO api_keys (id, org_id, name, key_prefix, key_hash, scopes, created_at)
       VALUES ('key-1', 'org-1', 'legacy', 'lt_live_', 'hash', '[]', ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO api_usage_logs (key_id, endpoint, status_code, tokens_used, duration_ms, created_at)
       VALUES ('key-1', '/api/v1/curriculum/match', 200, 0, 12, ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO api_usage_logs (key_id, endpoint, status_code, tokens_used, duration_ms, created_at)
       VALUES ('key-1', '/api/v1/curriculum/match', 429, 0, 4, ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO users (id, email, tier, email_verified_at, created_at, updated_at)
       VALUES ('user-1', 'leerkracht@school.test', 'tester', ?, ?, ?)`,
    ).run(now, now, now);
    db.prepare("INSERT INTO user_ai_usage (user_id, created_at) VALUES ('user-1', ?)").run(
      now - 1_000,
    );

    const first = applyQuotaLedgerBackfill(db, now);
    expect(first.applied).toBe(true);
    const quota = db
      .prepare("SELECT consumed FROM api_org_quota WHERE org_id = ? AND period = ?")
      .get("org-1", period) as { consumed: number };
    expect(quota.consumed).toBe(1);

    const second = applyQuotaLedgerBackfill(db, now);
    expect(second.applied).toBe(false);
    const again = db
      .prepare("SELECT consumed FROM api_org_quota WHERE org_id = ? AND period = ?")
      .get("org-1", period) as { consumed: number };
    expect(again.consumed).toBe(1);
    const marker = db
      .prepare("SELECT id FROM schema_migrations WHERE id = ?")
      .get(QUOTA_LEDGER_BACKFILL_MIGRATION);
    expect(marker).toBeTruthy();
    const ai = db
      .prepare("SELECT COUNT(*) AS count FROM ai_budget_usage WHERE subject = ?")
      .get(aiBudgetSubjectFromEmail("leerkracht@school.test")) as { count: number };
    expect(ai.count).toBe(1);
    db.close();
  });
});
