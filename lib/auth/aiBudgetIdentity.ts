import "server-only";

import { createHmac } from "node:crypto";
import { getAuthSecret } from "@/lib/auth/secret";
import { normalizeEmail } from "@/lib/auth/normalizeEmail";

const AI_BUDGET_PURPOSE = "leerkrachtentools:ai-budget:v1";

function aiBudgetPepper() {
  return createHmac("sha256", getAuthSecret()).update(AI_BUDGET_PURPOSE).digest();
}

/** HMAC of a normalized email. Not reversible. Survives account delete within the usage window. */
export function aiBudgetSubjectFromEmail(email: string) {
  return createHmac("sha256", aiBudgetPepper())
    .update(normalizeEmail(email))
    .digest("hex");
}
