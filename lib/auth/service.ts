import { CURRENT_TERMS_VERSION } from "@/lib/legal/terms";
import { registerTermsDocument } from "@/lib/legal/acceptance";
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
import {
  hashLoginChallenge,
  isLoginChallenge,
} from "@/lib/auth/loginChallenge";
import { normalizeEmail } from "@/lib/auth/normalizeEmail";
import { parsePinnedModules } from "@/lib/auth/pinnedModules";
import { profileImageUrl } from "@/lib/auth/profileImage";
import { getAuthSecret } from "@/lib/auth/secret";
import { hasAppAccess, inviteOnlyMessage, resolveTierFromEmail } from "@/lib/auth/tiers";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/email/brevo";
import { buildVerificationEmail } from "@/lib/email/verificationEmail";
import { EmailBudgetExhaustedError } from "@/lib/email/errors";
import {
  assertRequestRateLimit,
  RequestRateLimitError,
} from "@/lib/http/rateLimit";

export { normalizeEmail };

export const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-leerkrachtentools_session"
    : "leerkrachtentools_session";
const CODE_TTL = 10 * 60 * 1000;
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const SESSION_IDLE_TTL = 24 * 60 * 60 * 1000;

function digest(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("hex");
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

  const message = buildVerificationEmail(code);
  await sendBrevoEmail({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    mailClass: "login",
  });
}

interface CountRow {
  count: number;
}

interface RecentCodeRow {
  id: string;
  created_at: number;
  expires_at: number;
  attempts: number;
  used_at: number | null;
}

export const LOGIN_CODE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_CODE_EMAIL_LIMIT = 5;
export const LOGIN_CODE_IP_LIMIT = 20;
export const LOGIN_CODE_UNTRUSTED_GLOBAL_LIMIT = 500;
export const LOGIN_CODE_RESEND_COOLDOWN_MS = 60_000;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
export const LOGIN_CODE_IP_DAY_SCOPE = "otp-request-ip-day";
export const LOGIN_CODE_IP_DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LOGIN_CODE_IP_DAILY_LIMIT_DEFAULT = 30;
export const LOGIN_CODE_EXPIRED_MESSAGE =
  "De code is verlopen. Vraag een nieuwe code aan.";

/**
 * Accepted code requests per trusted client IP per 24 hours. A campus or
 * school network shares one address, so the operator may raise the default.
 */
export function loginCodeIpDailyLimit() {
  const raw = process.env.LOGIN_CODE_IP_DAILY_LIMIT?.trim();
  if (!raw || !/^\d{1,5}$/.test(raw)) return LOGIN_CODE_IP_DAILY_LIMIT_DEFAULT;
  const parsed = Number(raw);
  return parsed >= 1 ? parsed : LOGIN_CODE_IP_DAILY_LIMIT_DEFAULT;
}

function waitUntil(timestamp: number) {
  const delay = timestamp - Date.now();
  return delay > 0
    ? new Promise<void>((resolve) => setTimeout(resolve, delay))
    : Promise.resolve();
}

type CodeReservation =
  | { kind: "replay"; expiresAt: number }
  | { kind: "issued"; id: string; code: string; allowed: boolean };

/**
 * Issues a login code bound to the requesting browser (`challenge`, the raw
 * nonce from the login-challenge cookie). There is no unbound mode.
 *
 * - A retry from the same browser within the cooldown is answered without a
 *   second e-mail while its code is still usable (double submit, second tab,
 *   lost response).
 * - Only this browser's older codes for the address are invalidated. Codes
 *   requested from another browser stay valid.
 * - The per-address cap counts all browsers. It is what bounds mail to one
 *   mailbox, so anyone can still use up the request budget of an address.
 */
