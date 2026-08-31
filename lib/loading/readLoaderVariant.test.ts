import { describe, expect, it, beforeEach, vi } from "vitest";
import { readLoaderVariantFromStorage } from "@/lib/loading/readLoaderVariant";
import { setActiveUserId } from "@/lib/storage/userStorageScope";

describe("readLoaderVariantFromStorage", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        for (const key of Object.keys(store)) delete store[key];
      },
    });
    vi.stubGlobal("window", { localStorage });
    setActiveUserId("user-1");
    localStorage.setItem(
      "leerkrachtentools-settings:user-1",
      JSON.stringify({ state: { loaderVariant: "typewriter" } }),
    );
  });

  it("reads variant from persisted settings storage", () => {
    expect(readLoaderVariantFromStorage()).toBe("typewriter");
  });

  it("falls back to gather when storage is missing", () => {
    localStorage.clear();
    expect(readLoaderVariantFromStorage()).toBe("gather");
  });
});
