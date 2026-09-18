import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import Database from "better-sqlite3";

// Called only by the isolated smoke fixture, never with a production database.
export async function checkBackupRestore({ folder, databasePath, userId, orgId, apiToken, token, secret, encryptionSecret }) {
  const snapshot = path.join(folder, "snapshot.db");
  const restoredPath = path.join(folder, "restored.db");
  const avatarBackup = path.join(folder, "avatar.webp");
  let avatarPath;
  const source = new Database(databasePath);
  try {
    source.prepare("UPDATE api_keys SET is_active = 0 WHERE org_id = ?").run(orgId);
    source.prepare("INSERT INTO org_ai_daily_usage(org_id,day,consumed) VALUES (?, ?, 7)").run(orgId, new Date().toISOString().slice(0, 10));
    const avatar = source.prepare("SELECT profile_image_path FROM users WHERE id = ?").get(userId).profile_image_path;
    assert.equal(path.basename(avatar), avatar);
    assert(avatar.startsWith(userId), "Only the smoke account's own generated avatar may be restored");
    avatarPath = path.join(process.cwd(), ".next/standalone/data/avatars", avatar);
    copyFileSync(avatarPath, avatarBackup);
  } finally { source.close(); }
  execFileSync(process.execPath, ["scripts/backup-database.mjs", databasePath, snapshot], { stdio: "pipe", timeout: 10000 });
  // Restore into a distinct, previously absent database, not over the source.
  copyFileSync(snapshot, restoredPath);
  unlinkSync(avatarPath);
  copyFileSync(avatarBackup, avatarPath);
  const restored = new Database(restoredPath, { readonly: true });
  try {
    assert.equal(restored.pragma("integrity_check", { simple: true }), "ok");
    assert.equal(restored.prepare("SELECT SUM(consumed) AS consumed FROM api_org_quota WHERE org_id = ?").get(orgId).consumed, 3);
    assert.equal(restored.prepare("SELECT consumed FROM org_ai_daily_usage WHERE org_id = ?").get(orgId).consumed, 7);
    assert.equal(restored.prepare("SELECT is_active FROM api_keys WHERE org_id = ?").get(orgId).is_active, 0);
  } finally { restored.close(); }
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let output = "";
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(".next/standalone"), windowsHide: true,
    env: {
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port),
      APP_ORIGIN: origin, AUTH_SECRET: secret, API_KEY_ENCRYPTION_SECRET: encryptionSecret,
      DATABASE_PATH: restoredPath, TESTER_EMAILS: "smoke@example.test,second@example.test", NEXT_TELEMETRY_DISABLED: "1",
    }, stdio: ["ignore", "pipe", "pipe"],
  });
  const stopped = new Promise(resolve => { server.once("exit", resolve); server.once("error", resolve); });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { output = (output + chunk).slice(-8000); });
  try {
    const headers = { cookie: `__Host-leerkrachtentools_session=${token}`, origin };
    let session;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { session = await fetch(`${origin}/api/auth/session`, { headers, signal: AbortSignal.timeout(1000) }); if (session.status === 200) break; }
      catch { /* startup */ }
      if (server.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(session?.status, 200, output);
    assert.equal((await session.json()).userId, userId);
    const keyResponse = await fetch(`${origin}/api/account/api-keys`, { headers });
    assert.equal(keyResponse.status, 200);
    const keySettings = await keyResponse.json();
    assert.equal(keySettings.hasApiKey, true);
    assert.equal(Boolean(keySettings.credentialError), false);
    assert.equal(keySettings.model, "fixture-model");
    const revoked = await fetch(`${origin}/api/v1/goals/improve`, { method: "POST", headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" }, body: JSON.stringify({ goal: "De leerlingen tellen tot twintig" }) });
    assert.equal(revoked.status, 401);
    const avatar = await fetch(`${origin}/api/account/avatar`, { headers });
    assert.equal(avatar.status, 200);
    assert(Buffer.from(await avatar.arrayBuffer()).equals(readFileSync(avatarBackup)));
    console.log("Cold restore passed: new app instance accepts restored session, decrypts stored credential, rejects revoked key and preserves quota, AI budget and avatar.");
  } finally {
    server.kill("SIGTERM");
    const timeout = setTimeout(() => server.kill("SIGKILL"), 3000);
    await stopped; clearTimeout(timeout);
    for (const file of [snapshot, avatarBackup, restoredPath, `${restoredPath}-wal`, `${restoredPath}-shm`]) {
      try { unlinkSync(file); } catch { /* no file */ }
    }
  }
}
