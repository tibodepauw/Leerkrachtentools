import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteUserBrowserStorage,
  lessonStoreStorageKey,
  migrateLegacyLessonStorage,
  setActiveUserId,
  settingsStoreStorageKey,
} from "@/lib/storage/userStorageScope";
import { createUserScopedPersistStorage } from "@/lib/storage/userScopedPersistStorage";

describe("user storage keys", () => {
  const values = new Map<string, string>();
  const deletedDatabases: string[] = [];

  beforeEach(() => {
    values.clear();
    deletedDatabases.length = 0;
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const indexedDB = {
      deleteDatabase(name: string) {
        deletedDatabases.push(name);
        const request: Record<string, (() => void) | null> = {
          onsuccess: null,
          onerror: null,
          onblocked: null,
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    };
    vi.stubGlobal("window", { localStorage, indexedDB });
  });

  it("keeps lesson and settings storage separate", () => {
    expect(settingsStoreStorageKey("user-1")).toBe(
      "leerkrachtentools-settings:user-1",
    );
    expect(lessonStoreStorageKey("user-1")).toBe(
      "leerkrachtentools-active-lesson:user-1",
    );
    expect(settingsStoreStorageKey("user-1")).not.toBe(
      lessonStoreStorageKey("user-1"),
    );
  });

  it("verwijdert legacy lesopslag ook als scoped opslag al bestaat", () => {
    values.set("leerkrachtentools-active-lesson", "legacy");
    values.set(lessonStoreStorageKey("user-1"), "scoped");

    migrateLegacyLessonStorage("user-1");

    expect(values.get(lessonStoreStorageKey("user-1"))).toBe("scoped");
    expect(values.has("leerkrachtentools-active-lesson")).toBe(false);
  });

  it("wist alle gebruikersgebonden browseropslag", async () => {
    values.set(lessonStoreStorageKey("user-1"), "lesson");
    values.set(settingsStoreStorageKey("user-1"), "settings");
    values.set("leerkrachtentools-sidebar-width:user-1", "320");

    await deleteUserBrowserStorage("user-1");

    expect(values.size).toBe(0);
    expect(deletedDatabases).toEqual(["leerkrachtentools-documents:user-1"]);
  });
});

describe("user-scoped persist writes", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    setActiveUserId(null);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
  });

  it("overschrijft opgeslagen lesdata niet zonder actieve gebruiker", () => {
    const key = lessonStoreStorageKey("user-1");
    values.set(key, '{"state":{"pinnedModules":["spellcheck"]}}');
    const storage = createUserScopedPersistStorage("lesson");

    storage.setItem("leerkrachtentools-active-lesson", '{"state":{"pinnedModules":[]}}');
    expect(values.get(key)).toBe('{"state":{"pinnedModules":["spellcheck"]}}');

    setActiveUserId("user-1");
    storage.setItem(
      "leerkrachtentools-active-lesson",
      '{"state":{"pinnedModules":["alignment"]}}',
    );
    expect(values.get(key)).toBe('{"state":{"pinnedModules":["alignment"]}}');
  });
});
