import { cpSync } from "node:fs";

cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("scripts/backup-database.mjs", ".next/standalone/scripts/backup-database.mjs", { recursive: true });
