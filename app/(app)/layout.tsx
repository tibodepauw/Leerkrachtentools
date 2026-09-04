import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ModuleAccessProvider } from "@/components/auth/ModuleAccessProvider";
import { UserStorageScope } from "@/components/auth/UserStorageScope";
import { resolveAccessibleModuleIds } from "@/lib/auth/moduleVisibility";
import { getSession, SESSION_COOKIE } from "@/lib/auth/service";

export default async function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const session = getSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) {
    return children;
  }

  return (
    <UserStorageScope
      userId={session.id}
      accountPinnedModules={session.pinnedModules}
    >
      <ModuleAccessProvider
        tier={session.tier}
        accessibleModuleIds={resolveAccessibleModuleIds(
          session.tier,
          session.email,
        )}
      >
        {children}
      </ModuleAccessProvider>
    </UserStorageScope>
  );
}
