"use client";

import type { StateStorage } from "zustand/middleware";
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
      return window.localStorage.getItem(storageKeyForScope(scope, userId));
    },
    setItem: (_name, value) => {
      void _name;
      const userId = getActiveUserId();
      if (!userId) return;
      window.localStorage.setItem(storageKeyForScope(scope, userId), value);
    },
    removeItem: (_name) => {
      void _name;
      const userId = getActiveUserId();
      if (!userId) return;
      window.localStorage.removeItem(storageKeyForScope(scope, userId));
    },
  };
}
