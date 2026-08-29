"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { AppLoadingScreen } from "@/components/shared/AppLoadingScreen";
import {
  migrateLegacyDocumentStorage,
  migrateLegacyLessonStorage,
  setActiveUserId,
} from "@/lib/storage/userStorageScope";
import {
  resetLessonStoreState,
  useLessonStore,
} from "@/stores/useLessonStore";

interface UserStorageScopeProps {
  userId: string;
  children: ReactNode;
}

export function UserStorageScope({ userId, children }: UserStorageScopeProps) {
  const [readyUserId, setReadyUserId] = useState<string | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;

    async function activateUserStorage() {
      const previousUserId = useLessonStore.getState().storageUserId;
      if (previousUserId && previousUserId !== userId) {
        resetLessonStoreState();
      }

      setActiveUserId(userId);
      migrateLegacyLessonStorage(userId);
      await migrateLegacyDocumentStorage(userId);

      await useLessonStore.persist.rehydrate();
      if (cancelled) return;

      useLessonStore.getState().setStorageUserId(userId);
      useLessonStore.getState().setHydrated(true);
      setReadyUserId(userId);
    }

    useLessonStore.getState().setHydrated(false);
    void activateUserStorage();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (readyUserId !== userId) {
    return <AppLoadingScreen label="Accountgegevens laden…" />;
  }

  return children;
}
