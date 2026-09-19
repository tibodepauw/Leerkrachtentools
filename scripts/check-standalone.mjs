import assert from "node:assert/strict";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import Database from "better-sqlite3";
import JSZip from "jszip";
import sharp from "sharp";

// Isolated smoke test: never uses .env, production data, email or AI providers.
const folder = mkdtempSync(path.join(tmpdir(), "lt-standalone-smoke-"));
const databasePath = path.join(folder, "smoke.db");
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const secret = `smoke-only-${randomUUID()}-${randomUUID()}`;
const encryptionSecret = `smoke-encryption-${randomUUID()}`;
const token = randomUUID();
const secondToken = randomUUID();
const userId = randomUUID();
const orgId = randomUUID();
const apiToken = `lt_live_${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
let output = "";
const server = spawn(process.execPath, ["server.js"], {
  cwd: path.resolve(".next/standalone"), windowsHide: true,
  env: {
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port),
    APP_ORIGIN: origin, AUTH_SECRET: secret,
    ...(process.env.DOCUMENT_WORKER_SOCKET ? { DOCUMENT_WORKER_SOCKET: process.env.DOCUMENT_WORKER_SOCKET } : { ALLOW_LOCAL_DOCUMENT_WORKER: "true" }),
    API_KEY_ENCRYPTION_SECRET: encryptionSecret,
    DATABASE_PATH: databasePath, TESTER_EMAILS: "smoke@example.test,second@example.test", NEXT_TELEMETRY_DISABLED: "1",
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
    db.prepare("INSERT INTO api_organizations (id,name,contact_email,tier,monthly_quota,created_at) VALUES (?,?,?,'enterprise',100,?)").run(orgId, "Smoke", "smoke@publisher.test", now);
    db.prepare("INSERT INTO api_keys (id,org_id,name,key_prefix,key_hash,scopes,is_active,expires_at,created_at) VALUES (?,?,?,?,?,?,1,?,?)").run(randomUUID(), orgId, "smoke", apiToken.slice(0,16), createHash("sha256").update(apiToken).digest("hex"), JSON.stringify(["curriculum:match","curriculum:audit","goals:improve"]), now + 600_000, now);
    db.prepare("INSERT INTO users (id,email,tier,email_verified_at,created_at,updated_at) VALUES (?,?,'tester',?,?,?)").run(userId, "smoke@example.test", now, now, now);
    db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)").run(createHmac("sha256", secret).update(`session:${token}`).digest("hex"), userId, now + 600_000, now, now);
    const secondUserId = randomUUID();
    db.prepare("INSERT INTO users (id,email,tier,email_verified_at,created_at,updated_at) VALUES (?,?,'tester',?,?,?)").run(secondUserId, "second@example.test", now, now, now);
    db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)").run(createHmac("sha256", secret).update(`session:${secondToken}`).digest("hex"), secondUserId, now + 600_000, now, now);
  } finally { db.close(); }
  const headers = { cookie: `__Host-leerkrachtentools_session=${token}`, origin };
  const session = await fetch(`${origin}/api/auth/session`, { headers });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).userId, userId);
  assert.match(session.headers.get("cache-control"), /no-store/);
  for (const legalPath of ["/privacy?versie=2026-09-19", "/voorwaarden?versie=2026-09-13"]) {
    const legal=await fetch(origin+legalPath,{redirect:"manual"});assert.equal(legal.status,200,"Local current legal text, no old website redirect");
  }
  assert.equal((await fetch(origin+"/api/account/export")).status,401);
  const accountExport=await fetch(origin+"/api/account/export?userId=other",{headers});
  assert.equal(accountExport.status,200);assert.match(accountExport.headers.get("cache-control"),/no-store/);
  const accountData=await accountExport.text();assert.equal(JSON.parse(accountData).account.id,userId);assert.ok(!/second@example|token_hash|ai_api_key_enc/.test(accountData));
  const cleanup=JSON.parse(execFileSync(process.execPath,["workers/privacy-maintenance.cjs","cleanup","--database",databasePath],{cwd:path.resolve(".next/standalone"),encoding:"utf8",windowsHide:true}));assert.equal(cleanup.dryRun,true);

  // Test access control at the actual production HTTP boundary, including
  // middleware/proxy headers sometimes used in bypass attempts.
  const protectedPaths = ["account", "account/api-keys", "account/avatar", "account/list-models", "account/profile", "account/marketing-consent", "account/pinned-modules", "analyze-goals", "classify-goal-taxonomy", "format-dialogue", "spellcheck", "audit-timing", "audit-alignment", "audit-engagement", "full-audit", "extract-manual", "transcribe-reflection", "feedback", "rag-curriculum", "rag-minimum-goals", "import-lesson-document", "export-lesson-document", "v1/curriculum/match", "v1/curriculum/audit", "v1/goals/improve"];
  for (const route of protectedPaths) {
    const url = `${origin}/api/${route}`;
    const denied = await fetch(url, { method: "POST", headers: { origin, "content-type": "application/json", "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware", "x-nextjs-data": "1" }, body: "{}" });
    assert.equal(denied.status, 401, `Unauthenticated ${route}`);
    const csrf = await fetch(url, { method: "POST", headers: { ...headers, origin: "https://untrusted.example", "content-type": "application/json" }, body: "{}" });
    assert.equal(csrf.status, 403, `Cross-origin ${route}`);
  }
  const noOrigin = await fetch(`${origin}/api/account`, { method: "DELETE", headers: { cookie: headers.cookie } });
  assert.equal(noOrigin.status, 403);
  const bogusKey = await fetch(`${origin}/api/v1/goals/improve`, { method: "POST", headers: { authorization: "Bearer lt_live_invalid", "content-type": "application/json" }, body: "{}" });
  assert.equal(bogusKey.status, 401);
  console.log(`HTTP security passed: authentication and CSRF on ${protectedPaths.length} endpoints; forged proxy headers, missing Origin and invalid API key rejected.`);
  const { checkHttpBoundaries } = await import("./check-http-boundaries.mjs");
  await checkHttpBoundaries({ origin, token, secondToken, userId, databasePath });
  for (const [pdf, status] of [[pdfFixture(), 200], ["%PDF-invalid", 400]]) {
    const form = new FormData();
    form.append("file", new Blob([pdf], { type: "application/pdf" }), "les.pdf");
    const response = await fetch(`${origin}/api/import-lesson-document`, { method: "POST", headers, body: form, signal: AbortSignal.timeout(15_000) });
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    if (status === 200) assert.match(body.text, /Standalone les/);
  }
  if (process.argv.includes("--browser")) {
    const { checkBrowserSessions } = await import("./security-browser-checks.mjs");
    await checkBrowserSessions({ origin, token, secondToken, userId });
  }
  for (const [route, payload] of [
    ["curriculum/match", { query: "optellen tot twintig", network: "AHOVOKS", level: "basis", mode: "snel" }],
    ["curriculum/audit", { method_title: "Smoke", grade: "L1", target_goals: ["Optellen tot twintig"], lesson_units: [{ unit_id: "1", title: "Rekenen", content: "De leerlingen tellen tot twintig." }] }],
    ["goals/improve", { goal: "De leerlingen leren optellen tot twintig" }],
  ]) {
    const response = await fetch(`${origin}/api/v1/${route}`, { method: "POST", headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
    assert.equal(response.status, 200, `Isolated B2B ${route}: ${await response.text()}`);
  }
  const lesson = { topic: "Smoke export", learningArea: "Rekenen", component: "Getallen", targetGroup: "L1", materials: [], goals: [], totalMinutes: 20, educationNetwork: "GO", lessonPreparation: "De leerlingen tellen met blokken." };
  const exported = await fetch(`${origin}/api/export-lesson-document`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(lesson) });
  assert.equal(exported.status, 200);
  const docx = Buffer.from(await exported.arrayBuffer());
  assert.match(await (await JSZip.loadAsync(docx)).file("word/document.xml").async("string"), /Smoke export/);
  const docxForm = new FormData(); docxForm.append("file", new Blob([docx]), "export.docx");
  const reimported = await fetch(`${origin}/api/import-lesson-document`, { method: "POST", headers, body: docxForm });
  assert.equal(reimported.status, 200);
  assert.match((await reimported.json()).text, /Smoke export/);
  const avatar = await sharp({ create: { width: 32, height: 32, channels: 3, background: "red" } }).png().toBuffer();
  const avatarForm = new FormData(); avatarForm.append("file", new Blob([avatar], { type: "image/png" }), "avatar.png");
  assert.equal((await fetch(`${origin}/api/account/avatar`, { method: "POST", headers, body: avatarForm })).status, 200);
  const savedAvatar = await fetch(`${origin}/api/account/avatar`, { headers });
  assert.equal(savedAvatar.headers.get("content-type"), "image/webp");
  assert.equal((await sharp(Buffer.from(await savedAvatar.arrayBuffer())).metadata()).format, "webp");
  const { checkBackupRestore } = await import("./check-backup-restore.mjs");
  // Synthetic credential, never sent to a provider. Prove secret continuity
  // across a cold restore, in addition to SQLite integrity and session state.
  const savedKey = await fetch(`${origin}/api/account/api-keys`, { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ enabled: true, provider: "google", model: "fixture-model", apiKey: "synthetic-restore-fixture-key" }) });
  assert.equal(savedKey.status, 200);
  await checkBackupRestore({ folder, databasePath, userId, orgId, apiToken, token, secret, encryptionSecret });
  assert.equal((await fetch(`${origin}/api/account/avatar`, { method: "DELETE", headers })).status, 200);
  console.log("Isolated B2B routes, DOCX export/reimport and avatar normalization passed.");
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
