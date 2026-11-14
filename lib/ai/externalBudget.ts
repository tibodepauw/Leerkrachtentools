import "server-only";
import { getDatabase } from "@/lib/db/sqlite";

const limits = {
  "server-ai": ["SERVER_AI_DAILY_CALL_LIMIT", 500],
  discovery: ["DISCOVERY_DAILY_CALL_LIMIT", 1000],
  email: ["BREVO_DAILY_EMAIL_LIMIT", 500],
} as const;

type Service = keyof typeof limits;

/** Mail to an address that already owns an account may use the whole budget.
 * Every other mail (first login, feedback, unclassified) is "general". */
export type EmailBudgetClass = "account-login" | "general";

const EMAIL_GENERAL = "email-general";
const DISCOVERY_SUBJECT_PREFIX = "discovery-subject:";
const DISCOVERY_USER_LIMIT = ["DISCOVERY_USER_DAILY_CALL_LIMIT", 100] as const;
const SUBJECT_PATTERN = /^[a-f0-9]{64}$/u;

function configuredLimit([name, fallback]: readonly [string, number]) {
  const raw = process.env[name];
  const limit = raw === undefined ? fallback : Number(raw);
  return Number.isSafeInteger(limit) && limit > 0 ? limit : 0;
}

function utcDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

/** Share of the mail budget that only account-login mail may use: 20 %,
 * at least one mail, so the reserve also exists for very small limits. */
export function emailAccountLoginReserve(limit: number) {
  return Math.min(limit, Math.max(1, Math.ceil(limit * 0.2)));
}

/** Atomically reserves one unit on every listed counter, or none at all.
 * One IMMEDIATE transaction, so the ceilings hold across processes sharing the database. */
function reserve(counters: ReadonlyArray<readonly [counter: string, ceiling: number]>, now: number) {
  if (counters.some(([, ceiling]) => !Number.isSafeInteger(ceiling) || ceiling <= 0)) return false;
  const day = utcDay(now);
  const db = getDatabase();
  return db.transaction(() => {
    db.prepare("DELETE FROM external_daily_usage WHERE day < ?").run(utcDay(now - 7 * 86_400_000));
    const read = db.prepare("SELECT consumed FROM external_daily_usage WHERE service = ? AND day = ?");
    for (const [counter, ceiling] of counters) {
      const row = read.get(counter, day) as { consumed: number } | undefined;
      if ((row?.consumed ?? 0) >= ceiling) return false;
    }
    const increment = db.prepare(`INSERT INTO external_daily_usage(service, day, consumed) VALUES (?, ?, 1)
      ON CONFLICT(service, day) DO UPDATE SET consumed = consumed + 1`);
    for (const [counter] of counters) increment.run(counter, day);
    return true;
  }).immediate();
}

/** One reservation per attempted remote call, including failed/fallback calls.
 * Shared by web and B2B processes using the same database. No prompt or key is stored.
 * Counts calls, not euros; provider-side spending limits are still required.
 * Mail and Discovery have their own entry points below, so their extra ceilings cannot be skipped.
 */
export function reserveExternalCall(service: "server-ai", now = Date.now()) {
  return reserve([[service, configuredLimit(limits[service])]], now);
}

/** Reserves one mail attempt (failed and uncertain sends are never refunded).
 * The global ceiling applies to every mail. General mail additionally stops at
 * limit minus the account-login reserve, so anonymous first logins and feedback
 * cannot exhaust the part kept for existing accounts. The reserve is carved out
 * of BREVO_DAILY_EMAIL_LIMIT; it never adds budget.
 */
export function reserveEmailSend(mailClass: EmailBudgetClass, now = Date.now()) {
  const limit = configuredLimit(limits.email);
  if (limit <= 0) return false;
  const service: Service = "email";
  if (mailClass === "account-login") return reserve([[service, limit]], now);
  return reserve(
    [
      [service, limit],
      [EMAIL_GENERAL, limit - emailAccountLoginReserve(limit)],
    ],
    now,
  );
}

/** Reserves one new outbound Discovery search for a user.
 * `subject` must be the stable pseudonymous budget subject (HMAC of the
 * normalized e-mail, see aiBudgetIdentity), so deleting and recreating an
 * account does not reset the counter. A missing or malformed subject is
 * refused: no identity never means no per-user ceiling.
 */
export function reserveDiscoveryCall(subject: unknown, now = Date.now()) {
  if (typeof subject !== "string" || !SUBJECT_PATTERN.test(subject)) return false;
  const limit = configuredLimit(limits.discovery);
  const userLimit = Math.min(limit, configuredLimit(DISCOVERY_USER_LIMIT));
  const service: Service = "discovery";
  return reserve(
    [
      [service, limit],
      [`${DISCOVERY_SUBJECT_PREFIX}${subject}`, userLimit],
    ],
    now,
  );
}
