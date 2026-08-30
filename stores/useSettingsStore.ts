"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createUserScopedPersistStorage } from "@/lib/storage/userScopedPersistStorage";

interface SettingsStore {
  enableLlmQueryRewriting: boolean;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setEnableLlmQueryRewriting: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      enableLlmQueryRewriting: false,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setEnableLlmQueryRewriting: (enableLlmQueryRewriting) =>
        set({ enableLlmQueryRewriting }),
    }),
    {
      name: "leerkrachtentools-settings",
      skipHydration: true,
      storage: createJSONStorage(() => createUserScopedPersistStorage()),
      partialize: (state) => ({
        enableLlmQueryRewriting: state.enableLlmQueryRewriting,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