export async function requestLoginCode({
  email: rawEmail,
  marketingOptIn,
  privacyAccepted,
  termsVersion,
  ipHash,
  ipTrusted,
  challenge,
  exposeDevCode = false,
}: {
  email: string;
  marketingOptIn: boolean;
  privacyAccepted: boolean;
  termsVersion?: string;
  ipHash: string;
  ipTrusted: boolean;
  challenge: string;
  exposeDevCode?: boolean;
}) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new Error("Vul een geldig e-mailadres in.");
  if (termsVersion !== CURRENT_TERMS_VERSION) throw new Error("De voorwaarden zijn bijgewerkt. Vernieuw de pagina en accepteer de getoonde versie.");
  if (!privacyAccepted) {
    throw new Error("Ga akkoord met de algemene voorwaarden om verder te gaan.");
  }
  const challengeHash = hashLoginChallenge(challenge);

  const now = Date.now();
  const responseNotBefore = now + randomInt(750, 1_001);
  const db = getDatabase();
  cleanExpiredAuthRecords(now);
  const windowStart = now - LOGIN_CODE_WINDOW_MS;
  const allowed = hasAppAccess(email);

  // One immediate transaction: concurrent requests (other tab, other worker
  // process) serialize here, and a denial leaves no counter or code row.
  const reservation = db
    .transaction((): CodeReservation => {
      const recent = db
        .prepare(
          `SELECT id, created_at, expires_at, attempts, used_at
           FROM login_codes
           WHERE email = ? AND challenge_hash = ?
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(email, challengeHash) as RecentCodeRow | undefined;
      if (recent && now - recent.created_at < LOGIN_CODE_RESEND_COOLDOWN_MS) {
        if (
          recent.used_at === null &&
          recent.attempts < LOGIN_CODE_MAX_ATTEMPTS &&
          recent.expires_at > now
        ) {
          // The same browser may have changed its choice before retrying.
          // Preserve the code and limits, but honor the latest submitted consent.
          db.prepare("UPDATE login_codes SET marketing_opt_in = ? WHERE id = ? AND used_at IS NULL")
            .run(marketingOptIn ? 1 : 0, recent.id);
          return { kind: "replay", expiresAt: recent.expires_at };
        }
        throw new RequestRateLimitError(
          "Wacht één minuut voordat je een nieuwe code aanvraagt.",
        );
      }

      const emailCount = db
        .prepare(
          "SELECT COUNT(*) AS count FROM login_codes WHERE email = ? AND created_at >= ?",
        )
        .get(email, windowStart) as CountRow;
      const ipCount = ipTrusted
        ? (db
            .prepare(
              "SELECT COUNT(*) AS count FROM login_codes WHERE ip_hash = ? AND created_at >= ?",
            )
            .get(ipHash, windowStart) as CountRow)
        : { count: 0 };
      // Without a trusted address there is no per-visitor bucket. Only the
      // emergency ceiling applies; an unknown IP never shares a daily limit.
      const globalCount = ipTrusted
        ? { count: 0 }
        : (db
            .prepare(
              "SELECT COUNT(*) AS count FROM login_codes WHERE created_at >= ?",
            )
            .get(windowStart) as CountRow);
      if (
        emailCount.count >= LOGIN_CODE_EMAIL_LIMIT ||
        ipCount.count >= LOGIN_CODE_IP_LIMIT ||
        globalCount.count >= LOGIN_CODE_UNTRUSTED_GLOBAL_LIMIT
      ) {
        throw new RequestRateLimitError(
          "Te veel aanvragen. Probeer het over 15 minuten opnieuw.",
        );
      }
      if (ipTrusted) {
        try {
          assertRequestRateLimit({
            scope: LOGIN_CODE_IP_DAY_SCOPE,
            subject: ipHash,
            limit: loginCodeIpDailyLimit(),
            windowMs: LOGIN_CODE_IP_DAY_WINDOW_MS,
            now,
          });
        } catch (error) {
          if (error instanceof RequestRateLimitError) {
            throw new RequestRateLimitError(
              "Te veel aanvragen vanaf dit netwerk. Probeer het morgen opnieuw.",
            );
          }
          throw error;
        }
      }

      const termsHash = registerTermsDocument(db);
      const id = randomUUID();
      const code = String(randomInt(100_000, 1_000_000));
      db.prepare(
        `UPDATE login_codes SET used_at = ?
         WHERE email = ? AND challenge_hash = ? AND used_at IS NULL`,
      ).run(now, email, challengeHash);
      db.prepare(
        `INSERT INTO login_codes
          (id, email, code_hash, ip_hash, challenge_hash, marketing_opt_in, privacy_accepted, expires_at, created_at, terms_hash, terms_accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        email,
        // An address without access gets a row no code can match. Requesting
        // and verifying then behave the same as for an admitted address.
        allowed
          ? hashCode(email, code)
          : digest(`otp-unmatchable:${randomBytes(32).toString("hex")}`),
        ipHash,
        challengeHash,
        marketingOptIn ? 1 : 0,
        1,
        now + CODE_TTL,
        now,
        termsHash,
        now,
      );
      return { kind: "issued", id, code, allowed };
    })
    .immediate();

  if (reservation.kind === "replay") {
    await waitUntil(responseNotBefore);
    return {
      email,
      expiresInSeconds: Math.max(
        1,
        Math.ceil((reservation.expiresAt - Date.now()) / 1000),
      ),
    };
  }

  if (!reservation.allowed) {
    await waitUntil(responseNotBefore);
    return {
      email,
      expiresInSeconds: CODE_TTL / 1000,
    };
  }

  try {
    await sendVerificationEmail(email, reservation.code);
  } catch (error) {
    if (error instanceof EmailBudgetExhaustedError) {
      // The reserved mail share depends on account existence. Neither the
      // request response nor subsequent wrong guesses may reveal that choice.
      // Retain a pending challenge with an unmatchable code, just as for an
      // address without access. It remains bounded by the normal TTL/limits.
      db.prepare("UPDATE login_codes SET code_hash = ? WHERE id = ? AND used_at IS NULL")
        .run(digest(`otp-undelivered:${randomBytes(32).toString("hex")}`), reservation.id);
      await waitUntil(responseNotBefore);
      return { email, expiresInSeconds: CODE_TTL / 1000 };
    }
    db.prepare(
      "UPDATE login_codes SET used_at = ? WHERE id = ? AND used_at IS NULL",
    ).run(Date.now(), reservation.id);
    throw error;
  }

  await waitUntil(responseNotBefore);
  const allowDevCode =
    process.env.NODE_ENV !== "production" &&
    exposeDevCode &&
    !isBrevoConfigured();
  return {
    email,
    expiresInSeconds: CODE_TTL / 1000,
    devCode: allowDevCode ? reservation.code : undefined,
  };
}

