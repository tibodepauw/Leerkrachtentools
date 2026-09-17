import Database from "better-sqlite3";
import { chmodSync, existsSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

process.umask(0o077);

const [source, destination] = process.argv.slice(2);
if (!source || !destination || !path.isAbsolute(source) || !path.isAbsolute(destination)) {
  throw new Error("Gebruik: node scripts/backup-database.mjs <absoluut databasepad> <absoluut nieuw backuppad>");
}
if (path.resolve(source) === path.resolve(destination) || existsSync(destination)) throw new Error("Backupdoel moet een nieuw bestand zijn.");
const partial = `${destination}.${randomUUID()}.partial`;
const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  await db.backup(partial);
  chmodSync(partial, 0o600);
  const restored = new Database(partial, { readonly: true, fileMustExist: true });
  try {
    const result = restored.pragma("integrity_check", { simple: true });
    if (result !== "ok") throw new Error("Backup-integriteitscontrole mislukt.");
  } finally { restored.close(); }
  renameSync(partial, destination);
  console.log("SQLite-backup gemaakt en opnieuw geopend: integrity_check=ok. Kopieer versleuteld naar opslag buiten de VM.");
} finally {
  db.close();
  if (existsSync(partial)) unlinkSync(partial);
}
