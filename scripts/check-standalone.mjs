import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import Database from "better-sqlite3";

// Isolated smoke test: never uses .env, production data, email or AI providers.
const folder = mkdtempSync(path.join(tmpdir(), "lt-standalone-smoke-"));
const databasePath = path.join(folder, "smoke.db");
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const secret = `smoke-only-${randomUUID()}-${randomUUID()}`;
const token = randomUUID();
const userId = randomUUID();
let output = "";
const server = spawn(process.execPath, ["server.js"], {
  cwd: path.resolve(".next/standalone"), windowsHide: true,
  env: {
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port),
    APP_ORIGIN: origin, AUTH_SECRET: secret,
    API_KEY_ENCRYPTION_SECRET: `smoke-encryption-${randomUUID()}`,
    DATABASE_PATH: databasePath, TESTER_EMAILS: "smoke@example.test", NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const stopped = new Promise((resolve) => { server.once("exit", resolve); server.once("error", resolve); });
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { output = (output + chunk).slice(-12_000); });

function pdfFixture() {
  const content = "BT /F1 12 Tf 50 100 Td (Standalone les) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => { const offset = pdf.length; pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; return offset; });
  const xref = pdf.length;
  return `${pdf}xref\n0 6\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* server is starting */ }
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, `Standalone server did not start: ${output}`);
  // getSession(null) intentionally does not open a database. An invalid test
  // cookie initializes the schema without granting access or sending email.
  await fetch(`${origin}/api/auth/session`, { headers: { cookie: "__Host-leerkrachtentools_session=smoke-schema-init" } });
  const db = new Database(databasePath);
  try {
    const now = Date.now();
    db.prepare("INSERT INTO users (id,email,tier,email_verified_at,created_at,updated_at) VALUES (?,?,'tester',?,?,?)").run(userId, "smoke@example.test", now, now, now);
    db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)").run(createHmac("sha256", secret).update(`session:${token}`).digest("hex"), userId, now + 60_000, now, now);
  } finally { db.close(); }
  const headers = { cookie: `__Host-leerkrachtentools_session=${token}`, origin };
  const session = await fetch(`${origin}/api/auth/session`, { headers });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).userId, userId);
  assert.match(session.headers.get("cache-control"), /no-store/);
  for (const [pdf, status] of [[pdfFixture(), 200], ["%PDF-invalid", 400]]) {
    const form = new FormData();
    form.append("file", new Blob([pdf], { type: "application/pdf" }), "les.pdf");
    const response = await fetch(`${origin}/api/import-lesson-document`, { method: "POST", headers, body: form, signal: AbortSignal.timeout(15_000) });
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    if (status === 200) assert.match(body.text, /Standalone les/);
  }
  assert.equal((await fetch(`${origin}/api/auth/logout`, { method: "POST", headers })).status, 200);
  assert.equal((await fetch(`${origin}/api/auth/session`, { headers })).status, 401);
  console.log("Standalone smoke passed: session, PDF parsing, malformed upload and logout.");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  server.kill("SIGTERM");
  const timer = setTimeout(() => server.kill("SIGKILL"), 3000);
  await stopped;
  clearTimeout(timer);
  for (const suffix of ["", "-wal", "-shm"]) {
    try { unlinkSync(databasePath + suffix); } catch { /* file already closed/removed */ }
  }
}
