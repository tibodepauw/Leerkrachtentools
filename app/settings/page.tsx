import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/auth/AccountSettings";
import { UserStorageScope } from "@/components/auth/UserStorageScope";
import { getAppVersionInfo } from "@/lib/app/version";
import {
  getSession,
  SESSION_COOKIE,
} from "@/lib/auth/service";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Instellingen · Leerkrachtentools",
};

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const session = getSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  const appVersion = getAppVersionInfo();

  return (
    <UserStorageScope userId={session.id}>
      <AccountSettings
        userId={session.id}
        email={session.email}
      displayName={session.displayName}
      profileImageUrl={session.profileImageUrl}
      tier={session.tier}
      marketingOptIn={session.marketingOptIn}
      appVersion={appVersion.version}
      appCommit={appVersion.commit}
      githubRepo={appVersion.githubRepo}
      />
    </UserStorageScope>
  );
}
