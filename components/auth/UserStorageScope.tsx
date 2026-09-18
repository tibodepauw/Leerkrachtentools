"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { resetPostHogIdentity } from "@/components/providers/posthog-provider";
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
import { SessionBoundary } from "@/components/auth/SessionBoundary";
import { isSharedDevice } from "@/lib/storage/sharedDevice";
import { deleteUserBrowserStorage } from "@/lib/storage/userStorageScope";

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
  const [storageError, setStorageError] = useState(false);
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
        resetPostHogIdentity();
        clearRagQueryCache();
        resetLessonStoreState();
        resetSettingsStoreState();
      }

      setActiveUserId(userId);
      if (isSharedDevice()) {
        await deleteUserBrowserStorage(userId);
        clearRagQueryCache();
      } else {
        migrateLegacyLessonStorage(userId);
        await migrateLegacyDocumentStorage(userId);
      }
      if (cancelled) return;

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

    void activateUserStorage().catch(() => {
      if (!cancelled) {
        setActiveUserId(null);
        setStorageError(true);
      }
    });

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
    <SessionBoundary userId={userId}>
    {storageError ? <p role="alert" className="p-6">Browseropslag kon niet veilig worden geopend of gewist. Sluit andere tabbladen van deze app, wis zo nodig de sitegegevens en laad opnieuw.</p> :
    <LoadingGate
      loading={readyUserId !== userId}
      intent="auto"
      label="Accountgegevens laden…"
    >
      {children}
    </LoadingGate>}
    </SessionBoundary>
  );
}
