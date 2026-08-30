import { beforeEach, describe, expect, it } from "vitest";
import { resetLessonStoreState, useLessonStore } from "@/stores/useLessonStore";

describe("useLessonStore RAG filters", () => {
  beforeEach(() => {
    resetLessonStoreState();
  });

  it("behoudt onderwijsniveau en secundaire filters gedeeld tussen tools", () => {
    useLessonStore.getState().setEducationLevel("secundair_onderwijs");
    useLessonStore.getState().setSecondaryGradeFilter("2de_graad");
    useLessonStore.getState().setSecondaryFinalityFilter("doorstroom");

    expect(useLessonStore.getState().educationLevel).toBe("secundair_onderwijs");
    expect(useLessonStore.getState().secondaryGradeFilter).toBe("2de_graad");
    expect(useLessonStore.getState().secondaryFinalityFilter).toBe("doorstroom");
  });

  it("reset secundaire filters alleen bij een echt niveau-wijziging", () => {
    useLessonStore.getState().setEducationLevel("secundair_onderwijs");
    useLessonStore.getState().setSecondaryGradeFilter("3de_graad");

    useLessonStore.getState().setEducationLevel("secundair_onderwijs");

    expect(useLessonStore.getState().secondaryGradeFilter).toBe("3de_graad");
  });

  it("persisteert leerplan-netwerkkeuze in de store", () => {
    useLessonStore.getState().setCurriculumNetworkFilter("OPSTAP");

    expect(useLessonStore.getState().curriculumNetworkFilter).toBe("OPSTAP");
  });
});
