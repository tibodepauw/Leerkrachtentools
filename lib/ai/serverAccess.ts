import "server-only";

import { NextResponse } from "next/server";
import { isApprovedTier, inviteOnlyMessage } from "@/lib/auth/tiers";
import {
  evaluateServerAiAccess,
  trackServerAiUsageIfNeeded,
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

export { trackServerAiUsageIfNeeded };
