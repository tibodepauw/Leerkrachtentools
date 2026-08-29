"use client";

import { useEffect, useState } from "react";
import { filledGoals, MAX_LESSON_GOALS } from "@/lib/goals/lessonGoals";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonGoal } from "@/types";

export function useSelectedLessonGoal() {
  const goals = useLessonStore((state) => state.lesson.goals);
  const setGoal = useLessonStore((state) => state.setGoal);
  const addGoalSlot = useLessonStore((state) => state.addGoalSlot);
  const [selectedId, setSelectedId] = useState<LessonGoal["id"]>("D1");

  const visibleGoals = filledGoals(goals);
  const selectedIndex = goals.findIndex((goal) => goal.id === selectedId);
  const text = selectedIndex >= 0 ? (goals[selectedIndex]?.text ?? "") : "";

  useEffect(() => {
    if (selectedIndex >= 0) {
      return;
    }

    if (visibleGoals[0]) {
      setSelectedId(visibleGoals[0].id);
      return;
    }

    if (goals.length >= MAX_LESSON_GOALS) {
      return;
    }

    const draftId = addGoalSlot();
    if (draftId) {
      setSelectedId(draftId);
    }
  }, [selectedIndex, visibleGoals, goals.length, addGoalSlot]);

  function ensureSelectedIndex(): number {
    const currentIndex = useLessonStore
      .getState()
      .lesson.goals.findIndex((goal) => goal.id === selectedId);

    if (currentIndex >= 0) {
      return currentIndex;
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
    selectedId,
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
