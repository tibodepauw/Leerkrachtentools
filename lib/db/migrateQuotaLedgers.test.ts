import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { ensureFollowupSchema } from "@/lib/db/ensureFollowupSchema";
import {
  applyQuotaLedgerBackfill,
  mixedPeriodConsumed,
  QUOTA_LEDGER_BACKFILL_MIGRATION,
  QUOTA_LEDGER_RECONCILE_MAX_OVERLAP,
  QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER,
  reconcileUnknownStartConsumed,
  resolveOpenedAt,
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

function seedOrg(db: Database.Database, orgId: string, keyId: string, now: number) {
  db.prepare(
    `INSERT INTO api_organizations (id, name, contact_email, tier, monthly_quota, created_at)
     VALUES (?, 'Uitgeverij', 'redactie@test.be', 'enterprise', 10, ?)`,
  ).run(orgId, now);
  db.prepare(
    `INSERT INTO api_keys (id, org_id, name, key_prefix, key_hash, scopes, created_at)
     VALUES (?, ?, 'legacy', 'lt_live_', ?, '[]', ?)`,
  ).run(keyId, orgId, `hash-${keyId}`, now);
}

function insertLog(
  db: Database.Database,
  keyId: string,
  status: number,
  createdAt: number,
) {
  db.prepare(
    `INSERT INTO api_usage_logs (key_id, endpoint, status_code, tokens_used, duration_ms, created_at)
     VALUES (?, '/api/v1/curriculum/match', ?, 0, 12, ?)`,
  ).run(keyId, status, createdAt);
}

function insertQuota(
  db: Database.Database,
  orgId: string,
  period: string,
  consumed: number,
  openedAt: number,
  now: number,
) {
  db.prepare(
    `INSERT INTO api_org_quota (
       org_id, period, consumed, in_flight, burst_window_start, burst_count,
       denial_window_start, denial_count, denial_logs_written, opened_at, updated_at
     ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?)`,
  ).run(orgId, period, consumed, openedAt, now);
}

function quotaConsumed(db: Database.Database, orgId: string, period: string) {
  return (
    db
      .prepare("SELECT consumed FROM api_org_quota WHERE org_id = ? AND period = ?")
      .get(orgId, period) as { consumed: number }
  ).consumed;
}

afterEach(() => {
  delete process.env.QUOTA_LEDGER_EPOCH_MS;
  delete process.env.QUOTA_LEDGER_RECONCILE;
});

describe("mixedPeriodConsumed", () => {
  const monthStart = Date.UTC(2026, 8, 1);
  const openedAt = monthStart + 10 * 86_400_000;

  it("telt oude logs plus het maximum van ledger en nieuwe logs", () => {
    expect(
      mixedPeriodConsumed({
        ledgerConsumed: 2,
        openedAt,
        monthStart,
        logs: [
          { statusCode: 200, createdAt: openedAt - 3_000 },
          { statusCode: 200, createdAt: openedAt - 2_000 },
          { statusCode: 200, createdAt: openedAt - 1_000 },
          { statusCode: 200, createdAt: openedAt + 1_000 },
          { statusCode: 200, createdAt: openedAt + 2_000 },
        ],
      }),
    ).toBe(5);
  });

  it("verliest geen unlogged nieuw verbruik als de ledger voorloopt op nieuwe logs", () => {
    expect(
      mixedPeriodConsumed({
        ledgerConsumed: 2,
        openedAt,
        monthStart,
        logs: [
          { statusCode: 200, createdAt: openedAt - 3_000 },
          { statusCode: 200, createdAt: openedAt - 2_000 },
          { statusCode: 200, createdAt: openedAt - 1_000 },
        ],
      }),
    ).toBe(5);
  });

  it("telt overlapping nieuwe logs niet dubbel", () => {
    const naiveSum = 2 + 3 + 2;
    const mixed = mixedPeriodConsumed({
      ledgerConsumed: 2,
      openedAt,
      monthStart,
      logs: [
        { statusCode: 200, createdAt: openedAt - 3_000 },
        { statusCode: 200, createdAt: openedAt - 2_000 },
        { statusCode: 200, createdAt: openedAt - 1_000 },
        { statusCode: 200, createdAt: openedAt + 1_000 },
        { statusCode: 200, createdAt: openedAt + 2_000 },
      ],
    });
    expect(naiveSum).toBe(7);
    expect(mixed).toBe(5);
  });

  it("negeert 4xx en 429", () => {
    expect(
      mixedPeriodConsumed({
        ledgerConsumed: 1,
        openedAt,
        monthStart,
        logs: [
          { statusCode: 200, createdAt: openedAt - 2_000 },
          { statusCode: 200, createdAt: openedAt - 1_000 },
          { statusCode: 429, createdAt: openedAt - 500 },
          { statusCode: 400, createdAt: openedAt - 400 },
          { statusCode: 401, createdAt: openedAt + 500 },
          { statusCode: 200, createdAt: openedAt + 1_000 },
        ],
      }),
    ).toBe(3);
  });

  it("weiger max(ledger, logs) als de v5.20-start onbekend is", () => {
    expect(() =>
      mixedPeriodConsumed({
        ledgerConsumed: 2,
        openedAt: 0,
        monthStart,
        logs: [
          { statusCode: 200, createdAt: monthStart + 1_000 },
          { statusCode: 200, createdAt: monthStart + 2_000 },
          { statusCode: 200, createdAt: monthStart + 3_000 },
        ],
      }),
    ).toThrow(/Unknown v5.20 start/);
  });

  it("telt logs-only of ledger-only zonder starttijd", () => {
    expect(
      mixedPeriodConsumed({
        ledgerConsumed: 0,
        openedAt: 0,
        monthStart,
        logs: [
          { statusCode: 200, createdAt: monthStart + 1_000 },
          { statusCode: 200, createdAt: monthStart + 2_000 },
        ],
      }),
    ).toBe(2);
    expect(
      mixedPeriodConsumed({
        ledgerConsumed: 4,
        openedAt: 0,
        monthStart,
        logs: [],
      }),
    ).toBe(4);
  });
});

describe("resolveOpenedAt", () => {
  const monthStart = Date.UTC(2026, 8, 1);

  it("kiest de rijwaarde boven de env-epoch", () => {
    expect(resolveOpenedAt(monthStart + 5_000, monthStart, monthStart + 1_000)).toBe(
      monthStart + 5_000,
    );
  });

  it("valt terug op QUOTA_LEDGER_EPOCH_MS als opened_at 0 is", () => {
    expect(resolveOpenedAt(0, monthStart, monthStart + 9_000)).toBe(monthStart + 9_000);
  });
});

describe("quota ledger backfill", () => {
  it("migreert een synthetische v5.19-DB herhaalbaar", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    seedOrg(db, "org-1", "key-1", now);
    insertLog(db, "key-1", 200, now);
    insertLog(db, "key-1", 429, now);
    db.prepare(
      `INSERT INTO users (id, email, tier, email_verified_at, created_at, updated_at)
       VALUES ('user-1', 'leerkracht@school.test', 'tester', ?, ?, ?)`,
    ).run(now, now, now);
    db.prepare("INSERT INTO user_ai_usage (user_id, created_at) VALUES ('user-1', ?)").run(
      now - 1_000,
    );

    const first = applyQuotaLedgerBackfill(db, now);
    expect(first.applied).toBe(true);
    expect(quotaConsumed(db, "org-1", period)).toBe(1);

    const second = applyQuotaLedgerBackfill(db, now);
    expect(second.applied).toBe(false);
    expect(quotaConsumed(db, "org-1", period)).toBe(1);
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

  it("mengt oude logs met een v5.20-ledger zonder verlies of dubbeltelling", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    const monthStart = Date.UTC(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)) - 1,
      1,
    );
    const openedAt = monthStart + 12 * 86_400_000;
    seedOrg(db, "org-mix", "key-mix", now);
    insertLog(db, "key-mix", 200, openedAt - 3_000);
    insertLog(db, "key-mix", 200, openedAt - 2_000);
    insertLog(db, "key-mix", 200, openedAt - 1_000);
    insertLog(db, "key-mix", 429, openedAt - 500);
    insertLog(db, "key-mix", 200, openedAt + 1_000);
    insertLog(db, "key-mix", 200, openedAt + 2_000);
    insertQuota(db, "org-mix", period, 2, openedAt, now);

    const naiveDoubleCount = 2 + 5;
    const result = applyQuotaLedgerBackfill(db, now);
    expect(result.applied).toBe(true);
    expect(result.orgRows).toBe(1);
    expect(quotaConsumed(db, "org-mix", period)).toBe(5);
    expect(quotaConsumed(db, "org-mix", period)).not.toBe(naiveDoubleCount);

    const again = applyQuotaLedgerBackfill(db, now);
    expect(again.applied).toBe(false);
    expect(quotaConsumed(db, "org-mix", period)).toBe(5);
    db.close();
  });

  it("houdt unlogged nieuw verbruik bij oude logs", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    const monthStart = Date.UTC(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)) - 1,
      1,
    );
    const openedAt = monthStart + 8 * 86_400_000;
    seedOrg(db, "org-gap", "key-gap", now);
    insertLog(db, "key-gap", 200, openedAt - 3_000);
    insertLog(db, "key-gap", 200, openedAt - 2_000);
    insertLog(db, "key-gap", 200, openedAt - 1_000);
    insertQuota(db, "org-gap", period, 2, openedAt, now);

    applyQuotaLedgerBackfill(db, now);
    expect(quotaConsumed(db, "org-gap", period)).toBe(5);
    expect(quotaConsumed(db, "org-gap", period)).not.toBe(3);
    db.close();
  });

  it("gebruikt de env-epoch voor gemengde rijen met opened_at 0", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    const monthStart = Date.UTC(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)) - 1,
      1,
    );
    const epoch = monthStart + 6 * 86_400_000;
    process.env.QUOTA_LEDGER_EPOCH_MS = String(epoch);
    seedOrg(db, "org-epoch", "key-epoch", now);
    insertLog(db, "key-epoch", 200, epoch - 2_000);
    insertLog(db, "key-epoch", 200, epoch - 1_000);
    insertLog(db, "key-epoch", 200, epoch - 500);
    insertLog(db, "key-epoch", 200, epoch + 1_000);
    insertQuota(db, "org-epoch", period, 2, 0, now);

    applyQuotaLedgerBackfill(db, now);
    expect(quotaConsumed(db, "org-epoch", period)).toBe(5);
    const opened = db
      .prepare("SELECT opened_at AS openedAt FROM api_org_quota WHERE org_id = ? AND period = ?")
      .get("org-epoch", period) as { openedAt: number };
    expect(opened.openedAt).toBe(epoch);
    db.close();
  });

  it("laat ledger-only organisaties op hun bestaande verbruik staan", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    seedOrg(db, "org-ledger", "key-ledger", now);
    insertQuota(db, "org-ledger", period, 7, 0, now);

    const result = applyQuotaLedgerBackfill(db, now);
    expect(result.orgRows).toBe(1);
    expect(quotaConsumed(db, "org-ledger", period)).toBe(7);
    db.close();
  });

  it("weiger drie oude gelogde calls en twee nieuwe ongelogde calls zonder starttijd", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    const monthStart = Date.UTC(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)) - 1,
      1,
    );
    seedOrg(db, "org-unknown", "key-unknown", now);
    insertLog(db, "key-unknown", 200, monthStart + 1_000);
    insertLog(db, "key-unknown", 200, monthStart + 2_000);
    insertLog(db, "key-unknown", 200, monthStart + 3_000);
    insertQuota(db, "org-unknown", period, 2, 0, now);

    const lossyMax = Math.max(2, 3);
    expect(lossyMax).toBe(3);
    expect(
      reconcileUnknownStartConsumed({
        ledgerConsumed: 2,
        monthStart,
        logs: [
          { statusCode: 200, createdAt: monthStart + 1_000 },
          { statusCode: 200, createdAt: monthStart + 2_000 },
          { statusCode: 200, createdAt: monthStart + 3_000 },
        ],
        mode: QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER,
      }),
    ).toBe(5);

    const result = applyQuotaLedgerBackfill(db, now);
    expect(result.applied).toBe(false);
    expect(result.refused).toBe(true);
    expect(result.ambiguousOrgIds).toEqual(["org-unknown"]);
    expect(quotaConsumed(db, "org-unknown", period)).toBe(2);
    const marker = db
      .prepare("SELECT id FROM schema_migrations WHERE id = ?")
      .get(QUOTA_LEDGER_BACKFILL_MIGRATION);
    expect(marker).toBeFalsy();
    db.close();
  });

  it("past sum-pre-ledger alleen toe na expliciete reconciliatie", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    const monthStart = Date.UTC(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)) - 1,
      1,
    );
    seedOrg(db, "org-unknown", "key-unknown", now);
    insertLog(db, "key-unknown", 200, monthStart + 1_000);
    insertLog(db, "key-unknown", 200, monthStart + 2_000);
    insertLog(db, "key-unknown", 200, monthStart + 3_000);
    insertQuota(db, "org-unknown", period, 2, 0, now);
    process.env.QUOTA_LEDGER_RECONCILE = QUOTA_LEDGER_RECONCILE_SUM_PRE_LEDGER;

    const result = applyQuotaLedgerBackfill(db, now);
    expect(result.applied).toBe(true);
    expect(result.refused).toBe(false);
    expect(quotaConsumed(db, "org-unknown", period)).toBe(5);
    db.close();
  });

  it("past max-overlap alleen toe na expliciete reconciliatie en kan unlogged werk laten vallen", () => {
    const db = v519Database();
    const now = Date.now();
    const period = utcMonthPeriod(now);
    const monthStart = Date.UTC(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)) - 1,
      1,
    );
    seedOrg(db, "org-overlap", "key-overlap", now);
    insertLog(db, "key-overlap", 200, monthStart + 1_000);
    insertLog(db, "key-overlap", 200, monthStart + 2_000);
    insertLog(db, "key-overlap", 200, monthStart + 3_000);
    insertQuota(db, "org-overlap", period, 2, 0, now);
    process.env.QUOTA_LEDGER_RECONCILE = QUOTA_LEDGER_RECONCILE_MAX_OVERLAP;

    const result = applyQuotaLedgerBackfill(db, now);
    expect(result.applied).toBe(true);
    expect(quotaConsumed(db, "org-overlap", period)).toBe(3);
    db.close();
  });

  it("voegt oude AI-rijen toe zonder bestaande budgetrijen te dupliceren", () => {
    const db = v519Database();
    const now = Date.now();
    const email = "meng@school.test";
    const subject = aiBudgetSubjectFromEmail(email);
    db.prepare(
      `INSERT INTO users (id, email, tier, email_verified_at, created_at, updated_at)
       VALUES ('user-mix', ?, 'tester', ?, ?, ?)`,
    ).run(email, now, now, now);
    const oldStamp = now - 3_600_000;
    const sharedStamp = now - 1_800_000;
    const extraStamp = now - 60_000;
    db.prepare("INSERT INTO user_ai_usage (user_id, created_at) VALUES ('user-mix', ?)").run(
      oldStamp,
    );
    db.prepare("INSERT INTO user_ai_usage (user_id, created_at) VALUES ('user-mix', ?)").run(
      sharedStamp,
    );
    db.prepare("INSERT INTO user_ai_usage (user_id, created_at) VALUES ('user-mix', ?)").run(
      extraStamp,
    );
    db.prepare("INSERT INTO ai_budget_usage (subject, created_at) VALUES (?, ?)").run(
      subject,
      sharedStamp,
    );
    db.prepare("INSERT INTO ai_budget_usage (subject, created_at) VALUES (?, ?)").run(
      subject,
      now - 120_000,
    );

    const result = applyQuotaLedgerBackfill(db, now);
    expect(result.applied).toBe(true);
    expect(result.aiRows).toBe(2);
    const rows = db
      .prepare(
        "SELECT created_at AS createdAt FROM ai_budget_usage WHERE subject = ? ORDER BY created_at",
      )
      .all(subject) as Array<{ createdAt: number }>;
    expect(rows.map((row) => row.createdAt)).toEqual([
      oldStamp,
      sharedStamp,
      now - 120_000,
      extraStamp,
    ]);
    expect(rows).toHaveLength(4);
    db.close();
  });

  it("PR1-04 houdt twee AI-calls in dezelfde milliseconde als twee eenheden", async () => {
    const db = v519Database();
    const now = Date.now();
    const email = "twin@school.test";
    db.prepare(
      `INSERT INTO users (id, email, tier, email_verified_at, created_at, updated_at)
       VALUES ('user-twin', ?, 'tester', ?, ?, ?)`,
    ).run(email, now, now, now);
    const stamp = now - 60_000;
    db.prepare("INSERT INTO user_ai_usage (user_id, created_at) VALUES ('user-twin', ?)").run(
      stamp,
    );
    db.prepare("INSERT INTO user_ai_usage (user_id, created_at) VALUES ('user-twin', ?)").run(
      stamp,
    );

    const result = applyQuotaLedgerBackfill(db, now);
    expect(result.applied).toBe(true);
    expect(result.aiRows).toBe(2);
    const subject = aiBudgetSubjectFromEmail(email);
    const rows = db
      .prepare(
        "SELECT created_at AS createdAt, source_event_id AS sourceEventId FROM ai_budget_usage WHERE subject = ? ORDER BY source_event_id",
      )
      .all(subject) as Array<{ createdAt: number; sourceEventId: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]?.createdAt).toBe(stamp);
    expect(rows[1]?.createdAt).toBe(stamp);
    expect(rows[0]?.sourceEventId).not.toBe(rows[1]?.sourceEventId);

    const again = applyQuotaLedgerBackfill(db, now);
    expect(again.applied).toBe(false);
    const after = db
      .prepare("SELECT COUNT(*) AS count FROM ai_budget_usage WHERE subject = ?")
      .get(subject) as { count: number };
    expect(after.count).toBe(2);
    db.close();
  });
});