interface CodeRow {
  id: string;
  code_hash: string;
  attempts: number;
  marketing_opt_in: number;
  privacy_accepted: number;
  terms_hash: string | null;
  terms_accepted_at: number | null;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  tier: string;
  marketing_opt_in: number;
  profile_image_path?: string | null;
  pinned_modules?: string | null;
  updated_at?: number;
}

/**
 * True when this browser has a pending code for the address. Callers use it
 * to keep requests without a matching challenge away from rate-limit buckets.
 */
export function hasPendingLoginCode(emailValue: string, challenge: string) {
  if (!isLoginChallenge(challenge)) return false;
  const row = getDatabase()
    .prepare(
      `SELECT 1 FROM login_codes
       WHERE email = ? AND challenge_hash = ? AND used_at IS NULL AND expires_at >= ?
       LIMIT 1`,
    )
    .get(normalizeEmail(emailValue), hashLoginChallenge(challenge), Date.now());
  return Boolean(row);
}

/**
 * Verifies a code for the browser that requested it. Without the matching
 * `challenge` no row is selected, so nobody else's attempts are spent.
 */
export function verifyLoginCode(
  emailValue: string,
  code: string,
  challenge: string,
) {
  const email = normalizeEmail(emailValue);
  if (!/^\d{6}$/.test(code)) throw new Error("De code bestaat uit 6 cijfers.");
  if (!isLoginChallenge(challenge)) throw new Error(LOGIN_CODE_EXPIRED_MESSAGE);
  const challengeHash = hashLoginChallenge(challenge);

  const db = getDatabase();
  const now = Date.now();
  cleanExpiredAuthRecords(now);
  const row = db
    .prepare(
      `SELECT id, code_hash, attempts, marketing_opt_in, privacy_accepted, terms_hash, terms_accepted_at
       FROM login_codes
       WHERE email = ? AND challenge_hash = ? AND used_at IS NULL AND expires_at >= ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email, challengeHash, now) as CodeRow | undefined;

  if (!row) throw new Error(LOGIN_CODE_EXPIRED_MESSAGE);
  // Conditional update: parallel wrong guesses cannot exceed the cap.
  const attempt =
    row.attempts >= LOGIN_CODE_MAX_ATTEMPTS
      ? { changes: 0 }
      : db
          .prepare(
            `UPDATE login_codes SET attempts = attempts + 1
             WHERE id = ? AND attempts < ? AND used_at IS NULL`,
          )
          .run(row.id, LOGIN_CODE_MAX_ATTEMPTS);
  if (attempt.changes !== 1) {
    throw new Error("Te veel mislukte pogingen. Vraag een nieuwe code aan.");
  }
  const expected = Buffer.from(row.code_hash, "hex");
  const received = Buffer.from(hashCode(email, code), "hex");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new Error("De verificatiecode is niet correct.");
  }

  if (!row.privacy_accepted || !row.terms_hash || row.terms_accepted_at === null || !db.prepare("SELECT 1 FROM legal_documents WHERE hash = ?").get(row.terms_hash)) {
    throw new Error("Versiegebonden voorwaardenakkoord ontbreekt. Vraag een nieuwe code aan.");
  }

  const userId = randomUUID();
  const consentAt = row.marketing_opt_in ? now : null;
  const tier = resolveTierFromEmail(email);
  if (!hasAppAccess(email)) {
    db.prepare("UPDATE login_codes SET used_at = ? WHERE id = ?").run(now, row.id);
    throw new Error(inviteOnlyMessage());
  }
  const transaction = db.transaction(() => {
    const consumed = db
      .prepare(
        "UPDATE login_codes SET used_at = ? WHERE id = ? AND used_at IS NULL",
      )
      .run(now, row.id);
    if (consumed.changes !== 1) {
      throw new Error(LOGIN_CODE_EXPIRED_MESSAGE);
    }
    // The marketing choice on the login form only applies to a new account.
    // An existing account changes it through the signed-in consent route.
    db.prepare(
      `INSERT INTO users
        (id, email, tier, email_verified_at, marketing_opt_in, marketing_consent_at, privacy_accepted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         tier = excluded.tier,
         email_verified_at = excluded.email_verified_at,
         privacy_accepted_at = COALESCE(users.privacy_accepted_at, excluded.privacy_accepted_at),
         updated_at = excluded.updated_at`,
    ).run(
      userId,
      email,
      tier,
      now,
      row.marketing_opt_in,
      consentAt,
      now,
      now,
      now,
    );
    const acceptedUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as {id:string};
    db.prepare("INSERT OR IGNORE INTO terms_acceptances (user_id,document_hash,accepted_at,verified_at) VALUES (?,?,?,?)").run(acceptedUser.id, row.terms_hash, row.terms_accepted_at, now);
  });
  transaction();

  const user = db
    .prepare(
      "SELECT id, email, display_name, tier, marketing_opt_in, profile_image_path, updated_at FROM users WHERE email = ?",
    )
    .get(email) as UserRow;
  const sessionToken = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
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
      profileImageUrl: user.profile_image_path
        ? profileImageUrl(user.updated_at ?? Date.now())
        : null,
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
              users.marketing_opt_in, users.profile_image_path,
              users.pinned_modules, users.updated_at,
              sessions.expires_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?
         AND sessions.expires_at >= ?
         AND sessions.last_seen_at >= ?`,
    )
    .get(
      digest(`session:${token}`),
      now,
      now - SESSION_IDLE_TTL,
    ) as
    | (UserRow & { expires_at: number })
    | undefined;
  if (!row) return null;

  const tier = resolveTierFromEmail(row.email);
  if (!hasAppAccess(row.email)) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      digest(`session:${token}`),
    );
    return null;
  }
  if (tier !== row.tier) {
    db.prepare("UPDATE users SET tier = ?, updated_at = ? WHERE id = ?").run(
      tier,
      now,
      row.id,
    );
  }

  db.prepare(
    "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?",
  ).run(now, digest(`session:${token}`));
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    tier,
    marketingOptIn: Boolean(row.marketing_opt_in),
    profileImageUrl: row.profile_image_path
      ? profileImageUrl(row.updated_at ?? Date.now())
      : null,
    pinnedModules: parsePinnedModules(row.pinned_modules),
    expiresAt: row.expires_at,
  };
}

export function revokeSession(token?: string) {
  if (!token) return;
  getDatabase()
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .run(digest(`session:${token}`));
}
