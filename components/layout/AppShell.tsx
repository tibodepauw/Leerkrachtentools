"use client";

import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarMain,
} from "@/components/layout/Sidebar";
import { SidebarLayoutProvider } from "@/hooks/useSidebarLayout";

interface AccountSummary {
  email: string;
  displayName: string | null;
  tier: string;
  profileImageUrl?: string | null;
}

export function AppShell({
  account,
  children,
}: {
  account: AccountSummary;
  children: ReactNode;
}) {
  return (
    <SidebarLayoutProvider>
      <div className="min-h-screen bg-black">
        <Sidebar account={account} />
        <SidebarMain>
          <main>{children}</main>
        </SidebarMain>
      </div>
    </SidebarLayoutProvider>
  );
}
