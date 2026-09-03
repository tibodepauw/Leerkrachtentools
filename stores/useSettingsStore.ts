"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LoaderVariantPreference } from "@/lib/loading/loaderVariantPreference";
import { createUserScopedPersistStorage } from "@/lib/storage/userScopedPersistStorage";

interface SettingsStore {
  enableLlmQueryRewriting: boolean;
  loaderVariant: LoaderVariantPreference;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setEnableLlmQueryRewriting: (enabled: boolean) => void;
  setLoaderVariant: (variant: LoaderVariantPreference) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      enableLlmQueryRewriting: false,
      loaderVariant: "gather",
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setEnableLlmQueryRewriting: (enableLlmQueryRewriting) =>
        set({ enableLlmQueryRewriting }),
      setLoaderVariant: (loaderVariant) => set({ loaderVariant }),
    }),
    {
      name: "leerkrachtentools-settings",
      skipHydration: true,
      storage: createJSONStorage(() => createUserScopedPersistStorage("settings")),
      partialize: (state) => ({
        enableLlmQueryRewriting: state.enableLlmQueryRewriting,
        loaderVariant: state.loaderVariant,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

export function resetSettingsStoreState() {
  useSettingsStore.setState({
    enableLlmQueryRewriting: false,
    loaderVariant: "gather",
    hydrated: false,
  });
}
