import { beforeEach, describe, expect, it } from "vitest";
import { resetLessonStoreState, useLessonStore } from "@/stores/useLessonStore";

describe("useLessonStore.replaceGoalText", () => {
  beforeEach(() => {
    resetLessonStoreState();
  });

  it("neemt dollarpatronen in een nieuw doel letterlijk over in de lesvoorbereiding", () => {
    useLessonStore.setState((state) => ({
      lesson: {
        ...state.lesson,
        goals: [{ id: "D1", text: "De leerlingen tellen tot 10." }],
        lessonPreparation: "Instap. De leerlingen tellen tot 10. Slot.",
      },
    }));

    const next = "Betaal $5, $& of $` en $' en $$ en $1.";
    useLessonStore.getState().replaceGoalText(0, next);

    const { lesson } = useLessonStore.getState();
    expect(lesson.goals[0]?.text).toBe(next);
    expect(lesson.lessonPreparation).toBe(`Instap. ${next} Slot.`);
  });
});
