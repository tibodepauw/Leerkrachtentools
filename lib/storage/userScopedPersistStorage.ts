"use client";

import type { StateStorage } from "zustand/middleware";
import {
  getActiveUserId,
  lessonStoreStorageKey,
} from "@/lib/storage/userStorageScope";

export function createUserScopedPersistStorage(): StateStorage {
  return {
    getItem: () => {
      const userId = getActiveUserId();
      if (!userId) return null;
      return window.localStorage.getItem(lessonStoreStorageKey(userId));
    },
    setItem: (_name, value) => {
      void _name;
      const userId = getActiveUserId();
      if (!userId) return;
      window.localStorage.setItem(lessonStoreStorageKey(userId), value);
    },
    removeItem: (_name) => {
      void _name;
      const userId = getActiveUserId();
      if (!userId) return;
      window.localStorage.removeItem(lessonStoreStorageKey(userId));
    },
  };
}
