"use client";

import { clearRagQueryCache } from "@/lib/rag/clientQueryCache";
import {
  deleteUserBrowserStorage,
  setActiveUserId,
} from "@/lib/storage/userStorageScope";
import { resetLessonStoreState } from "@/stores/useLessonStore";
import { resetSettingsStoreState } from "@/stores/useSettingsStore";

export function detachClientUserStorage() {
  clearRagQueryCache();
  setActiveUserId(null);
  resetLessonStoreState();
  resetSettingsStoreState();
}

export async function deleteClientUserStorage(userId: string) {
  clearRagQueryCache();
  await deleteUserBrowserStorage(userId);
  detachClientUserStorage();
}
