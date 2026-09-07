import "server-only";

import { aiBudgetSubjectFromEmail } from "@/lib/auth/aiBudgetIdentity";
import { getDatabase } from "@/lib/auth/database";
import {
  dailyAiLimitMessage,
  dailyServerAiLimit,
  inviteOnlyMessage,
} from "@/lib/auth/tiers";
import { normalizeAccountTier } from "@/lib/auth/tierUtils";
import {
  getUserAiConfig,
  userAiConfigHasCredentials,
  type UserAiConfig,
} from "@/lib/ai/userCredentials";

const WINDOW_MS = 24 * 60 * 60 * 1000;

interface CountRow {
  count: number;
}

function subjectForUserId(userId: string): string | null {
  const row = getDatabase()
    .prepare("SELECT email FROM users WHERE id = ?")
    .get(userId) as { email: string } | undefined;
  if (!row?.email) return null;
  return aiBudgetSubjectFromEmail(row.email);
}

export function cleanExpiredAiUsage(now = Date.now()) {
  const cutoff = now - WINDOW_MS * 2;
  const db = getDatabase();
  db.prepare("DELETE FROM ai_budget_usage WHERE created_at < ?").run(cutoff);
  db.prepare("DELETE FROM user_ai_usage WHERE created_at < ?").run(cutoff);
}

export function countRecentServerAiUsage(
  userId: string,
  now = Date.now(),
): number {
  const subject = subjectForUserId(userId);
  if (!subject) return 0;
  return countRecentAiBudgetUsage(subject, now);
}

export function countRecentAiBudgetUsage(subject: string, now = Date.now()) {
  cleanExpiredAiUsage(now);
  const row = getDatabase()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM ai_budget_usage
       WHERE subject = ? AND created_at >= ?`,
    )
    .get(subject, now - WINDOW_MS) as CountRow;
  return row.count;
}

export function recordServerAiUsage(userId: string, now = Date.now()) {
  const subject = subjectForUserId(userId);
  if (!subject) {
    throw new Error("AI-budgetidentiteit ontbreekt voor deze gebruiker.");
  }
  recordAiBudgetUsage(subject, now);
}

export function recordAiBudgetUsage(subject: string, now = Date.now()) {
  getDatabase()
    .prepare("INSERT INTO ai_budget_usage (subject, created_at) VALUES (?, ?)")
    .run(subject, now);
}

export function tryReserveServerAiUsage(
  userId: string,
  limit: number,
  now = Date.now(),
): { ok: true; id: number; used: number } | { ok: false; used: number } {
  const subject = subjectForUserId(userId);
  if (!subject) {
    return { ok: false, used: limit };
  }
  return tryReserveAiBudgetUsage(subject, limit, now);
}

export function tryReserveAiBudgetUsage(
  subject: string,
  limit: number,
  now = Date.now(),
): { ok: true; id: number; used: number } | { ok: false; used: number } {
  const db = getDatabase();
  return db.transaction(() => {
    const used = countRecentAiBudgetUsage(subject, now);
    if (used >= limit) {
      return { ok: false as const, used };
    }
    const inserted = db
      .prepare(
        "INSERT INTO ai_budget_usage (subject, created_at) VALUES (?, ?)",
      )
      .run(subject, now);
    return {
      ok: true as const,
      id: Number(inserted.lastInsertRowid),
      used,
    };
  })();
}

export function releaseServerAiUsage(id: number) {
  const db = getDatabase();
  db.prepare("DELETE FROM ai_budget_usage WHERE id = ?").run(id);
  db.prepare("DELETE FROM user_ai_usage WHERE id = ?").run(id);
}

export function usesOwnAiKeys(userAiConfig: UserAiConfig | null) {
  return Boolean(userAiConfig && userAiConfigHasCredentials(userAiConfig));
}

export type ServerAiAccessResult =
  | { allowed: true; usesServerQuota: false }
  | {
      allowed: true;
      usesServerQuota: true;
      limit: number;
      used: number;
    }
  | { allowed: false; status: 403 | 409 | 429; message: string };

export function evaluateServerAiAccess({
  userId,
  tier,
  userAiConfig = getUserAiConfig(userId),
  now = Date.now(),
}: {
  userId: string;
  tier: string;
  userAiConfig?: UserAiConfig | null;
  now?: number;
}): ServerAiAccessResult {
  if (
    userAiConfig?.enabled &&
    !userAiConfigHasCredentials(userAiConfig)
  ) {
    return {
      allowed: false,
      status: 409,
      message:
        "Je opgeslagen API-key kon niet veilig worden gebruikt. Vul de key opnieuw in bij Instellingen.",
    };
  }

  if (usesOwnAiKeys(userAiConfig)) {
    return { allowed: true, usesServerQuota: false };
  }

  const normalizedTier = normalizeAccountTier(tier);
  const limit = dailyServerAiLimit(normalizedTier);
  if (limit === 0) {
    return {
      allowed: false,
      status: 403,
      message: inviteOnlyMessage(),
    };
  }

  const used = countRecentServerAiUsage(userId, now);
  if (used >= limit) {
    return {
      allowed: false,
      status: 429,
      message: dailyAiLimitMessage(limit),
    };
  }

  return {
    allowed: true,
    usesServerQuota: true,
    limit,
    used,
  };
}

export function trackServerAiUsageIfNeeded({
  userId,
  usesServerQuota,
  provider,
  now = Date.now(),
}: {
  userId: string;
  usesServerQuota: boolean;
  provider: string;
  now?: number;
}) {
  if (usesServerQuota && provider !== "local") {
    recordServerAiUsage(userId, now);
  }
}
