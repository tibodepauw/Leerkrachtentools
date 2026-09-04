"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LoadingGate } from "@/components/shared/LoadingGate";
import {
  pinnedModulesEqual,
  reconcilePinnedModules,
  serializePinnedModules,
} from "@/lib/auth/pinnedModules";
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
import {
  resetSettingsStoreState,
  useSettingsStore,
} from "@/stores/useSettingsStore";
import type { ModuleId } from "@/types";

interface UserStorageScopeProps {
  userId: string;
  accountPinnedModules: ModuleId[];
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

async function persistPinnedModulesToAccount(pinnedModules: ModuleId[]) {
  try {
    await fetch("/api/account/pinned-modules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinnedModules }),
    });
  } catch {
    // Local pins stay; the next successful toggle or login retry uploads.
  }
}

export function UserStorageScope({
  userId,
  accountPinnedModules,
  children,
}: UserStorageScopeProps) {
  if (typeof window !== "undefined" && isStorageWarmForUser(userId)) {
    setActiveUserId(userId);
  }

  const [readyUserId, setReadyUserId] = useState<string | null>(() =>
    isStorageWarmForUser(userId) ? userId : null,
  );
  const pinsReadyRef = useRef(isStorageWarmForUser(userId));
  const accountPinsKey = serializePinnedModules(accountPinnedModules);

  useLayoutEffect(() => {
    if (isStorageWarmForUser(userId)) {
      setActiveUserId(userId);
      setReadyUserId(userId);
      pinsReadyRef.current = true;
      return;
    }

    let cancelled = false;
    pinsReadyRef.current = false;

    async function activateUserStorage() {
      // Detach persist first. After logout the in-memory pins are empty; a
      // write while this user id is active would wipe the browser copy.
      setActiveUserId(null);

      const previousUserId = useLessonStore.getState().storageUserId;
      if (previousUserId && previousUserId !== userId) {
        clearRagQueryCache();
        resetLessonStoreState();
        resetSettingsStoreState();
      }

      setActiveUserId(userId);
      migrateLegacyLessonStorage(userId);
      await migrateLegacyDocumentStorage(userId);

      await useLessonStore.persist.rehydrate();
      await useSettingsStore.persist.rehydrate();
      if (cancelled) return;

      const reconciled = reconcilePinnedModules(
        useLessonStore.getState().pinnedModules,
        accountPinsKey,
      );
      if (
        !pinnedModulesEqual(
          useLessonStore.getState().pinnedModules,
          reconciled.pins,
        )
      ) {
        useLessonStore.getState().setPinnedModules(reconciled.pins);
      }

      useLessonStore.getState().setStorageUserId(userId);
      useLessonStore.getState().setHydrated(true);
      useSettingsStore.getState().setHydrated(true);
      cachedReadyUserId = userId;
      pinsReadyRef.current = true;
      setReadyUserId(userId);

      if (reconciled.shouldUpload) {
        void persistPinnedModulesToAccount(reconciled.pins);
      }
    }

    void activateUserStorage();

    return () => {
      cancelled = true;
    };
  }, [userId, accountPinsKey]);

  useLayoutEffect(() => {
    let timeout: number | undefined;
    const unsubscribe = useLessonStore.subscribe((state, previous) => {
      if (!pinsReadyRef.current || state.storageUserId !== userId) return;
      if (pinnedModulesEqual(state.pinnedModules, previous.pinnedModules)) {
        return;
      }
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        void persistPinnedModulesToAccount(state.pinnedModules);
      }, 400);
    });

    return () => {
      unsubscribe();
      window.clearTimeout(timeout);
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
