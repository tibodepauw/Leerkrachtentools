import Database from "better-sqlite3";
import path from "node:path";
import { lstatSync, realpathSync, writeFileSync } from "node:fs";
import { cleanupExpiredData } from "../lib/privacy/cleanup";
import { closeOrganization, exportOrganizationData, exportUserData } from "../lib/privacy/dataControls";
const args = process.argv.slice(2);
function flag(name: string) { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; }
function required(name: string) { const value = flag(name); if (!value || value.startsWith("--")) throw new Error(`Vereist: --${name}`); return value; }
function main() {
  const command = args[0];
  if (!command || command === "--help") {
    console.log("Offline operator tool. Existing absolute --database required. Commands: cleanup [--apply]; export-user --id ID --output ABSOLUTE_FILE; export-org --id ID --output ABSOLUTE_FILE; close-org --id ID [--apply --confirm-id ID]. Defaults to read-only/dry-run. Never use against an unverified production path."); return;
  }
  if (!["cleanup", "export-user", "export-org", "close-org"].includes(command)) throw new Error("Onbekende opdracht.");
  const filename = required("database");
  if (!path.isAbsolute(filename) || lstatSync(filename).isSymbolicLink() || !lstatSync(filename).isFile()) throw new Error("Gebruik een bestaand absoluut databasebestand, geen symlink.");
  const apply = args.includes("--apply");
  if (apply && !["cleanup", "close-org"].includes(command)) throw new Error("Export is alleen-lezen.");
  const id = command === "cleanup" ? "" : required("id");
  if (command === "close-org" && apply && required("confirm-id") !== id) throw new Error("Bevestigings-id komt niet overeen.");
  const db = new Database(realpathSync(filename), { readonly: !apply, fileMustExist: true });
  db.pragma("busy_timeout=5000");
  db.pragma("foreign_keys=ON");
  try {
    if (command === "cleanup") console.log(JSON.stringify(cleanupExpiredData(db, { apply })));
    else if (command === "close-org") console.log(JSON.stringify(closeOrganization(db, id, apply)));
    else {
      const output = required("output");
      if (!path.isAbsolute(output)) throw new Error("Gebruik een absoluut exportpad buiten de webroot.");
      // wx refuses existing files/symlinks, 0600 restricts Unix access. Windows: inherit a private directory ACL.
      const data = command === "export-user" ? exportUserData(db, id) : exportOrganizationData(db, id);
      writeFileSync(output, JSON.stringify(data, null, 2), { flag: "wx", mode: 0o600 });
      console.log("Afgeschermde export geschreven; controleer directoryrechten en verstrek alleen na identiteitscontrole. Geen gegevens verwijderd.");
    }
  } finally { db.close(); }
}
try { main(); } catch (error) {
  // Never print SQLite errors, paths, database values or stack traces.
  console.error(error instanceof Error && !('code' in error) ? error.message : "Onderhoud mislukt; controleer pad, rechten en databaseschema."); process.exitCode=1;
}
