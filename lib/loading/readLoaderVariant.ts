import type { WordmarkLoaderVariant } from "@/lib/wordmark/letters";
import {
  getActiveUserId,
  settingsStoreStorageKey,
} from "@/lib/storage/userStorageScope";

const VALID_VARIANTS = new Set<WordmarkLoaderVariant>([
  "gather",
  "typewriter",
  "magnetic",
  "orbit",
  "shuffle",
  "breathe",
  "static",
]);

/** Read persisted loader choice before zustand rehydrate finishes (splash on reload). */
export function readLoaderVariantFromStorage(): WordmarkLoaderVariant {
  if (typeof window === "undefined") return "gather";

  const userId = getActiveUserId();
  if (!userId) return "gather";

  const raw = window.localStorage.getItem(settingsStoreStorageKey(userId));
  if (!raw) return "gather";

  try {
    const parsed = JSON.parse(raw) as { state?: { loaderVariant?: string } };
    const variant = parsed.state?.loaderVariant;
    if (variant && VALID_VARIANTS.has(variant as WordmarkLoaderVariant)) {
      return variant as WordmarkLoaderVariant;
    }
  } catch {
    // ignore corrupt storage
  }

  return "gather";
}
