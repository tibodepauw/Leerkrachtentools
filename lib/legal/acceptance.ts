import "server-only";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { CURRENT_TERMS } from "./terms";

export const TERMS_TEXT = JSON.stringify(CURRENT_TERMS.blocks);
export const TERMS_HASH = createHash("sha256").update(TERMS_TEXT).digest("hex");

export function ensureAcceptanceSchema(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS legal_documents (
    hash TEXT PRIMARY KEY, version TEXT NOT NULL, source_url TEXT NOT NULL, text TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS terms_acceptances (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_hash TEXT NOT NULL REFERENCES legal_documents(hash),
    accepted_at INTEGER NOT NULL, verified_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, document_hash)
  );`);
  const columns = new Set((db.prepare("PRAGMA table_info(login_codes)").all() as {name:string}[]).map(c=>c.name));
  for (const [name,type] of [["terms_hash","TEXT"],["terms_accepted_at","INTEGER"]]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE login_codes ADD COLUMN ${name} ${type}`);
  }
}

export function registerTermsDocument(db: Database.Database) {
  db.prepare("INSERT OR IGNORE INTO legal_documents (hash,version,source_url,text) VALUES (?,?,?,?)")
    .run(TERMS_HASH, CURRENT_TERMS.version, CURRENT_TERMS.source, TERMS_TEXT);
  return TERMS_HASH;
}
