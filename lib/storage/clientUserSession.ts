"use client";

import { setActiveUserId } from "@/lib/storage/userStorageScope";
import { resetLessonStoreState } from "@/stores/useLessonStore";

export function detachClientUserStorage() {
  setActiveUserId(null);
  resetLessonStoreState();
}
