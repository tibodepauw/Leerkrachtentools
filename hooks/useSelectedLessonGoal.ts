"use client";

import { useMemo, useState } from "react";
import { filledGoals, MAX_LESSON_GOALS } from "@/lib/goals/lessonGoals";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonGoal } from "@/types";

export function useSelectedLessonGoal() {
  const goals = useLessonStore((state) => state.lesson.goals);
  const setGoal = useLessonStore((state) => state.setGoal);
  const addGoalSlot = useLessonStore((state) => state.addGoalSlot);
  const [selectedId, setSelectedId] = useState<LessonGoal["id"]>("D1");

  const visibleGoals = filledGoals(goals);
  const effectiveSelectedId = useMemo(() => {
    if (goals.some((goal) => goal.id === selectedId)) {
      return selectedId;
    }
    return visibleGoals[0]?.id ?? selectedId;
  }, [goals, selectedId, visibleGoals]);

  const selectedIndex = goals.findIndex((goal) => goal.id === effectiveSelectedId);
  const text = selectedIndex >= 0 ? (goals[selectedIndex]?.text ?? "") : "";

  function ensureSelectedIndex(): number {
    const currentIndex = useLessonStore
      .getState()
      .lesson.goals.findIndex((goal) => goal.id === effectiveSelectedId);

    if (currentIndex >= 0) {
      return currentIndex;
    }

    if (goals.length >= MAX_LESSON_GOALS) {
      return -1;
    }

    const draftId = addGoalSlot();
    if (draftId) {
      setSelectedId(draftId);
      return useLessonStore
        .getState()
        .lesson.goals.findIndex((goal) => goal.id === draftId);
    }

    return -1;
  }

  return {
    goals,
    visibleGoals,
    selectedId: effectiveSelectedId,
    setSelectedId,
    text,
    setText: (value: string) => {
      const index = ensureSelectedIndex();
      if (index >= 0) {
        setGoal(index, { text: value });
      }
    },
    addGoal: () => {
      const draftId = addGoalSlot();
      if (draftId) {
        setSelectedId(draftId);
      }
      return draftId;
    },
  };
}
