"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProfileAvatar } from "@/components/shared/ProfileAvatar";
import { tierBadgeLabel, tierInviteOnlyHint } from "@/components/shared/TierBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { detachClientUserStorage } from "@/lib/storage/clientUserSession";
import { ApiKeysSettings } from "@/components/auth/ApiKeysSettings";
import { LoaderSettingsView } from "@/components/settings/LoaderSettingsView";
import { SettingsView } from "@/components/settings/SettingsView";

interface AccountSettingsProps {
  userId: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
  tier: string;
  marketingOptIn: boolean;
  appVersion: string;
  appCommit: string | null;
  githubRepo: string | null;
}

export function AccountSettings({
  userId,
  email,
  displayName: initialDisplayName,
  profileImageUrl: initialProfileImageUrl,
  tier,
  marketingOptIn: initialMarketingOptIn,
  appVersion,
  appCommit,
  githubRepo,
}: AccountSettingsProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [profileImageUrl, setProfileImageUrl] = useState(initialProfileImageUrl);
  const [marketingOptIn, setMarketingOptIn] = useState(
    initialMarketingOptIn,
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const payload = (await response.json()) as {
      error?: string;
      displayName?: string;
    };
    setSavingProfile(false);
    if (!response.ok) {
      toast.error(payload.error ?? "Profiel kon niet worden opgeslagen.");
      return;
    }
    toast.success("Profielnaam opgeslagen.");
  }

  async function updateConsent(checked: boolean) {
    const previous = marketingOptIn;
    setMarketingOptIn(checked);
    setSavingConsent(true);
    const response = await fetch("/api/account/marketing-consent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketingOptIn: checked }),
    });
    setSavingConsent(false);
    if (!response.ok) {
      setMarketingOptIn(previous);
      toast.error("Voorkeur kon niet worden opgeslagen.");
      return;
    }
    toast.success("E-mailvoorkeur bijgewerkt.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    detachClientUserStorage();
    router.push("/");
    router.refresh();
  }

  async function deleteAccount() {
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      toast.error("Account kon niet worden verwijderd.");
      return;
    }
    detachClientUserStorage();
    router.push("/");
    router.refresh();
  }

  return (
    <AppShell
      account={{
        email,
        displayName,
        tier,
        profileImageUrl,
      }}
    >
      <div className="w-full p-4 lg:p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight">Instellingen</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Beheer je profiel, status, API-keys en privacy.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profiel</CardTitle>
              <CardDescription>
                Pas je naam en profielfoto aan. Je foto verschijnt in het
                accountmenu links onderaan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Profielfoto</Label>
                <ProfileAvatar
                  email={email}
                  displayName={displayName}
                  profileImageUrl={profileImageUrl}
                  editable
                  layout="stacked"
                  onProfileImageChange={setProfileImageUrl}
                />
              </div>
              <form onSubmit={saveProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Naam</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    minLength={2}
                    maxLength={60}
                    placeholder="Voornaam en naam"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-email">E-mailadres</Label>
                  <Input id="account-email" value={email} readOnly disabled />
                  <p className="text-xs text-neutral-500">Je geverifieerde loginadres kan momenteel niet worden gewijzigd.</p>
                </div>
                <Button disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Profiel opslaan
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>
                Je toegangsniveau en geïnstalleerde appversie.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-neutral-800 p-3">
                <dl
                  className={cn(
                    "grid gap-3",
                    appCommit ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3",
                  )}
                >
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-600">
                      Versie
                    </dt>
                    <dd className="mt-1 font-mono text-sm text-neutral-200">
                      v{appVersion}
                    </dd>
                  </div>
                  {appCommit ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-neutral-600">
                        Build
                      </dt>
                      <dd className="mt-1 font-mono text-sm text-neutral-200">
                        {appCommit}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-600">
                      Niveau
                    </dt>
                    <dd className="mt-1 space-y-1">
                      <p className="text-sm font-normal text-white">
                        {tierBadgeLabel(tier)}
                      </p>
                      {tierInviteOnlyHint(tier) ? (
                        <p className="text-xs leading-5 text-neutral-500">
                          {tierInviteOnlyHint(tier)}
                        </p>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-600">
                      Account-ID
                    </dt>
                    <dd className="mt-1 break-all font-mono text-xs text-neutral-200">
                      {userId}
                    </dd>
                  </div>
                </dl>
                {githubRepo ? (
                  <a
                    href={`${githubRepo}/releases`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs text-neutral-300 underline-offset-4 hover:text-white hover:underline"
                  >
                    Vergelijk met releases op GitHub
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="xl:col-span-2">
            <ApiKeysSettings />
          </div>

          <SettingsView />

          <LoaderSettingsView />

          <Card>
            <CardHeader>
              <CardTitle>E-mailvoorkeuren</CardTitle>
              <CardDescription>Marketingtoestemming staat los van toegang tot de app.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="settings-marketing"
                  checked={marketingOptIn}
                  disabled={savingConsent}
                  onCheckedChange={(checked) => updateConsent(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="settings-marketing" className="font-normal leading-5">
                  Stuur mij updates over het toekomstige, uitgebreidere project.
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Beveiliging en privacy</CardTitle>
              <CardDescription>Je sessie gebruikt een beveiligde cookie.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
                <ShieldCheck className="size-5 text-white" />
                E-mailadres geverifieerd
              </div>
              <Button variant="outline" onClick={logout}>
                <LogOut className="size-4" />Uitloggen
              </Button>
              <Separator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive"><Trash2 className="size-4" />Account verwijderen</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Account definitief verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>Je e-mailadres, profiel, toestemming en alle sessies worden onmiddellijk gewist.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAccount}>Definitief verwijderen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
