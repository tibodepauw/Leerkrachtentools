"use client";

import { useState } from "react";
import { useLessonStore } from "@/stores/useLessonStore";

export function useLessonPreparationText() {
  const stored = useLessonStore((state) => state.lesson.lessonPreparation);
  const [content, setContent] = useState("");
  const value = content || stored;

  return [value, setContent] as const;
}

export function useLessonGoalText(fallback = "") {
  const stored = useLessonStore((state) => state.lesson.goals[0]?.text ?? "");
  const [goal, setGoal] = useState("");
  const value = goal || stored || fallback;

  return [value, setGoal] as const;
}
