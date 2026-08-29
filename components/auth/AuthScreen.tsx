"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppLoadingScreen } from "@/components/shared/AppLoadingScreen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientMounted } from "@/hooks/useAppReady";

export function AuthScreen() {
  const mounted = useClientMounted();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, marketingOptIn }),
      });
      const payload = (await response.json()) as {
        error?: string;
        devCode?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Aanvraag mislukt.");
      setDevCode(payload.devCode ?? "");
      setStep("code");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aanvraag mislukt.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Verificatie mislukt.");
      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Verificatie mislukt.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return <AppLoadingScreen label="Inlogscherm laden…" />;
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-black px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.12),transparent_45%)]" />
      <div className="relative w-full max-w-md">
        <h1 className="mb-10 text-center text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
          Leerkrachtentools
        </h1>

        <Card className="border-neutral-800 bg-neutral-950/90 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-extrabold">
              {step === "email"
                ? "Log in met je e-mailadres"
                : "Controleer je inbox"}
            </CardTitle>
            <CardDescription>
              {step === "email"
                ? "Je ontvangt een eenmalige code. Geen wachtwoord nodig."
                : `We stuurden een code van 6 cijfers naar ${email}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={requestCode} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mailadres</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="naam@school.be"
                  />
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-black/40 p-3">
                  <Checkbox
                    id="marketing"
                    checked={marketingOptIn}
                    onCheckedChange={(checked) =>
                      setMarketingOptIn(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="marketing" className="font-normal leading-5">
                      Houd mij op de hoogte van het toekomstige, uitgebreidere project.
                    </Label>
                    <p className="text-xs leading-4 text-neutral-500">
                      Optioneel. Je toestemming wordt apart opgeslagen en kan later worden ingetrokken.
                    </p>
                  </div>
                </div>
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Stuur verificatiecode
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code">Verificatiecode</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                    className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
                    placeholder="000000"
                    autoFocus
                  />
                  {devCode && (
                    <p className="text-xs text-amber-400">
                      Lokale ontwikkelcode: {devCode}
                    </p>
                  )}
                </div>
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || code.length !== 6}
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Veilig inloggen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Ander e-mailadres
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs leading-5 text-neutral-600">
          We bewaren je e-mailadres voor toegang en beveiliging. Lesinhoud wordt niet in deze accountdatabase opgeslagen.
          {" "}<Link href="/privacy" className="underline hover:text-neutral-400">Lees het privacyoverzicht.</Link>
        </p>
      </div>
    </main>
  );
}
