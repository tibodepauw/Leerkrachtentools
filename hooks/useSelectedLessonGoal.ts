"use client";

import { useState } from "react";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonGoal } from "@/types";

function firstGoalWithText(goals: LessonGoal[]) {
  const index = goals.findIndex((goal) => goal.text.trim());
  return index >= 0 ? goals[index].id : "D1";
}

export function useSelectedLessonGoal() {
  const goals = useLessonStore((state) => state.lesson.goals);
  const setGoal = useLessonStore((state) => state.setGoal);
  const [selectedId, setSelectedId] = useState<LessonGoal["id"]>("D1");
  const effectiveSelectedId = goals.some(
    (goal) => goal.id === selectedId && goal.text.trim(),
  )
    ? selectedId
    : firstGoalWithText(goals);

  const selectedIndex = Math.max(
    0,
    goals.findIndex((goal) => goal.id === effectiveSelectedId),
  );
  const text = goals[selectedIndex]?.text ?? "";

  return {
    goals,
    selectedId: effectiveSelectedId,
    setSelectedId,
    text,
    setText: (value: string) => setGoal(selectedIndex, { text: value }),
  };
}
