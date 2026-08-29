import type { UserTier } from "@/lib/auth/tierUtils";
import { normalizeAccountTier } from "@/lib/auth/tierUtils";
import { tierBadgeLabel } from "@/components/shared/TierBadge";
import type { ModuleId } from "@/types";

/** Thomas More stijl in de UI; module-id in code is `dialogue-formatter`. */
export const MODULE_ALIASES = {
  "thomas-more-style": "dialogue-formatter",
} as const satisfies Record<string, ModuleId>;

export type ModuleConfigKey = ModuleId | keyof typeof MODULE_ALIASES;

export const TOOL_MODULE_IDS = [
  "manual-scanner",
  "goal-optimizer",
  "goal-taxonomy",
  "curriculum-rag",
  "minimum-goals",
  "dialogue-formatter",
  "spellcheck",
  "timing-check",
  "alignment",
  "engagement",
  "full-audit",
  "voice-reflection",
] as const satisfies readonly ModuleId[];

const FULL_ACCESS_TIERS = ["student", "tester", "admin"] as const satisfies readonly UserTier[];

const PARTNER_ACCESS_TIERS = ["partner"] as const satisfies readonly UserTier[];

const APPROVED_TIERS = [
  ...FULL_ACCESS_TIERS,
  ...PARTNER_ACCESS_TIERS,
] as const satisfies readonly UserTier[];

function tiersForModule(moduleId: ModuleId): readonly UserTier[] {
  switch (moduleId) {
    case "dialogue-formatter":
    case "engagement":
    case "voice-reflection":
      return FULL_ACCESS_TIERS;
    case "active-lesson":
    case "manual-scanner":
    case "goal-optimizer":
    case "goal-taxonomy":
    case "curriculum-rag":
    case "minimum-goals":
    case "spellcheck":
    case "timing-check":
    case "alignment":
    case "full-audit":
      return APPROVED_TIERS;
    default:
      return [];
  }
}

export const MODULE_CONFIG = Object.fromEntries(
  (
    [
      "active-lesson",
      ...TOOL_MODULE_IDS,
    ] as const satisfies readonly ModuleId[]
  ).map((moduleId) => [moduleId, [...tiersForModule(moduleId)]]),
) as Record<ModuleId, UserTier[]>;

export function normalizeModuleKey(moduleKey: ModuleConfigKey): ModuleId {
  if (moduleKey in MODULE_ALIASES) {
    return MODULE_ALIASES[moduleKey as keyof typeof MODULE_ALIASES];
  }
  return moduleKey as ModuleId;
}

export { normalizeAccountTier };

export function hasModuleAccess(tier: string, moduleKey: ModuleConfigKey) {
  const moduleId = normalizeModuleKey(moduleKey);
  const normalizedTier = normalizeAccountTier(tier);
  return MODULE_CONFIG[moduleId]?.includes(normalizedTier) ?? false;
}

export function getAccessibleModuleIds(tier: string): ModuleId[] {
  return (Object.keys(MODULE_CONFIG) as ModuleId[]).filter((moduleId) =>
    hasModuleAccess(tier, moduleId),
  );
}

export function getDefaultModuleForTier(tier: string): ModuleId | null {
  if (hasModuleAccess(tier, "active-lesson")) return "active-lesson";
  return TOOL_MODULE_IDS.find((moduleId) => hasModuleAccess(tier, moduleId)) ?? null;
}

export function moduleAccessDeniedMessage(tier: string) {
  return `Deze module is niet beschikbaar voor jouw accountniveau (${tierBadgeLabel(tier)}).`;
}
