import type { LessonGoal, LessonGoalId } from "@/types";

export const MAX_LESSON_GOALS = 12;
/** Standaard lege slots vóór extractie (Thomas More D1–D3). */
export const DEFAULT_LESSON_GOALS = 3;

const GOAL_IDS = Array.from(
  { length: MAX_LESSON_GOALS },
  (_, index) => `D${index + 1}` as LessonGoalId,
);

export function goalIdForIndex(index: number): LessonGoalId {
  const id = GOAL_IDS[index];
  if (!id) {
    throw new RangeError(`Doelindex ${index} valt buiten D1–D${MAX_LESSON_GOALS}.`);
  }
  return id;
}

export function createEmptyGoals(count = DEFAULT_LESSON_GOALS): LessonGoal[] {
  const slotCount = Math.max(1, Math.min(count, MAX_LESSON_GOALS));
  return Array.from({ length: slotCount }, (_, index) => ({
    id: goalIdForIndex(index),
    text: "",
  }));
}

export function buildGoalsFromPublisher(
  publisherGoals: string[],
  existingGoals: LessonGoal[] = [],
): LessonGoal[] {
  const trimmed = publisherGoals.map((goal) => goal.trim()).filter(Boolean);

  if (trimmed.length === 0) {
    return existingGoals.length > 0
      ? existingGoals
      : createEmptyGoals();
  }

  const slotCount = Math.min(trimmed.length, MAX_LESSON_GOALS);

  return Array.from({ length: slotCount }, (_, index) => {
    const existing = existingGoals[index];
    return {
      id: goalIdForIndex(index),
      text: trimmed[index] ?? existing?.text ?? "",
      taxonomy: existing?.taxonomy,
    };
  });
}
