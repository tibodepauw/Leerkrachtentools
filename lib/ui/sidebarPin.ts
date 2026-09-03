import { flushSync } from "react-dom";
import type { ModuleId } from "@/types";

export function excludePinnedModules<T extends { id: ModuleId }>(
  items: T[],
  pinnedIds: readonly ModuleId[],
): T[] {
  if (pinnedIds.length === 0) return items;
  const pinned = new Set(pinnedIds);
  return items.filter((item) => !pinned.has(item.id));
}

export function runSidebarPinTransition(update: () => void) {
  if (
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }

  document.startViewTransition(() => {
    flushSync(update);
  });
}
