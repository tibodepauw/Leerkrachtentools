import "server-only";

import {
  normalizeModuleKey,
  type ModuleConfigKey,
  TOOL_MODULE_IDS,
} from "@/lib/auth/moduleAccess";
import type { ModuleId } from "@/types";
import type { UserTier } from "@/lib/auth/tierUtils";

export const ALL_MODULE_IDS = [
  "active-lesson",
  ...TOOL_MODULE_IDS,
] as const satisfies readonly ModuleId[];

const MODULE_ID_SET = new Set<ModuleId>(ALL_MODULE_IDS);

export interface ModuleVisibilityConfig {
  globalHidden: Set<ModuleId>;
  tierHidden: Partial<Record<UserTier, Set<ModuleId>>>;
  userDenials: Map<string, Set<ModuleId>>;
  userGrants: Map<string, Set<ModuleId>>;
}

let cachedConfig: ModuleVisibilityConfig | null = null;

function isModuleId(value: ModuleId): value is ModuleId {
  return MODULE_ID_SET.has(value);
}

function parseModuleList(raw: string | undefined): Set<ModuleId> {
  if (!raw?.trim()) return new Set();

  const modules = new Set<ModuleId>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const moduleId = normalizeModuleKey(trimmed as ModuleConfigKey);
    if (isModuleId(moduleId)) {
      modules.add(moduleId);
    }
  }
  return modules;
}

function parseUserModuleMap(raw: string | undefined): Map<string, Set<ModuleId>> {
  const map = new Map<string, Set<ModuleId>>();
  if (!raw?.trim()) return map;

  for (const entry of raw.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf(":");
    if (separator <= 0) continue;

    const email = trimmed.slice(0, separator).trim().toLowerCase();
    const modules = parseModuleList(trimmed.slice(separator + 1));
    if (!email || modules.size === 0) continue;

    map.set(email, modules);
  }

  return map;
}

function parseTierHidden(
  env: Record<string, string | undefined>,
): Partial<Record<UserTier, Set<ModuleId>>> {
  const tiers = [
    "student",
    "tester",
    "partner",
    "admin",
    "unapproved",
  ] as const satisfies readonly UserTier[];

  const tierHidden: Partial<Record<UserTier, Set<ModuleId>>> = {};
  for (const tier of tiers) {
    const envKey = `HIDDEN_MODULES_${tier.toUpperCase()}`;
    const hidden = parseModuleList(env[envKey]);
    if (hidden.size > 0) {
      tierHidden[tier] = hidden;
    }
  }
  return tierHidden;
}

export function parseModuleVisibilityConfig(
  env: Record<string, string | undefined> = process.env,
): ModuleVisibilityConfig {
  return {
    globalHidden: parseModuleList(env.HIDDEN_MODULES ?? env.HIDDEN_MODULES_GLOBAL),
    tierHidden: parseTierHidden(env),
    userDenials: parseUserModuleMap(env.USER_MODULE_DENIALS),
    userGrants: parseUserModuleMap(env.USER_MODULE_GRANTS),
  };
}

export function getModuleVisibilityConfig(): ModuleVisibilityConfig {
  if (!cachedConfig) {
    cachedConfig = parseModuleVisibilityConfig();
  }
  return cachedConfig;
}

export function resetModuleVisibilityConfigForTests() {
  cachedConfig = null;
}
