"use client";

import { createContext, useContext, type ReactNode } from "react";

const ModuleAccessContext = createContext<string>("unapproved");

export function ModuleAccessProvider({
  tier,
  children,
}: {
  tier: string;
  children: ReactNode;
}) {
  return (
    <ModuleAccessContext.Provider value={tier}>
      {children}
    </ModuleAccessContext.Provider>
  );
}

export function useAccountTier() {
  return useContext(ModuleAccessContext);
}
