"use client";

import { FormEvent, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { LoadingGate } from "@/components/shared/LoadingGate";
import { GlowWordmark } from "@/components/shared/GlowWordmark";
import { useClientMounted } from "@/hooks/useAppReady";

export function AuthScreen() {
  const mounted = useClientMounted();

  return (
    <LoadingGate loading={!mounted} intent="auto" label="Inlogscherm laden…">
      <AuthScreenContent />
    </LoadingGate>
  );
}

function AuthScreenContent() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
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
        body: JSON.stringify({ email, marketingOptIn, privacyAccepted }),
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

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-black px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.12),transparent_45%)]" />
      <GlowWordmark />
      <div className="relative z-10 w-full max-w-md">
        <h1 className="mb-10 text-center text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
          Leerkrachtentools
        </h1>

        <Card className="bg-neutral-950/90 shadow-2xl">
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

                <div className="auth-consent space-y-3 rounded-xl border border-neutral-800 bg-black p-4">
                  <p className="auth-consent-label text-[13px] font-semibold text-neutral-100">
                    Toestemming
                  </p>

                  <ConsentChoice
                    id="privacy"
                    checked={privacyAccepted}
                    onCheckedChange={setPrivacyAccepted}
                    label={
                      <>
                        <span className="font-semibold">Verplicht:</span> ik ga akkoord met het{" "}
                      </>
                    }
                  >
                    <Link
                      href="/privacy"
                      className="text-white underline underline-offset-2 hover:text-neutral-200"
                      target="_blank"
                    >
                      privacybeleid
                    </Link>
                    .
                  </ConsentChoice>

                  <ConsentChoice
                    id="marketing"
                    checked={marketingOptIn}
                    onCheckedChange={setMarketingOptIn}
                    label={
                      <>
                        <span className="font-semibold">Optioneel:</span> houd mij op de hoogte van het uitgebreidere project.
                      </>
                    }
                  />
                </div>

                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !privacyAccepted}
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Stuur verificatiecode
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code">Verificatiecode</Label>
                  <InputOTP
                    id="code"
                    maxLength={6}
                    value={code}
                    onChange={(value) => setCode(value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    autoFocus
                    aria-label="Verificatiecode van 6 cijfers"
                    containerClassName="w-full"
                  >
                    <InputOTPGroup className="flex w-full justify-between gap-2 rounded-none">
                      {Array.from({ length: 6 }, (_, index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="h-14 w-full flex-1 rounded-lg border border-input text-2xl font-semibold first:rounded-lg first:border-l last:rounded-lg"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
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
                  Inloggen
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

function ConsentChoice({
  id,
  checked,
  onCheckedChange,
  label,
  children,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="auth-consent-choice flex w-full items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-3 text-left text-neutral-100 hover:border-neutral-600">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <p className="flex-1 text-sm leading-6">
        <Label htmlFor={id} className="contents cursor-pointer font-normal">
          {label}
        </Label>
        {children}
      </p>
    </div>
  );
}
