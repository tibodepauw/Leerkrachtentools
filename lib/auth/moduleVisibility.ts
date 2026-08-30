import "server-only";

import {
  hasModuleAccess,
  normalizeModuleKey,
  type ModuleConfigKey,
} from "@/lib/auth/moduleAccess";
import { normalizeAccountTier } from "@/lib/auth/tierUtils";
import {
  ALL_MODULE_IDS,
  getModuleVisibilityConfig,
} from "@/lib/auth/moduleVisibilityConfig";
import type { ModuleId } from "@/types";

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hasModuleAccessForUser(
  tier: string,
  email: string,
  moduleKey: ModuleConfigKey,
): boolean {
  const moduleId = normalizeModuleKey(moduleKey);
  return resolveAccessibleModuleIds(tier, email).includes(moduleId);
}

export function resolveAccessibleModuleIds(
  tier: string,
  email: string,
): ModuleId[] {
  const normalizedTier = normalizeAccountTier(tier);
  const config = getModuleVisibilityConfig();
  const emailKey = normalizedEmail(email);

  return ALL_MODULE_IDS.filter((moduleId) => {
    const tierAllows = hasModuleAccess(normalizedTier, moduleId);
    const granted = config.userGrants.get(emailKey)?.has(moduleId) ?? false;
    if (!tierAllows && !granted) {
      return false;
    }

    if (config.globalHidden.has(moduleId)) {
      return false;
    }

    if (config.tierHidden[normalizedTier]?.has(moduleId)) {
      return false;
    }

    if (config.userDenials.get(emailKey)?.has(moduleId)) {
      return false;
    }

    return true;
  });
}

export function moduleVisibilityDeniedMessage() {
  return "Deze module is niet beschikbaar voor jouw account.";
}
