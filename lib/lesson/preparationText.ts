import type { ActiveLesson } from "@/types";

export function hasActiveLessonContext(lesson: ActiveLesson) {
  return Boolean(
    lesson.topic.trim() ||
      lesson.targetGroup.trim() ||
      lesson.goals.some((goal) => goal.text.trim()),
  );
}

export function hasLessonPreparation(lesson: ActiveLesson) {
  return Boolean(lesson.lessonPreparation.trim());
}

export function needsPreparationTextSync(lesson: ActiveLesson) {
  return Boolean(lesson.preparationDocument && !lesson.lessonPreparation.trim());
}

export function shouldSyncScannerSourceToPreparation(lesson: ActiveLesson) {
  return !hasLessonPreparation(lesson);
}
