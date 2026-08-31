import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { ensureDatabaseIndexes } from "@/lib/db/ensureIndexes";

let database: Database.Database | null = null;

function databasePath() {
  const configured =
    process.env.DATABASE_PATH ?? "./data/leerkrachtentools.db";
  if (configured === ":memory:") return configured;
  if (path.isAbsolute(configured)) return configured;
  return path.join(process.cwd(), "data", path.basename(configured));
}

export function getDatabase() {
  if (database) return database;

  const filename = databasePath();
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(filename), { recursive: true });
  }
  database = new Database(filename);
  if (filename !== ":memory:") {
    database.pragma("journal_mode = WAL");
  }
  database.pragma("synchronous = NORMAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      tier TEXT NOT NULL DEFAULT 'unapproved',
      email_verified_at INTEGER NOT NULL,
      marketing_opt_in INTEGER NOT NULL DEFAULT 0,
      marketing_consent_at INTEGER,
      privacy_accepted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      marketing_opt_in INTEGER NOT NULL DEFAULT 0,
      privacy_accepted INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS login_codes_email_created
      ON login_codes(email, created_at);
    CREATE INDEX IF NOT EXISTS login_codes_ip_created
      ON login_codes(ip_hash, created_at);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS user_ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS user_ai_usage_user_created
      ON user_ai_usage(user_id, created_at);
  `);
  ensureDatabaseIndexes(database);
  const userColumns = new Set(
    (
      database.prepare("PRAGMA table_info(users)").all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
  if (!userColumns.has("display_name")) {
    database.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
  }
  if (!userColumns.has("tier")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'unapproved'",
    );
  }
  if (!userColumns.has("use_own_api_keys")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN use_own_api_keys INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!userColumns.has("ai_provider")) {
    database.exec("ALTER TABLE users ADD COLUMN ai_provider TEXT");
  }
  if (!userColumns.has("ai_api_key_enc")) {
    database.exec("ALTER TABLE users ADD COLUMN ai_api_key_enc TEXT");
  }
  if (!userColumns.has("ai_model")) {
    database.exec("ALTER TABLE users ADD COLUMN ai_model TEXT");
  }
  if (!userColumns.has("ai_cloudflare_account_id")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN ai_cloudflare_account_id TEXT",
    );
  }
  if (!userColumns.has("profile_image_path")) {
    database.exec("ALTER TABLE users ADD COLUMN profile_image_path TEXT");
  }
  if (!userColumns.has("privacy_accepted_at")) {
    database.exec("ALTER TABLE users ADD COLUMN privacy_accepted_at INTEGER");
  }
  const loginCodeColumns = new Set(
    (
      database.prepare("PRAGMA table_info(login_codes)").all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
  if (!loginCodeColumns.has("privacy_accepted")) {
    database.exec(
      "ALTER TABLE login_codes ADD COLUMN privacy_accepted INTEGER NOT NULL DEFAULT 0",
    );
  }
  return database;
}

export function cleanExpiredAuthRecords(now = Date.now()) {
  const db = getDatabase();
  db.prepare(
    "DELETE FROM login_codes WHERE expires_at < ? OR created_at < ?",
  ).run(now, now - 24 * 60 * 60 * 1000);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
}
