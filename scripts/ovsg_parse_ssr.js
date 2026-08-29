#!/usr/bin/env node
/**
 * Parse embedded SvelteKit SSR-data uit een OVSG-leerlijn HTML-pagina.
 * Leest HTML van stdin, schrijft JSON naar stdout (null bij geen data).
 */
"use strict";

const fs = require("fs");

const html = fs.readFileSync(0, "utf8");
const match = html.match(/const data = (\[.*?\]);\s*\n\s*Promise/s);
if (!match) {
  process.stdout.write("null\n");
  process.exit(0);
}

// eslint-disable-next-line no-eval
const payload = eval(match[1]);
const item = payload.find((entry) => entry && entry.type === "data");
process.stdout.write(JSON.stringify(item ? item.data : null));
