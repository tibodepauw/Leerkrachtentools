"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  normalizeModuleKey,
  type ModuleConfigKey,
} from "@/lib/auth/moduleAccess";
import type { ModuleId } from "@/types";

interface ModuleAccessContextValue {
  tier: string;
  accessibleModuleIds: ReadonlySet<ModuleId>;
  canAccessModule: (moduleKey: ModuleConfigKey) => boolean;
}

const ModuleAccessContext = createContext<ModuleAccessContextValue>({
  tier: "unapproved",
  accessibleModuleIds: new Set(),
  canAccessModule: () => false,
});

export function ModuleAccessProvider({
  tier,
  accessibleModuleIds,
  children,
}: {
  tier: string;
  accessibleModuleIds: readonly ModuleId[];
  children: ReactNode;
}) {
  const value = useMemo<ModuleAccessContextValue>(() => {
    const allowed = new Set(accessibleModuleIds);
    return {
      tier,
      accessibleModuleIds: allowed,
      canAccessModule: (moduleKey) =>
        allowed.has(normalizeModuleKey(moduleKey)),
    };
  }, [tier, accessibleModuleIds]);

  return (
    <ModuleAccessContext.Provider value={value}>
      {children}
    </ModuleAccessContext.Provider>
  );
}

export function useAccountTier() {
  return useContext(ModuleAccessContext).tier;
}

export function useModuleAccess() {
  return useContext(ModuleAccessContext);
}

export function useCanAccessModule(moduleKey: ModuleConfigKey) {
  return useContext(ModuleAccessContext).canAccessModule(moduleKey);
}
