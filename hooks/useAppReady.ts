"use client";

import { useSyncExternalStore } from "react";
import { useLessonStore } from "@/stores/useLessonStore";

function subscribeToStoreHydration(onStoreChange: () => void) {
  if (useLessonStore.persist.hasHydrated()) {
    useLessonStore.getState().setHydrated(true);
    return () => {};
  }

  return useLessonStore.persist.onFinishHydration(() => {
    useLessonStore.getState().setHydrated(true);
    onStoreChange();
  });
}

function getStoreHydratedSnapshot() {
  return (
    useLessonStore.getState().hydrated || useLessonStore.persist.hasHydrated()
  );
}

export function useAppReady() {
  const mounted = useClientMounted();
  const hydrated = useSyncExternalStore(
    subscribeToStoreHydration,
    getStoreHydratedSnapshot,
    () => false,
  );

  return mounted && hydrated;
}

export function useClientMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
