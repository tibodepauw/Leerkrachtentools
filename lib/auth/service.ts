import "server-only";

import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  cleanExpiredAuthRecords,
  getDatabase,
} from "@/lib/auth/database";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/email/brevo";

export const SESSION_COOKIE = "leerkrachtentools_session";
const CODE_TTL = 10 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "local-development-secret-change-before-production";
  }
  throw new Error("AUTH_SECRET moet in productie minstens 32 tekens bevatten.");
}

function digest(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function isValidEmail(email: string) {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)
  );
}

export function hashRequestIp(ip: string) {
  return digest(`ip:${ip || "unknown"}`);
}

function hashCode(email: string, code: string) {
  return digest(`otp:${email}:${code}`);
}

async function sendVerificationEmail(email: string, code: string) {
  if (!isBrevoConfigured()) {
    if (process.env.NODE_ENV !== "production") return;
    throw new Error("Brevo is nog niet geconfigureerd.");
  }

  await sendBrevoEmail({
    to: email,
    subject: `${code} is je verificatiecode`,
    text: `Je verificatiecode voor Leerkrachtentools is ${code}. De code vervalt over 10 minuten. Heb je dit niet aangevraagd? Negeer dan deze e-mail.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
      <h1 style="font-size:20px">Inloggen bij Leerkrachtentools</h1>
      <p>Gebruik deze eenmalige verificatiecode:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
      <p>De code vervalt over 10 minuten. Heb je dit niet aangevraagd? Negeer dan deze e-mail.</p>
    </div>`,
  });
}

interface CountRow {
  count: number;
}

interface LatestRow {
  created_at: number;
}

export async function requestLoginCode({
  email: rawEmail,
  marketingOptIn,
  ipHash,
}: {
  email: string;
  marketingOptIn: boolean;
  ipHash: string;
}) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new Error("Vul een geldig e-mailadres in.");

  const now = Date.now();
  const db = getDatabase();
  cleanExpiredAuthRecords(now);
  const windowStart = now - 15 * 60 * 1000;

  const emailCount = db
    .prepare(
      "SELECT COUNT(*) AS count FROM login_codes WHERE email = ? AND created_at >= ?",
    )
    .get(email, windowStart) as CountRow;
  const ipCount = db
    .prepare(
      "SELECT COUNT(*) AS count FROM login_codes WHERE ip_hash = ? AND created_at >= ?",
    )
    .get(ipHash, windowStart) as CountRow;
  const latest = db
    .prepare(
      "SELECT created_at FROM login_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(email) as LatestRow | undefined;

  if (emailCount.count >= 5 || ipCount.count >= 20) {
    throw new Error("Te veel aanvragen. Probeer het over 15 minuten opnieuw.");
  }
  if (latest && now - latest.created_at < 60_000) {
    throw new Error("Wacht één minuut voordat je een nieuwe code aanvraagt.");
  }

  const code = String(randomInt(100_000, 1_000_000));
  db.prepare(
    "UPDATE login_codes SET used_at = ? WHERE email = ? AND used_at IS NULL",
  ).run(now, email);
  db.prepare(
    `INSERT INTO login_codes
      (id, email, code_hash, ip_hash, marketing_opt_in, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    email,
    hashCode(email, code),
    ipHash,
    marketingOptIn ? 1 : 0,
    now + CODE_TTL,
    now,
  );

  try {
    await sendVerificationEmail(email, code);
  } catch (error) {
    db.prepare(
      "UPDATE login_codes SET used_at = ? WHERE email = ? AND used_at IS NULL",
    ).run(Date.now(), email);
    throw error;
  }

  return {
    email,
    expiresInSeconds: CODE_TTL / 1000,
    devCode:
      process.env.NODE_ENV !== "production" && !isBrevoConfigured()
        ? code
        : undefined,
  };
}

interface CodeRow {
  id: string;
  code_hash: string;
  attempts: number;
  marketing_opt_in: number;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  tier: string;
  marketing_opt_in: number;
}

export function verifyLoginCode(emailValue: string, code: string) {
  const email = normalizeEmail(emailValue);
  if (!/^\d{6}$/.test(code)) throw new Error("De code bestaat uit 6 cijfers.");

  const db = getDatabase();
  const now = Date.now();
  cleanExpiredAuthRecords(now);
  const row = db
    .prepare(
      `SELECT id, code_hash, attempts, marketing_opt_in
       FROM login_codes
       WHERE email = ? AND used_at IS NULL AND expires_at >= ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email, now) as CodeRow | undefined;

  if (!row) throw new Error("De code is verlopen. Vraag een nieuwe code aan.");
  if (row.attempts >= 5) {
    throw new Error("Te veel mislukte pogingen. Vraag een nieuwe code aan.");
  }

  db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?").run(
    row.id,
  );
  const expected = Buffer.from(row.code_hash, "hex");
  const received = Buffer.from(hashCode(email, code), "hex");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new Error("De verificatiecode is niet correct.");
  }

  const userId = randomUUID();
  const consentAt = row.marketing_opt_in ? now : null;
  const transaction = db.transaction(() => {
    db.prepare("UPDATE login_codes SET used_at = ? WHERE id = ?").run(
      now,
      row.id,
    );
    db.prepare(
      `INSERT INTO users
        (id, email, email_verified_at, marketing_opt_in, marketing_consent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         email_verified_at = excluded.email_verified_at,
         marketing_opt_in = CASE
           WHEN excluded.marketing_opt_in = 1 THEN 1
           ELSE users.marketing_opt_in
         END,
         marketing_consent_at = CASE
           WHEN excluded.marketing_opt_in = 1 THEN excluded.marketing_consent_at
           ELSE users.marketing_consent_at
         END,
         updated_at = excluded.updated_at`,
    ).run(
      userId,
      email,
      now,
      row.marketing_opt_in,
      consentAt,
      now,
      now,
    );
  });
  transaction();

  const user = db
    .prepare(
      "SELECT id, email, display_name, tier, marketing_opt_in FROM users WHERE email = ?",
    )
    .get(email) as UserRow;
  const sessionToken = randomBytes(32).toString("base64url");
  db.prepare(
    `INSERT INTO sessions
      (token_hash, user_id, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(digest(`session:${sessionToken}`), user.id, now + SESSION_TTL, now, now);

  return {
    sessionToken,
    expiresAt: new Date(now + SESSION_TTL),
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      tier: user.tier,
      marketingOptIn: Boolean(user.marketing_opt_in),
    },
  };
}

export function getSession(token?: string) {
  if (!token) return null;
  const now = Date.now();
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT users.id, users.email, users.display_name, users.tier,
              users.marketing_opt_in, sessions.expires_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at >= ?`,
    )
    .get(digest(`session:${token}`), now) as
    | (UserRow & { expires_at: number })
    | undefined;
  if (!row) return null;

  db.prepare(
    "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?",
  ).run(now, digest(`session:${token}`));
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    tier: row.tier,
    marketingOptIn: Boolean(row.marketing_opt_in),
    expiresAt: row.expires_at,
  };
}

export function revokeSession(token?: string) {
  if (!token) return;
  getDatabase()
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .run(digest(`session:${token}`));
}
