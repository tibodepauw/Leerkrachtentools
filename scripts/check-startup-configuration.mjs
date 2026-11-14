import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

// Actual standalone startup with synthetic invalid configuration. No provider,
// mail, analytics, production database or public listener is used.
const folder = mkdtempSync(path.join(tmpdir(), "lt-startup-audit-"));
const auth = "synthetic-startup-auth-secret-at-least-32-characters";
const encryption = "synthetic-startup-encryption-secret-at-least-32-characters";
// Never created: these cases must stop at validation, before any socket is used.
const socket = path.join(folder, "absent-parser.sock");
try {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = String(probe.address().port);
  await new Promise(resolve => probe.close(resolve));
  for (const [label, override] of [
    ["missing auth", { AUTH_SECRET: "" }],
    ["missing encryption", { API_KEY_ENCRYPTION_SECRET: "" }],
    ["identical secrets", { API_KEY_ENCRYPTION_SECRET: auth }],
    ["invalid origin", { APP_ORIGIN: "not-an-origin" }],
    ["public HTTP", { APP_ORIGIN: "http://synthetic.example.test" }],
    ["public parser missing", { APP_ORIGIN: "https://synthetic.example.test", TRUST_PROXY_IP_HEADERS: "true" }],
    ["public local parser flag", { APP_ORIGIN: "https://synthetic.example.test", TRUST_PROXY_IP_HEADERS: "true", ALLOW_LOCAL_DOCUMENT_WORKER: "true" }],
    ["public untrusted client IP", { APP_ORIGIN: "https://synthetic.example.test", DOCUMENT_WORKER_SOCKET: socket }],
    ["public proxy trust disabled", { APP_ORIGIN: "https://synthetic.example.test", DOCUMENT_WORKER_SOCKET: socket, TRUST_PROXY_IP_HEADERS: "false" }],
    ["public Vercel flag", { APP_ORIGIN: "https://synthetic.example.test", DOCUMENT_WORKER_SOCKET: socket, TRUST_PROXY_IP_HEADERS: "true", VERCEL: "1" }],
    ["public non-loopback listener", { APP_ORIGIN: "https://synthetic.example.test", DOCUMENT_WORKER_SOCKET: socket, TRUST_PROXY_IP_HEADERS: "true", HOSTNAME: "0.0.0.0" }],
  ]) {
    const result = spawnSync(process.execPath, ["server.js"], {
      cwd: path.resolve(".next/standalone"), encoding: "utf8", timeout: 5000,
      killSignal: "SIGKILL", maxBuffer: 32_000,
      env: { NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: port, APP_ORIGIN: "http://127.0.0.1", AUTH_SECRET: auth,
        API_KEY_ENCRYPTION_SECRET: encryption, DATABASE_PATH: path.join(folder, "synthetic.db"), NEXT_TELEMETRY_DISABLED: "1", ...override },
    });
    assert.equal(result.error, undefined, `${label}: startup must terminate within five seconds`);
    assert.equal(result.status, 1, `${label}: invalid startup must exit with failure`);
    assert.match(result.stderr, /invalid-production-config/);
    assert(!result.stderr.includes(auth) && !result.stderr.includes(encryption), "Diagnostic must not print credentials");
    console.log(`Invalid standalone startup rejected: ${label}.`);
  }
} finally { rmSync(folder, { recursive: true, force: true }); }
