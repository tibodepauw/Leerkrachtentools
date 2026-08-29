#!/usr/bin/env node
/**
 * Parse embedded SvelteKit SSR-data uit een OVSG-leerlijn HTML-pagina.
 * Leest HTML van stdin, schrijft JSON naar stdout (null bij geen data).
 */
import { readFileSync } from "node:fs";

const html = readFileSync(0, "utf8");
const match = html.match(/const data = (\[.*?\]);\s*\n\s*Promise/s);
if (!match) {
  process.stdout.write("null\n");
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(match[1]);
} catch {
  process.stdout.write("null\n");
  process.exit(0);
}

const item = payload.find((entry) => entry && entry.type === "data");
process.stdout.write(JSON.stringify(item ? item.data : null));
