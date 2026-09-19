import { cpSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import nft from "next/dist/compiled/@vercel/nft/index.js";

cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("scripts/backup-database.mjs", ".next/standalone/scripts/backup-database.mjs", { recursive: true });

cpSync("workers", ".next/standalone/workers", { recursive: true });

// The worker entrypoints are outside Next's route graph. Trace their external
// packages too, including native image/PDF dependencies loaded at runtime.
const require = createRequire(import.meta.url);
const { fileList } = await nft.nodeFileTrace([
  "workers/document.cjs", "workers/b2b.cjs", "workers/privacy-maintenance.cjs",
  require.resolve("pdf-parse"), require.resolve("word-extractor"),
], { base: process.cwd(), processCwd: process.cwd() });
for (const file of fileList) {
  if (!file.startsWith("node_modules/")) continue;
  const destination = path.join(".next/standalone", file);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(file, destination, { recursive: true, dereference: true });
}
// Native shared libraries loaded by the OS are not all visible to JS tracing.
for (const scope of ["@img", "@napi-rs"]) {
  const source = path.join("node_modules", scope);
  if (existsSync(source)) cpSync(source, path.join(".next/standalone/node_modules", scope), { recursive: true, dereference: true });
}
