import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/auth/AccountSettings";
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

  return (
    <AccountSettings
      email={session.email}
      displayName={session.displayName}
      tier={session.tier}
      marketingOptIn={session.marketingOptIn}
    />
  );
}
