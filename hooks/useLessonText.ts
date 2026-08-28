"use client";

import { useState } from "react";
import { useLessonStore } from "@/stores/useLessonStore";

export function useLessonPreparationText() {
  const content = useLessonStore((state) => state.lesson.lessonPreparation);
  const setContent = useLessonStore((state) => state.syncPreparation);
  return [content, setContent] as const;
}

export function useLessonGoalText(fallback = "") {
  const stored = useLessonStore((state) => state.lesson.goals[0]?.text ?? "");
  const [goal, setGoal] = useState("");
  const value = goal || stored || fallback;

  return [value, setGoal] as const;
}
