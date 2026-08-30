import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.EXPORT_PORT ?? "43123";
const baseUrl = `http://127.0.0.1:${port}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function waitForServer(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }
    } catch {
      // server not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start at ${url}`);
}

console.log("Building production app…");
await run("npm", ["run", "build"]);

console.log(`Starting production server on :${port}…`);
const server = spawn("npx", ["next", "start", "-p", port], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

try {
  await waitForServer(`${baseUrl}/dev/wordmark-export?mode=static`);
  process.env.WORDMARK_EXPORT_URL = baseUrl;
  await run("node", ["scripts/export-banner-assets.mjs"], {
    env: { ...process.env, WORDMARK_EXPORT_URL: baseUrl },
  });
} finally {
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), new Promise((r) => setTimeout(r, 3000))]);
}

console.log("Banner export complete (production, no dev overlay).");
