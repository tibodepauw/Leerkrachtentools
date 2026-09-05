import { WordmarkLoader } from "@/components/shared/WordmarkLoader";

export const metadata = {
  title: "Offline · Leerkrachtentools",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <WordmarkLoader variant="static" className="wordmark-logo wordmark-logo--md" />
      <h1 className="mt-10 text-2xl font-black tracking-tight">Je bent offline</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        Lesvoorbereiding in deze browser blijft staan. Verbind opnieuw om in te
        loggen, te zoeken in leerplannen of AI-tools te gebruiken.
      </p>
    </main>
  );
}
