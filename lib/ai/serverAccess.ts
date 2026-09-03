import "server-only";

import { NextResponse } from "next/server";
import {
  dailyAiLimitMessage,
  isApprovedTier,
  inviteOnlyMessage,
} from "@/lib/auth/tiers";
import {
  evaluateServerAiAccess,
  releaseServerAiUsage,
  tryReserveServerAiUsage,
  type ServerAiAccessResult,
} from "@/lib/ai/usageLimits";
import type { UserAiConfig } from "@/lib/ai/userCredentials";

export function approvedTierResponse(tier: string) {
  if (isApprovedTier(tier)) return null;
  return NextResponse.json({ error: inviteOnlyMessage() }, { status: 403 });
}

export function serverAiAccessDeniedResponse(
  access: Extract<ServerAiAccessResult, { allowed: false }>,
) {
  return NextResponse.json({ error: access.message }, { status: access.status });
}

export function checkServerAiAccess({
  userId,
  tier,
  userAiConfig,
}: {
  userId: string;
  tier: string;
  userAiConfig: UserAiConfig | null;
}) {
  return evaluateServerAiAccess({ userId, tier, userAiConfig });
}

export async function runWithServerAiQuota<T extends { provider: string }>(
  access: Extract<ServerAiAccessResult, { allowed: true }>,
  userId: string,
  run: () => Promise<T>,
): Promise<{ ok: true; result: T } | { ok: false; response: NextResponse }> {
  let reservationId: number | undefined;
  if (access.usesServerQuota) {
    const reserved = tryReserveServerAiUsage(userId, access.limit);
    if (!reserved.ok) {
      return {
        ok: false,
        response: serverAiAccessDeniedResponse({
          allowed: false,
          status: 429,
          message: dailyAiLimitMessage(access.limit),
        }),
      };
    }
    reservationId = reserved.id;
  }

  try {
    const result = await run();
    if (reservationId && result.provider === "local") {
      releaseServerAiUsage(reservationId);
    }
    return { ok: true, result };
  } catch (error) {
    if (reservationId) {
      releaseServerAiUsage(reservationId);
    }
    throw error;
  }
}
