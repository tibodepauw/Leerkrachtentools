import "server-only";

import { NextResponse } from "next/server";
import { hasModuleAccessForUser, moduleVisibilityDeniedMessage } from "@/lib/auth/moduleVisibility";
import type { ModuleId } from "@/types";

export const API_ROUTE_MODULE_IDS = {
  "/api/extract-manual": "manual-scanner",
  "/api/analyze-goals": "goal-optimizer",
  "/api/classify-goal-taxonomy": "goal-taxonomy",
  "/api/rag-curriculum": "curriculum-rag",
  "/api/rag-minimum-goals": "minimum-goals",
  "/api/format-dialogue": "dialogue-formatter",
  "/api/spellcheck": "spellcheck",
  "/api/audit-timing": "timing-check",
  "/api/audit-alignment": "alignment",
  "/api/audit-engagement": "engagement",
  "/api/full-audit": "full-audit",
  "/api/transcribe-reflection": "voice-reflection",
} as const satisfies Record<string, ModuleId>;

export function moduleAccessDeniedResponse() {
  return NextResponse.json(
    { error: moduleVisibilityDeniedMessage() },
    { status: 403 },
  );
}

export function requireModuleAccess(
  session: { tier: string; email: string },
  moduleId: ModuleId,
) {
  if (!hasModuleAccessForUser(session.tier, session.email, moduleId)) {
    return moduleAccessDeniedResponse();
  }
  return null;
}
