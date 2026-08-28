"use client";

import { useState } from "react";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonGoal } from "@/types";

export function useSelectedLessonGoal() {
  const goals = useLessonStore((state) => state.lesson.goals);
  const setGoal = useLessonStore((state) => state.setGoal);
  const [selectedId, setSelectedId] = useState<LessonGoal["id"]>("D1");

  const selectedIndex = Math.max(
    0,
    goals.findIndex((goal) => goal.id === selectedId),
  );
  const text = goals[selectedIndex]?.text ?? "";

  return {
    goals,
    selectedId,
    setSelectedId,
    text,
    setText: (value: string) => setGoal(selectedIndex, { text: value }),
  };
}
