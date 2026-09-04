import "server-only";

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

export function cleanExpiredAiUsage(now = Date.now()) {
  getDatabase()
    .prepare("DELETE FROM user_ai_usage WHERE created_at < ?")
    .run(now - WINDOW_MS * 2);
}

export function countRecentServerAiUsage(
  userId: string,
  now = Date.now(),
): number {
  cleanExpiredAiUsage(now);
  const row = getDatabase()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM user_ai_usage
       WHERE user_id = ? AND created_at >= ?`,
    )
    .get(userId, now - WINDOW_MS) as CountRow;
  return row.count;
}

export function recordServerAiUsage(userId: string, now = Date.now()) {
  getDatabase()
    .prepare(
      "INSERT INTO user_ai_usage (user_id, created_at) VALUES (?, ?)",
    )
    .run(userId, now);
}

export function tryReserveServerAiUsage(
  userId: string,
  limit: number,
  now = Date.now(),
): { ok: true; id: number; used: number } | { ok: false; used: number } {
  const db = getDatabase();
  return db.transaction(() => {
    const used = countRecentServerAiUsage(userId, now);
    if (used >= limit) {
      return { ok: false as const, used };
    }
    const inserted = db
      .prepare(
        "INSERT INTO user_ai_usage (user_id, created_at) VALUES (?, ?)",
      )
      .run(userId, now);
    return {
      ok: true as const,
      id: Number(inserted.lastInsertRowid),
      used,
    };
  })();
}

export function releaseServerAiUsage(id: number) {
  getDatabase()
    .prepare("DELETE FROM user_ai_usage WHERE id = ?")
    .run(id);
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
