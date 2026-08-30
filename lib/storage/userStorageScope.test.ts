import { describe, expect, it } from "vitest";
import {
  lessonStoreStorageKey,
  settingsStoreStorageKey,
} from "@/lib/storage/userStorageScope";

describe("user storage keys", () => {
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
});
