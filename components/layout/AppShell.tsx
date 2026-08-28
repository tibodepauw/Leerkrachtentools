import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

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
    <div className="min-h-screen bg-black">
      <Sidebar account={account} />
      <div className="lg:pl-64">
        <main>{children}</main>
      </div>
    </div>
  );
}
