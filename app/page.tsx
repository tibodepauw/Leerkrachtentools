import { cookies } from "next/headers";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { Dashboard } from "@/components/Dashboard";
import {
  getSession,
  SESSION_COOKIE,
} from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const session = getSession(cookieStore.get(SESSION_COOKIE)?.value);

  return session ? (
    <Dashboard
      userId={session.id}
      userEmail={session.email}
      displayName={session.displayName}
      profileImageUrl={session.profileImageUrl}
      tier={session.tier}
    />
  ) : (
    <AuthScreen />
  );
}
