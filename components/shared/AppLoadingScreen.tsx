"use client";

import type { WordmarkLoaderVariant } from "@/lib/wordmark/letters";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function AppLoadingScreen({ label = "Interface laden…" }: { label?: string }) {
  const loaderVariant = useSettingsStore((state) => state.loaderVariant);
  const hydrated = useSettingsStore((state) => state.hydrated);
  const variant: WordmarkLoaderVariant = hydrated ? loaderVariant : "gather";

  return (
    <div className="grid min-h-screen place-items-center bg-black px-4">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <WordmarkLoader variant={variant} />
        <p className="animate-pulse text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
