"use client";

import { clearRagQueryCache } from "@/lib/rag/clientQueryCache";
import { clearTemporaryStorage } from "@/lib/storage/sharedDevice";
import {
  deleteUserBrowserStorage,
  setActiveUserId,
} from "@/lib/storage/userStorageScope";
import { resetLessonStoreState } from "@/stores/useLessonStore";
import { resetSettingsStoreState } from "@/stores/useSettingsStore";

export function detachClientUserStorage() {
  clearTemporaryStorage();
  clearRagQueryCache();
  setActiveUserId(null);
  resetLessonStoreState();
  resetSettingsStoreState();
}

export async function deleteClientUserStorage(userId: string) {
  detachClientUserStorage();
  await deleteUserBrowserStorage(userId);
}
