"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_CHANGE_EVENT, ANALYTICS_CHOICE_KEY, analyticsConfiguration, captureAnalytics, clearLegacyAnalyticsStorage, readAnalyticsChoice, setAnalyticsChoice, stopAnalytics, type AnalyticsChoice } from "@/lib/analytics/consent";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsChoice>("unknown");
  const [open, setOpen] = useState(false);
  const config = analyticsConfiguration();
  useEffect(() => {
    clearLegacyAnalyticsStorage();
    const sync = () => { stopAnalytics(); setChoice(readAnalyticsChoice()); };
    const storage = (e: StorageEvent) => { if (e.key === ANALYTICS_CHOICE_KEY || e.key === null) sync(); };
    sync();
    window.addEventListener(ANALYTICS_CHANGE_EVENT, sync);
    window.addEventListener("storage", storage);
    const timer = setInterval(() => { if (readAnalyticsChoice() !== "accepted") sync(); }, 30_000);
    return () => { clearInterval(timer); stopAnalytics(); window.removeEventListener(ANALYTICS_CHANGE_EVENT, sync); window.removeEventListener("storage", storage); };
  }, []);
  useEffect(() => { if (choice === "accepted") captureAnalytics("$pageview", pathname); }, [pathname, choice]);
  const choose = (next: AnalyticsChoice) => { setAnalyticsChoice(next); setChoice(next); setOpen(false); };
  return <>{children}
    <aside className="fixed bottom-2 right-2 z-50 max-w-sm rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-sm shadow-lg" aria-label="Privacy en cookies">
      <button type="button" className="underline" onClick={() => setOpen(!open)}>Privacy &amp; cookies</button>
      {(open || (config.ready && choice === "unknown")) && <div className="mt-3 space-y-3">
        <p>Optionele gebruiksstatistieken via PostHog: bezochte apppagina’s en gebruikte functies, zonder lesinhoud of accountgegevens. Je kunt weigeren of later intrekken; alle lesfuncties blijven werken.</p>
        <p>Keuze op dit browserprofiel: {choice === "accepted" ? "toegestaan" : choice === "rejected" ? "geweigerd" : "nog niet gemaakt"}.</p>
        {!config.ready && <p>Analytics staat uit totdat de projectregio, verwerkersovereenkomst en bewaartermijn zijn bevestigd.</p>}
        <a className="underline" href="/privacy?versie=2026-09-19">Privacy- en cookie-uitleg</a>
        <div className="flex gap-2">
          <button type="button" className="rounded border px-3 py-2" disabled={!config.ready} onClick={() => choose("accepted")}>Toestaan</button>
          <button type="button" className="rounded border px-3 py-2" onClick={() => choose("rejected")}>{choice === "accepted" ? "Intrekken" : "Weigeren"}</button>
        </div>
      </div>}
    </aside>
  </>;
}
export function resetPostHogIdentity() { setAnalyticsChoice("unknown"); }
