import type { LessonGoal, LessonGoalId } from "@/types";

export const MAX_LESSON_GOALS = 12;
export const DEFAULT_LESSON_GOALS = 0;

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
  const slotCount = Math.max(0, Math.min(count, MAX_LESSON_GOALS));
  return Array.from({ length: slotCount }, (_, index) => ({
    id: goalIdForIndex(index),
    text: "",
  }));
}

export function trimTrailingEmptyGoals(goals: LessonGoal[]): LessonGoal[] {
  let end = goals.length;
  while (end > 0 && !goals[end - 1]?.text.trim()) {
    end -= 1;
  }
  return goals.slice(0, end);
}

export function filledGoals(goals: LessonGoal[]): LessonGoal[] {
  return goals.filter((goal) => goal.text.trim());
}

export function nextGoalId(goals: LessonGoal[]): LessonGoalId {
  return goalIdForIndex(trimTrailingEmptyGoals(goals).length);
}

export function buildGoalsFromPublisher(
  publisherGoals: string[],
  existingGoals: LessonGoal[] = [],
): LessonGoal[] {
  const trimmed = publisherGoals.map((goal) => goal.trim()).filter(Boolean);

  if (trimmed.length === 0) {
    return trimTrailingEmptyGoals(existingGoals);
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
