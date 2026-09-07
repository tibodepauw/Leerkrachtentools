import "server-only";

import { dailyServerAiLimit } from "@/lib/auth/tiers";
import {
  releaseServerAiUsage,
  tryReserveServerAiUsage,
  usesOwnAiKeys,
} from "@/lib/ai/usageLimits";
import { getUserAiConfig } from "@/lib/ai/userCredentials";
import {
  resolveRagSearchQuery,
  type QueryRewriteResult,
} from "@/lib/rag/queryRewriter";

export async function resolveTrackedRagSearchQuery({
  query,
  enableLlmQueryRewriting,
  userId,
  tier,
  requestId,
}: {
  query: string;
  enableLlmQueryRewriting: boolean;
  userId: string;
  tier: string;
  requestId?: string;
}): Promise<{
  searchQuery: string;
  rewrite: QueryRewriteResult | null;
}> {
  if (!enableLlmQueryRewriting) {
    return { searchQuery: query, rewrite: null };
  }

  const userAiConfig = getUserAiConfig(userId);
  if (usesOwnAiKeys(userAiConfig)) {
    return resolveRagSearchQuery(query, true, { userId, requestId });
  }

  if (userAiConfig?.enabled) {
    return { searchQuery: query, rewrite: null };
  }

  const limit = dailyServerAiLimit(tier);
  if (limit === 0) {
    return { searchQuery: query, rewrite: null };
  }

  const reserved = tryReserveServerAiUsage(userId, limit);
  if (!reserved.ok) {
    return { searchQuery: query, rewrite: null };
  }

  try {
    const resolved = await resolveRagSearchQuery(query, true, {
      userId,
      requestId,
    });
    if (!resolved.rewrite?.dispatched) {
      releaseServerAiUsage(reserved.id);
    }
    return resolved;
  } catch (error) {
    releaseServerAiUsage(reserved.id);
    throw error;
  }
}
