"use client";

import type { StateStorage } from "zustand/middleware";
import { isSharedDevice, temporaryStorage } from "@/lib/storage/sharedDevice";
import {
  getActiveUserId,
  lessonStoreStorageKey,
  settingsStoreStorageKey,
} from "@/lib/storage/userStorageScope";

export type UserScopedStorageScope = "lesson" | "settings";

function storageKeyForScope(scope: UserScopedStorageScope, userId: string) {
  return scope === "settings"
    ? settingsStoreStorageKey(userId)
    : lessonStoreStorageKey(userId);
}

export function createUserScopedPersistStorage(
  scope: UserScopedStorageScope = "lesson",
): StateStorage {
  return {
    getItem: () => {
      const userId = getActiveUserId();
      if (!userId) return null;
      const key = storageKeyForScope(scope, userId);
      return isSharedDevice() ? temporaryStorage.get(key) ?? null : window.localStorage.getItem(key);
    },
    setItem: (_name, value) => {
      void _name;
      const userId = getActiveUserId();
      if (!userId) return;
      const key = storageKeyForScope(scope, userId);
      if (isSharedDevice()) temporaryStorage.set(key, value);
      else window.localStorage.setItem(key, value);
    },
    removeItem: (_name) => {
      void _name;
      const userId = getActiveUserId();
      if (!userId) return;
      const key = storageKeyForScope(scope, userId);
      temporaryStorage.delete(key);
      window.localStorage.removeItem(key);
    },
  };
}
