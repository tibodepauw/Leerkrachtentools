import {
  isLoaderVariantPreference,
  type LoaderVariantPreference,
} from "@/lib/loading/loaderVariantPreference";
import {
  getActiveUserId,
  settingsStoreStorageKey,
} from "@/lib/storage/userStorageScope";

/** Read persisted loader choice before zustand rehydrate finishes (splash on reload). */
export function readLoaderVariantFromStorage(): LoaderVariantPreference {
  if (typeof window === "undefined") return "gather";

  const userId = getActiveUserId();
  if (!userId) return "gather";

  const raw = window.localStorage.getItem(settingsStoreStorageKey(userId));
  if (!raw) return "gather";

  try {
    const parsed = JSON.parse(raw) as { state?: { loaderVariant?: string } };
    const variant = parsed.state?.loaderVariant;
    if (isLoaderVariantPreference(variant)) return variant;
  } catch {
    // ignore corrupt storage
  }

  return "gather";
}
