"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getPwaInstallStatus,
  isIosDevice,
  isStandaloneDisplay,
  type PwaInstallStatus,
} from "@/lib/pwa/installState";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallCard() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<PwaInstallStatus>("manual");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    function readStatus(canPrompt: boolean) {
      const standalone = isStandaloneDisplay({
        displayModeStandalone: window.matchMedia(
          "(display-mode: standalone)",
        ).matches,
        iosStandalone: Boolean(
          "standalone" in navigator &&
            (navigator as Navigator & { standalone?: boolean }).standalone,
        ),
      });
      const ios = isIosDevice(
        navigator.userAgent,
        navigator.platform,
        navigator.maxTouchPoints,
      );
      setStatus(getPwaInstallStatus({ standalone, canPrompt, ios }));
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      readStatus(true);
    }

    function onAppInstalled() {
      deferredPrompt.current = null;
      setInstalling(false);
      readStatus(false);
    }

    readStatus(false);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function installApp() {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) return;
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setStatus("installed");
      } else {
        setStatus((current) => (current === "prompt" ? "manual" : current));
      }
    } finally {
      deferredPrompt.current = null;
      setInstalling(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>App installeren</CardTitle>
        <CardDescription>
          Open Leerkrachtentools als app op je telefoon, tablet of computer.
          Lesgegevens blijven lokaal in deze browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "installed" ? (
          <div className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
            <Check className="size-5 text-white" />
            Leerkrachtentools staat al op dit apparaat als app.
          </div>
        ) : null}

        {status === "prompt" ? (
          <Button onClick={installApp} disabled={installing}>
            {installing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Installeer app
          </Button>
        ) : null}

        {status === "ios" ? (
          <p className="text-sm leading-6 text-neutral-400">
            Op iPhone of iPad: tik op Delen en kies Zet op beginscherm.
          </p>
        ) : null}

        {status === "manual" ? (
          <p className="text-sm leading-6 text-neutral-400">
            Gebruik het installatiemenu van je browser, meestal achter het
            icoon in de adresbalk. Op iPhone of iPad: Delen, daarna Zet op
            beginscherm.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
