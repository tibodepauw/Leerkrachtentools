"use client";

import { useState } from "react";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import { Button } from "@/components/ui/button";
import {
  WORDMARK_LOADER_VARIANTS,
  type WordmarkLoaderVariant,
} from "@/lib/wordmark/letters";
import { cn } from "@/lib/utils";

export default function WordmarkLoaderPreviewPage() {
  const [variant, setVariant] = useState<WordmarkLoaderVariant>("gather");
  const [replayKey, setReplayKey] = useState(0);

  const active = WORDMARK_LOADER_VARIANTS.find((item) => item.id === variant);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-4 py-12">
      <header className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Preview only</p>
        <h1 className="text-2xl font-semibold text-white">Wordmark loading screens</h1>
        <p className="text-sm text-neutral-400">
          Vergelijk concepten voordat er één live gaat in de app. Kies een variant, klik opnieuw
          afspelen, en geef door welke je goedkeurt.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-10">
        <div className="flex min-h-[9rem] items-center justify-center">
          <WordmarkLoader key={`${variant}-${replayKey}`} variant={variant} />
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="secondary" onClick={() => setReplayKey((k) => k + 1)}>
            Opnieuw afspelen
          </Button>
        </div>
        {active ? (
          <div className="mt-6 space-y-1 text-center">
            <h2 className="text-lg font-medium text-white">{active.name}</h2>
            <p className="text-sm text-neutral-400">{active.description}</p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        {WORDMARK_LOADER_VARIANTS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setVariant(item.id);
              setReplayKey((k) => k + 1);
            }}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors",
              variant === item.id
                ? "border-white/30 bg-white/10"
                : "border-neutral-800 bg-neutral-950 hover:border-neutral-600",
            )}
          >
            <span className="block text-sm font-medium text-white">{item.name}</span>
            <span className="mt-1 block text-xs text-neutral-400">{item.description}</span>
          </button>
        ))}
      </section>
    </main>
  );
}
