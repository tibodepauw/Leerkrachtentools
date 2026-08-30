"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { LoadingGate } from "@/components/shared/LoadingGate";
import {
  migrateLegacyDocumentStorage,
  migrateLegacyLessonStorage,
  setActiveUserId,
} from "@/lib/storage/userStorageScope";
import { clearRagQueryCache } from "@/lib/rag/clientQueryCache";
import {
  resetLessonStoreState,
  useLessonStore,
} from "@/stores/useLessonStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface UserStorageScopeProps {
  userId: string;
  children: ReactNode;
}

/** Avoid re-showing loader on client navigations when storage is already warm. */
let cachedReadyUserId: string | null = null;

function isStorageWarmForUser(userId: string): boolean {
  return (
    cachedReadyUserId === userId &&
    useLessonStore.getState().storageUserId === userId &&
    useLessonStore.persist.hasHydrated()
  );
}

export function UserStorageScope({ userId, children }: UserStorageScopeProps) {
  const [readyUserId, setReadyUserId] = useState<string | null>(() =>
    isStorageWarmForUser(userId) ? userId : null,
  );

  useLayoutEffect(() => {
    if (isStorageWarmForUser(userId)) {
      setReadyUserId(userId);
      return;
    }

    let cancelled = false;

    async function activateUserStorage() {
      const previousUserId = useLessonStore.getState().storageUserId;
      if (previousUserId && previousUserId !== userId) {
        clearRagQueryCache();
        resetLessonStoreState();
      }

      setActiveUserId(userId);
      migrateLegacyLessonStorage(userId);
      await migrateLegacyDocumentStorage(userId);

      await useLessonStore.persist.rehydrate();
      await useSettingsStore.persist.rehydrate();
      if (cancelled) return;

      useLessonStore.getState().setStorageUserId(userId);
      useLessonStore.getState().setHydrated(true);
      useSettingsStore.getState().setHydrated(true);
      cachedReadyUserId = userId;
      setReadyUserId(userId);
    }

    useLessonStore.getState().setHydrated(false);
    useSettingsStore.getState().setHydrated(false);
    void activateUserStorage();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <LoadingGate
      loading={readyUserId !== userId}
      intent="auto"
      label="Accountgegevens laden…"
    >
      {children}
    </LoadingGate>
  );
}
