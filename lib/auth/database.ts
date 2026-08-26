import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let database: Database.Database | null = null;

function databasePath() {
  const configured =
    process.env.DATABASE_PATH ?? "./data/leerkrachtentools.db";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

export function getDatabase() {
  if (database) return database;

  const filename = databasePath();
  mkdirSync(path.dirname(filename), { recursive: true });
  database = new Database(filename);
  database.pragma("journal_mode = WAL");
  database.pragma("synchronous = NORMAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      email_verified_at INTEGER NOT NULL,
      marketing_opt_in INTEGER NOT NULL DEFAULT 0,
      marketing_consent_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      marketing_opt_in INTEGER NOT NULL DEFAULT 0,
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
  `);
  return database;
}

export function cleanExpiredAuthRecords(now = Date.now()) {
  const db = getDatabase();
  db.prepare(
    "DELETE FROM login_codes WHERE expires_at < ? OR created_at < ?",
  ).run(now, now - 24 * 60 * 60 * 1000);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
}
