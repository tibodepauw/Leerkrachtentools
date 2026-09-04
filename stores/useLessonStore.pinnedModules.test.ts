import { beforeEach, describe, expect, it } from "vitest";
import { resetLessonStoreState, useLessonStore } from "@/stores/useLessonStore";

describe("useLessonStore pinned modules", () => {
  beforeEach(() => {
    resetLessonStoreState();
  });

  it("zet alleen echte tools vast", () => {
    useLessonStore.getState().togglePinnedModule("active-lesson");
    expect(useLessonStore.getState().pinnedModules).toEqual([]);

    useLessonStore.getState().togglePinnedModule("spellcheck");
    useLessonStore.getState().togglePinnedModule("alignment");
    expect(useLessonStore.getState().pinnedModules).toEqual([
      "spellcheck",
      "alignment",
    ]);

    useLessonStore.getState().setPinnedModules([
      "spellcheck",
      "active-lesson",
      "spellcheck",
    ]);
    expect(useLessonStore.getState().pinnedModules).toEqual(["spellcheck"]);
  });
});
