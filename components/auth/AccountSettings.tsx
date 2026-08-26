"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface AccountSettingsProps {
  email: string;
  displayName: string | null;
  tier: string;
  marketingOptIn: boolean;
}

function initials(name: string, email: string) {
  return (name || email.split("@")[0])
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("nl-BE"))
    .join("");
}

export function AccountSettings({
  email,
  displayName: initialDisplayName,
  tier,
  marketingOptIn: initialMarketingOptIn,
}: AccountSettingsProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
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
    router.push("/");
    router.refresh();
  }

  async function deleteAccount() {
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      toast.error("Account kon niet worden verwijderd.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/"><ArrowLeft className="size-4" />Terug naar tools</Link>
        </Button>

        <div className="mb-8 flex items-center gap-4">
          <Avatar className="size-14 border border-neutral-700">
            <AvatarFallback className="bg-neutral-800 text-lg font-semibold">
              {initials(displayName, email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Instellingen</h1>
            <p className="text-sm text-neutral-500">Beheer je profiel, plan en privacy.</p>
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Profiel</CardTitle>
              <CardDescription>Deze naam verschijnt alleen in jouw accountmenu.</CardDescription>
            </CardHeader>
            <CardContent>
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
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Abonnement</CardTitle>
                <CardDescription>Je huidige toegangsniveau.</CardDescription>
              </div>
              <Badge variant="secondary" className="capitalize">
                {tier === "free" ? "Gratis" : tier}
              </Badge>
            </CardHeader>
            <CardContent className="text-sm text-neutral-400">
              Je gebruikt alle beschikbare Leerkrachtentools binnen de gratis tier.
            </CardContent>
          </Card>

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
              <CardDescription>Je sessie gebruikt een beveiligde HttpOnly-cookie.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
                <ShieldCheck className="size-5 text-emerald-400" />
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
    </main>
  );
}
