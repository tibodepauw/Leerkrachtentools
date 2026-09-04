import { TOOL_MODULE_IDS } from "@/lib/auth/moduleAccess";
import type { ModuleId } from "@/types";

const PINNABLE_MODULE_IDS = new Set<string>(TOOL_MODULE_IDS);
const MAX_PINNED_MODULES = TOOL_MODULE_IDS.length;

export function isPinnableModule(moduleId: string): moduleId is ModuleId {
  return PINNABLE_MODULE_IDS.has(moduleId);
}

export function parsePinnedModules(raw: unknown): ModuleId[] {
  let values: unknown[] = [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) values = parsed;
    } catch {
      return [];
    }
  } else if (Array.isArray(raw)) {
    values = raw;
  }

  const seen = new Set<string>();
  const pins: ModuleId[] = [];
  for (const value of values) {
    if (typeof value !== "string" || !PINNABLE_MODULE_IDS.has(value)) {
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    pins.push(value as ModuleId);
    if (pins.length >= MAX_PINNED_MODULES) break;
  }
  return pins;
}

export function serializePinnedModules(raw: unknown): string {
  return JSON.stringify(parsePinnedModules(raw));
}

export function pinnedModulesEqual(left: unknown, right: unknown): boolean {
  return serializePinnedModules(left) === serializePinnedModules(right);
}

/**
 * Account is the cross-device source of truth when it already has pins.
 * If the account is empty and this browser still has pins (first sync, or
 * an earlier upload never landed), keep the local list and upload it.
 */
export function reconcilePinnedModules(
  local: unknown,
  account: unknown,
): { pins: ModuleId[]; shouldUpload: boolean } {
  const localPins = parsePinnedModules(local);
  const accountPins = parsePinnedModules(account);
  if (accountPins.length === 0 && localPins.length > 0) {
    return { pins: localPins, shouldUpload: true };
  }
  return { pins: accountPins, shouldUpload: false };
}
