"use client";

import { useSyncExternalStore } from "react";
import type { WordmarkLoaderVariant } from "@/lib/wordmark/letters";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import { readLoaderVariantFromStorage } from "@/lib/loading/readLoaderVariant";
import { useSettingsStore } from "@/stores/useSettingsStore";

function subscribeToSettingsHydration(onStoreChange: () => void) {
  if (useSettingsStore.persist.hasHydrated()) {
    useSettingsStore.getState().setHydrated(true);
    return () => {};
  }

  return useSettingsStore.persist.onFinishHydration(() => {
    useSettingsStore.getState().setHydrated(true);
    onStoreChange();
  });
}

function getSettingsHydratedSnapshot() {
  return (
    useSettingsStore.getState().hydrated || useSettingsStore.persist.hasHydrated()
  );
}

function resolveLoaderVariant(
  hydrated: boolean,
  storeVariant: WordmarkLoaderVariant,
): WordmarkLoaderVariant {
  if (hydrated) return storeVariant;
  return readLoaderVariantFromStorage();
}

export function AppLoadingScreen({ label = "Interface laden…" }: { label?: string }) {
  const loaderVariant = useSettingsStore((state) => state.loaderVariant);
  const settingsHydrated = useSyncExternalStore(
    subscribeToSettingsHydration,
    getSettingsHydratedSnapshot,
    () => false,
  );
  const variant = resolveLoaderVariant(settingsHydrated, loaderVariant);

  return (
    <div className="grid min-h-screen place-items-center bg-black px-4">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <WordmarkLoader key={variant} variant={variant} />
        <p className="animate-pulse text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
