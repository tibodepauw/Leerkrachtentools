import { build } from "esbuild";
import path from "node:path";
await build({
  entryPoints: { document: "lib/workers/document.entry.ts", b2b: "lib/workers/b2b.entry.ts", "privacy-maintenance": "scripts/privacy-maintenance.ts" },
  outdir: "workers", outExtension: { ".js": ".cjs" },
  bundle: true, platform: "node", target: "node22", format: "cjs",
  packages: "external", alias: { "server-only": path.resolve("scripts/empty-server-only.cjs") },
  logLevel: "warning",
});
