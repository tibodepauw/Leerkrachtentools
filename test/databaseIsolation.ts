import { afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDatabase } from "@/lib/db/sqlite";

// Each test file gets its own real SQLite database, also passed to subprocesses.
// Cross-file quota cleanup and schema writes must not affect another suite.
const directory = mkdtempSync(path.join(tmpdir(), "lt-suite-db-"));
process.env.DATABASE_PATH = path.join(directory, "suite.db");
afterAll(() => {
  closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});
