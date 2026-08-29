import "server-only";

import { getDatabase } from "@/lib/auth/database";
import {
  dailyAiLimitMessage,
  dailyServerAiLimit,
  inviteOnlyMessage,
} from "@/lib/auth/tiers";
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
  | { allowed: false; status: 403 | 429; message: string };

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
  if (usesOwnAiKeys(userAiConfig)) {
    return { allowed: true, usesServerQuota: false };
  }

  const limit = dailyServerAiLimit(tier);
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
